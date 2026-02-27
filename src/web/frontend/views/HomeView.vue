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
      <div class="stat-card">
        <div class="label">활성 세션</div>
        <div class="value">{{ activeSessions.length }}개</div>
      </div>
    </div>

    <div v-if="activeSessions.length > 0" class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h2>활성 세션</h2>
        <router-link to="/sessions" style="color: var(--accent); text-decoration: none; font-size: 14px;">전체 보기</router-link>
      </div>
      <div v-for="s in activeSessions" :key="s.id" class="session-card-mini">
        <div class="session-preview">
          <span class="badge badge-active" style="margin-right: 6px;">{{ s.agentType }}</span>
          {{ s.taskDescription || '(설명 없음)' }}
        </div>
        <div class="session-meta">
          {{ formatDate(s.createdAt) }} · 메시지 {{ s.messageCount }}개
          <template v-if="s.toolsUsed && s.toolsUsed.length > 0"> · 도구: {{ s.toolsUsed.join(', ') }}</template>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h2>최근 활동</h2>
      </div>
      <div v-if="recentActivities.length === 0" class="empty-state">
        <p>아직 활동 기록이 없습니다.</p>
      </div>
      <div v-else class="activity-list">
        <div v-for="a in recentActivities" :key="a.id" class="activity-row">
          <span :class="['badge', activityBadgeClass(a.activityType)]">{{ activityLabel(a.activityType) }}</span>
          <span class="activity-row-agent">{{ a.agentType }}</span>
          <span v-if="a.toolName" class="activity-row-tool"><code>{{ a.toolName }}</code></span>
          <span class="activity-row-time">{{ formatDate(a.createdAt) }}</span>
        </div>
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
import { formatDate, activityLabel, activityBadgeClass } from '../utils/agentFormatters'
import type {
  ConversationsResponse,
  ToolsResponse,
  SessionSummary,
  AgentSessionsResponse,
  AgentSessionSummary,
  AgentActivityItem,
} from '../types/api'

const { state: status, refresh } = useBotStatus()
const sessions = ref<SessionSummary[]>([])
const toolsTotal = ref(0)
const activeSessions = ref<AgentSessionSummary[]>([])
const recentActivities = ref<AgentActivityItem[]>([])

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

  try {
    const data = await api<AgentSessionsResponse>('/api/sessions?status=active&limit=5')
    activeSessions.value = data.sessions
  } catch {
    activeSessions.value = []
  }

  try {
    const data = await api<AgentActivityItem[]>('/api/activities?limit=20')
    recentActivities.value = data
  } catch {
    recentActivities.value = []
  }
})
</script>

<style scoped>
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.activity-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
.activity-row:last-child {
  border-bottom: none;
}
.activity-row-agent {
  color: var(--text-muted);
  font-size: 13px;
}
.activity-row-tool {
  font-size: 13px;
}
.activity-row-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
