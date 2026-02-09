<template>
  <div>
    <h1 class="page-title">대시보드</h1>
    <div class="grid">
      <div class="stat-card">
        <div class="label">봇 이름</div>
        <div class="value">{{ status.botName ? `@${status.botName}` : '미설정' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">워크스페이스</div>
        <div class="value">{{ status.teamName || '미연결' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">등록된 도구</div>
        <div class="value">{{ toolsTotal }}개</div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h2>최근 대화</h2>
        <router-link to="/conversations" style="color: var(--accent); text-decoration: none; font-size: 14px;">전체 보기</router-link>
      </div>
      <div v-if="sessions.length === 0" class="empty-state">
        <p>아직 대화 이력이 없습니다.</p>
      </div>
      <template v-else>
        <div v-for="s in sessions" :key="s.threadTs" class="session-card-mini">
          <div class="session-preview">{{ truncate(s.firstMessage, 80) }}</div>
          <div class="session-meta">{{ s.lastAt }} · {{ s.messageCount }}개 메시지</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBotStatus } from '../composables/useBotStatus'
import { api } from '../composables/useApi'
import type { ConversationsResponse, ToolsResponse, SessionSummary } from '../types/api'

const { state: status, refresh } = useBotStatus()
const sessions = ref<SessionSummary[]>([])
const toolsTotal = ref(0)

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}

onMounted(async () => {
  refresh()

  try {
    const data = await api<ConversationsResponse>('/api/conversations?limit=5')
    sessions.value = data.sessions
  } catch {
    sessions.value = []
  }

  try {
    const data = await api<ToolsResponse>('/api/tools')
    toolsTotal.value = data.total || 0
  } catch {
    toolsTotal.value = 0
  }
})
</script>
