<template>
  <div>
    <h1 class="page-title">연동 툴</h1>

    <div v-if="mcpServers.length > 0" class="card">
      <h2>설치된 MCP 서버 ({{ mcpServers.length }}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>타입</th><th>연결 정보</th><th>상태</th><th>관리</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in mcpServers" :key="s.name">
            <td><strong>{{ s.name }}</strong></td>
            <td>
              <span v-if="s.serverType === 'sse'" class="badge badge-sse">SSE</span>
              <span v-else-if="s.serverType === 'http'" class="badge badge-http">HTTP</span>
              <span v-else class="badge badge-stdio">stdio</span>
            </td>
            <td>
              <template v-if="s.serverType === 'sse' || s.serverType === 'http'">
                <code>{{ s.url }}</code>
              </template>
              <template v-else>
                <code>{{ s.command }} {{ s.args.join(' ') }}</code>
              </template>
            </td>
            <td><span class="badge badge-active">활성</span></td>
            <td><button class="btn btn-danger" style="font-size: 12px; padding: 4px 8px;" @click="removeMcp(s.name)">삭제</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pluginMcpServers.length > 0" class="card">
      <h2>플러그인 MCP 서버 ({{ pluginMcpServers.length }}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>명령어</th><th>상태</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in pluginMcpServers" :key="s.name">
            <td><strong>{{ s.displayName }}</strong></td>
            <td><code>{{ s.command }} {{ s.args.join(' ') }}</code></td>
            <td><span class="badge badge-active">활성</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>내장 도구 ({{ builtin.length }}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>설명</th><th>상태</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in builtin" :key="t.name">
            <td><code>{{ t.name }}</code></td>
            <td>{{ t.description }}</td>
            <td><span class="badge badge-active">활성</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="plugins.length > 0" class="card">
      <h2>플러그인 JSON ({{ plugins.length }}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>플러그인</th><th>설명</th><th>상태</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in plugins" :key="t.name">
            <td><code>{{ t.name }}</code></td>
            <td><span class="badge badge-plugin">{{ t.plugin }}</span></td>
            <td>{{ t.description }}</td>
            <td>
              <span v-if="t.status === 'active'" class="badge badge-active">활성</span>
              <template v-else>
                <span class="badge badge-error">인증 필요</span><br />
                <small>누락: {{ t.missingEnvVars.join(', ') }}</small>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="agents.length > 0" class="card">
      <h2>에이전트 ({{ agents.length }}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>설명</th><th>모델</th><th>도구</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in agents" :key="a.file">
            <td><strong>{{ a.name }}</strong></td>
            <td>{{ a.description }}</td>
            <td><code v-if="a.model">{{ a.model }}</code><span v-else class="badge badge-plugin">기본</span></td>
            <td>{{ a.tools || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="skills.length > 0" class="card">
      <h2>스킬 ({{ skills.length }}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>설명</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in skills" :key="s.name">
            <td><code>{{ s.name }}</code></td>
            <td>{{ s.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top: 16px;">
      <p style="color: var(--text-muted); font-size: 14px;">
        MCP 서버 설치/관리는 봇에게 DM으로 요청하세요.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { ToolsResponse, BuiltinTool, McpServer, PluginTool, PluginMcpServer, ConfigResponse, AgentDefinition, SkillDefinition } from '../types/api'

const builtin = ref<BuiltinTool[]>([])
const mcpServers = ref<McpServer[]>([])
const pluginMcpServers = ref<PluginMcpServer[]>([])
const plugins = ref<PluginTool[]>([])
const agents = ref<AgentDefinition[]>([])
const skills = ref<SkillDefinition[]>([])

async function loadTools() {
  try {
    const data = await api<ToolsResponse>('/api/tools')
    builtin.value = data.builtin
    mcpServers.value = data.mcpServers
    pluginMcpServers.value = data.pluginMcpServers ?? []
    plugins.value = data.plugins
  } catch {
    builtin.value = []
    mcpServers.value = []
    pluginMcpServers.value = []
    plugins.value = []
  }
}

async function loadAgents() {
  try {
    agents.value = await api<AgentDefinition[]>('/api/agents')
  } catch {
    agents.value = []
  }
}

async function loadSkills() {
  try {
    skills.value = await api<SkillDefinition[]>('/api/agents/skills')
  } catch {
    skills.value = []
  }
}

async function removeMcp(name: string) {
  if (!confirm(`MCP 서버 '${name}'를 삭제하시겠습니까?`)) return
  try {
    const config = await api<ConfigResponse>('/api/config')
    const servers = { ...config.mcpServers }
    delete servers[name]
    await api('/api/config', {
      method: 'PUT',
      body: JSON.stringify({ mcpServers: servers }),
    })
    await loadTools()
  } catch (err) {
    alert('삭제 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}

onMounted(() => {
  loadTools()
  loadAgents()
  loadSkills()
})
</script>
