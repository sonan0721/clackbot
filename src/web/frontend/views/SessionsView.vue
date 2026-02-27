<template>
  <div>
    <h1 class="page-title">세션 관리</h1>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab-btn', { active: activeTab === tab.value }]"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="card">
      <div class="empty-state"><p>불러오는 중...</p></div>
    </div>

    <div v-else-if="sessions.length === 0" class="card">
      <div class="empty-state"><p>세션이 없습니다.</p></div>
    </div>

    <template v-else>
      <div
        v-for="s in sessions"
        :key="s.id"
        class="card session-item"
        @click="toggleDetail(s.id)"
      >
        <div class="session-item-header">
          <div class="session-item-info">
            <div class="session-item-title">
              <span class="badge badge-agent">{{ s.agentType }}</span>
              <span v-if="s.skillUsed" class="badge badge-plugin">{{ s.skillUsed }}</span>
              <span :class="['badge', statusBadgeClass(s.status)]">{{ statusLabel(s.status) }}</span>
            </div>
            <div class="session-item-desc">{{ s.taskDescription || '(설명 없음)' }}</div>
            <div class="session-meta">
              {{ formatDate(s.createdAt) }} · 메시지 {{ s.messageCount }}개
              <template v-if="s.toolsUsed && s.toolsUsed.length > 0">
                · 도구: {{ s.toolsUsed.join(', ') }}
              </template>
            </div>
          </div>
          <div class="session-item-actions">
            <button
              v-if="s.status === 'active'"
              class="btn btn-danger"
              style="font-size: 12px; padding: 4px 10px;"
              @click.stop="killSession(s.id)"
            >
              종료
            </button>
            <span class="session-toggle">{{ expandedId === s.id ? '접기' : '펼치기' }}</span>
          </div>
        </div>

        <div v-if="expandedId === s.id" class="session-detail">
          <div v-if="detailLoading" class="empty-state" style="padding: 16px;"><p>로딩 중...</p></div>
          <div v-else-if="activities.length === 0" class="empty-state" style="padding: 16px;"><p>활동 기록이 없습니다.</p></div>
          <div v-else class="activity-timeline">
            <div v-for="a in activities" :key="a.id" class="activity-item">
              <div class="activity-dot" :class="activityDotClass(a.activityType)"></div>
              <div class="activity-content">
                <div class="activity-type">
                  <span :class="['badge', activityBadgeClass(a.activityType)]">{{ activityLabel(a.activityType) }}</span>
                  <span v-if="a.toolName" style="margin-left: 6px; font-size: 13px;"><code>{{ a.toolName }}</code></span>
                </div>
                <div class="activity-time">{{ formatDate(a.createdAt) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="total > limit" class="pagination">
      <button :disabled="currentPage === 0" @click="changePage(currentPage - 1)">이전</button>
      <button :disabled="(currentPage + 1) * limit >= total" @click="changePage(currentPage + 1)">다음</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import { formatDate, activityLabel, activityBadgeClass } from '../utils/agentFormatters'
import type { AgentSessionSummary, AgentSessionsResponse, AgentActivityItem } from '../types/api'

const tabs = [
  { label: '전체', value: '' },
  { label: '활성', value: 'active' },
  { label: '완료', value: 'completed' },
  { label: '실패', value: 'failed' },
]

const activeTab = ref('')
const sessions = ref<AgentSessionSummary[]>([])
const total = ref(0)
const currentPage = ref(0)
const limit = 20
const loading = ref(false)

const expandedId = ref<string | null>(null)
const activities = ref<AgentActivityItem[]>([])
const detailLoading = ref(false)

function statusLabel(status: string): string {
  const map: Record<string, string> = { active: '활성', completed: '완료', failed: '실패', expired: '만료' }
  return map[status] || status
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = { active: 'badge-active', completed: 'badge-builtin', failed: 'badge-error', expired: 'badge-plugin' }
  return map[status] || 'badge-plugin'
}

function activityDotClass(type: string): string {
  const map: Record<string, string> = { tool_use: 'dot-tool', skill_invoke: 'dot-skill', agent_spawn: 'dot-agent', memory_update: 'dot-memory' }
  return map[type] || ''
}

async function loadSessions() {
  loading.value = true
  const offset = currentPage.value * limit
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (activeTab.value) params.set('status', activeTab.value)

  try {
    const data = await api<AgentSessionsResponse>(`/api/sessions?${params}`)
    sessions.value = data.sessions
    total.value = data.total
  } catch {
    sessions.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function switchTab(tab: string) {
  activeTab.value = tab
  currentPage.value = 0
  loadSessions()
}

function changePage(page: number) {
  currentPage.value = page
  loadSessions()
}

async function toggleDetail(sessionId: string) {
  if (expandedId.value === sessionId) {
    expandedId.value = null
    activities.value = []
    return
  }

  expandedId.value = sessionId
  detailLoading.value = true
  try {
    const data = await api<{ activities: AgentActivityItem[] }>(`/api/sessions/${sessionId}`)
    activities.value = data.activities || []
  } catch {
    activities.value = []
  } finally {
    detailLoading.value = false
  }
}

async function killSession(sessionId: string) {
  if (!confirm('이 세션을 종료하시겠습니까?')) return
  try {
    await api(`/api/sessions/${sessionId}/kill`, { method: 'POST' })
    await loadSessions()
  } catch (err) {
    alert('세션 종료 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}

onMounted(loadSessions)
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.tab-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  transition: all 0.15s;
}
.tab-btn:hover {
  background: var(--bg);
}
.tab-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}
.session-item {
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.session-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.session-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.session-item-info {
  flex: 1;
  min-width: 0;
}
.session-item-title {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.session-item-desc {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}
.session-item-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-left: 12px;
}
.badge-agent {
  background: #d1ecf1;
  color: #0c5460;
}
.session-detail {
  border-top: 1px solid var(--border);
  margin-top: 16px;
  padding-top: 16px;
}
.activity-timeline {
  position: relative;
  padding-left: 20px;
}
.activity-item {
  position: relative;
  padding-bottom: 16px;
  padding-left: 16px;
  border-left: 2px solid var(--border);
}
.activity-item:last-child {
  border-left-color: transparent;
  padding-bottom: 0;
}
.activity-dot {
  position: absolute;
  left: -6px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
}
.dot-tool {
  background: var(--accent);
}
.dot-skill {
  background: var(--warning);
}
.dot-agent {
  background: var(--success);
}
.dot-memory {
  background: var(--error);
}
.activity-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.activity-type {
  display: flex;
  align-items: center;
}
.activity-time {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: 12px;
}
</style>
