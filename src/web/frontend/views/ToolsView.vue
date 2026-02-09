<template>
  <div>
    <h1 class="page-title">연동 툴</h1>

    <div v-if="mcpServers.length > 0" class="card">
      <h2>설치된 MCP 서버 ({{ mcpServers.length }}개)</h2>
      <table class="table" style="margin-top: 12px;">
        <thead>
          <tr><th>이름</th><th>명령어</th><th>상태</th><th>관리</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in mcpServers" :key="s.name">
            <td><strong>{{ s.name }}</strong></td>
            <td><code>{{ s.command }} {{ s.args.join(' ') }}</code></td>
            <td><span class="badge badge-active">활성</span></td>
            <td><button class="btn btn-danger" style="font-size: 12px; padding: 4px 8px;" @click="removeMcp(s.name)">삭제</button></td>
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

    <ConsolePanel
      title="플러그인 설치 콘솔"
      sse-url="/api/console/events"
      send-url="/api/console/send"
      reset-url="/api/console/reset"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { ToolsResponse, BuiltinTool, McpServer, PluginTool, ConfigResponse } from '../types/api'
import ConsolePanel from '../components/ConsolePanel.vue'

const builtin = ref<BuiltinTool[]>([])
const mcpServers = ref<McpServer[]>([])
const plugins = ref<PluginTool[]>([])

async function loadTools() {
  try {
    const data = await api<ToolsResponse>('/api/tools')
    builtin.value = data.builtin
    mcpServers.value = data.mcpServers
    plugins.value = data.plugins
  } catch {
    builtin.value = []
    mcpServers.value = []
    plugins.value = []
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

onMounted(loadTools)
</script>
