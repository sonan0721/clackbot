<template>
  <div class="card chat-panel">
    <div class="chat-layout">
      <!-- 세션 목록 사이드바 -->
      <div class="chat-sidebar">
        <button class="btn btn-primary chat-new-btn" @click="createSession">+ 새 대화</button>
        <div class="chat-session-list">
          <div
            v-for="s in sessions"
            :key="s.id"
            :class="['chat-session-item', { active: activeSessionId === s.id }]"
            @click="switchSession(s.id)"
          >
            <span class="chat-session-title">{{ s.title }}</span>
            <button
              class="chat-session-delete"
              title="삭제"
              @click.stop="deleteSession(s.id)"
            >&times;</button>
          </div>
          <div v-if="sessions.length === 0" class="chat-session-empty">
            대화가 없습니다
          </div>
        </div>
      </div>

      <!-- 대화 영역 -->
      <div class="chat-main">
        <div v-if="!activeSessionId" class="chat-main-empty">
          <p>새 대화를 시작하세요</p>
        </div>
        <template v-else>
          <div ref="messagesEl" class="chat-messages">
            <div
              v-for="(msg, i) in currentMessages"
              :key="i"
              :class="['chat-msg', `chat-msg-${msg.role}`]"
            >
              <div class="chat-msg-role">
                {{ msg.role === 'user' ? '사용자' : msg.role === 'assistant' ? '어시스턴트' : '도구' }}
              </div>
              <div class="chat-msg-content">
                <template v-if="msg.role === 'tool'">
                  <details class="chat-tool-details">
                    <summary>{{ toolSummary(msg.content) }}</summary>
                    <pre class="chat-tool-pre">{{ msg.content }}</pre>
                  </details>
                </template>
                <template v-else>{{ msg.content }}</template>
              </div>
            </div>
            <!-- SSE 실시간 메시지 -->
            <div
              v-for="(line, i) in streamLines"
              :key="'stream-' + i"
              :class="['chat-msg', `chat-msg-${line.role}`]"
            >
              <div class="chat-msg-role">
                {{ line.role === 'assistant' ? '어시스턴트' : '도구' }}
              </div>
              <div class="chat-msg-content">
                <template v-if="line.role === 'tool'">
                  <details class="chat-tool-details">
                    <summary>{{ toolSummary(line.content) }}</summary>
                    <pre class="chat-tool-pre">{{ line.content }}</pre>
                  </details>
                </template>
                <template v-else>{{ line.content }}</template>
              </div>
            </div>
          </div>
          <div class="chat-input-bar">
            <input
              v-model="inputText"
              type="text"
              class="chat-input-field"
              placeholder="메시지를 입력하세요..."
              :disabled="sending"
              @keydown.enter="onEnter"
            />
            <button class="btn btn-primary" style="margin-left: 8px;" :disabled="sending || !inputText.trim()" @click="sendMessage">전송</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { api } from '../composables/useApi'

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: string
}

interface SessionInfo {
  id: string
  title: string
  messageCount: number
  updatedAt: string
}

interface StreamLine {
  role: 'assistant' | 'tool'
  content: string
}

const emit = defineEmits<{
  'file-changed': [file: string]
}>()

const sessions = ref<SessionInfo[]>([])
const activeSessionId = ref('')
const currentMessages = ref<ChatMessage[]>([])
const streamLines = ref<StreamLine[]>([])
const inputText = ref('')
const sending = ref(false)
const messagesEl = ref<HTMLDivElement>()

let eventSource: EventSource | null = null

function toolSummary(content: string): string {
  try {
    const tool = JSON.parse(content)
    return `도구 호출: ${tool.name}`
  } catch {
    return '도구 호출'
  }
}

async function loadSessions() {
  try {
    const data = await api<{ sessions: SessionInfo[] }>('/api/supervisor/sessions')
    sessions.value = data.sessions
  } catch {
    sessions.value = []
  }
}

async function createSession() {
  try {
    const data = await api<{ id: string }>('/api/supervisor/sessions', { method: 'POST' })
    await loadSessions()
    await switchSession(data.id)
  } catch {
    // 무시
  }
}

async function deleteSession(id: string) {
  if (!confirm('이 대화를 삭제하시겠습니까?')) return
  try {
    await api(`/api/supervisor/sessions/${id}`, { method: 'DELETE' })
    if (activeSessionId.value === id) {
      disconnectSSE()
      activeSessionId.value = ''
      currentMessages.value = []
      streamLines.value = []
    }
    await loadSessions()
  } catch {
    // 무시
  }
}

async function switchSession(id: string) {
  if (activeSessionId.value === id) return

  disconnectSSE()
  activeSessionId.value = id
  streamLines.value = []

  // 메시지 히스토리 로드
  try {
    const data = await api<{ messages: ChatMessage[] }>(`/api/supervisor/sessions/${id}/messages`)
    currentMessages.value = data.messages
  } catch {
    currentMessages.value = []
  }

  // SSE 연결
  connectSSE(id)
  scrollToBottom()
}

function connectSSE(sessionId: string) {
  disconnectSSE()
  const es = new EventSource(`/api/supervisor/sessions/${sessionId}/events`)

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'connected') return

      if (data.type === 'text') {
        // `> ` 접두사는 사용자 echo — 무시 (이미 messages에 있음)
        const text = data.data as string
        if (text.trim().startsWith('>')) return

        streamLines.value.push({ role: 'assistant', content: text })
      } else if (data.type === 'tool_call') {
        streamLines.value.push({ role: 'tool', content: data.data })
      } else if (data.type === 'done') {
        // 스트림 완료 — streamLines를 currentMessages로 병합
        flushStreamLines()
      } else if (data.type === 'error') {
        streamLines.value.push({ role: 'assistant', content: `오류: ${data.data}` })
      } else if (data.type === 'file_changed') {
        emit('file-changed', data.data)
      }

      scrollToBottom()
    } catch {
      // 파싱 실패 무시
    }
  }

  es.onerror = () => {
    // EventSource 자동 재연결
  }

  eventSource = es
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function flushStreamLines() {
  // 스트림 라인들을 currentMessages에 ChatMessage로 추가
  for (const line of streamLines.value) {
    currentMessages.value.push({
      role: line.role,
      content: line.content,
      timestamp: new Date().toISOString(),
    })
  }
  streamLines.value = []
}

function onEnter(e: KeyboardEvent) {
  if (e.isComposing) return
  sendMessage()
}

async function sendMessage() {
  const message = inputText.value.trim()
  if (!message || sending.value) return

  inputText.value = ''
  sending.value = true

  // 즉시 UI에 사용자 메시지 표시
  currentMessages.value.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  })
  scrollToBottom()

  try {
    await api(`/api/supervisor/sessions/${activeSessionId.value}/send`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
    // 세션 목록 갱신 (제목 변경 반영)
    await loadSessions()
  } catch (err) {
    streamLines.value.push({
      role: 'assistant',
      content: `전송 실패: ${err instanceof Error ? err.message : String(err)}`,
    })
  } finally {
    sending.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

onMounted(async () => {
  await loadSessions()
  // 마지막 활성 세션 자동 선택
  if (sessions.value.length > 0) {
    await switchSession(sessions.value[0].id)
  }
})

onUnmounted(() => {
  disconnectSSE()
})
</script>

<style scoped>
.chat-panel {
  padding: 0;
  overflow: hidden;
}

.chat-layout {
  display: flex;
  height: 600px;
}

.chat-sidebar {
  width: 240px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.chat-new-btn {
  margin: 12px;
  font-size: 13px;
}

.chat-session-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.chat-session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  margin-bottom: 2px;
}

.chat-session-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.chat-session-item.active {
  background: #e8f0fe;
  font-weight: 500;
}

.chat-session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-session-delete {
  display: none;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  flex-shrink: 0;
}

.chat-session-item:hover .chat-session-delete {
  display: block;
}

.chat-session-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 24px 12px;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-main-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 15px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.chat-msg {
  margin-bottom: 12px;
  max-width: 85%;
}

.chat-msg-user {
  margin-left: auto;
}

.chat-msg-user .chat-msg-content {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  border-radius: 12px 12px 4px 12px;
  padding: 10px 14px;
}

.chat-msg-assistant .chat-msg-content {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px 12px 12px 4px;
  padding: 10px 14px;
}

.chat-msg-tool .chat-msg-content {
  background: #f0f7ff;
  border: 1px solid #cce0ff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.chat-msg-role {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.chat-msg-user .chat-msg-role {
  text-align: right;
}

.chat-msg-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-tool-details summary {
  cursor: pointer;
  color: var(--accent);
  font-weight: 500;
}

.chat-tool-pre {
  margin-top: 6px;
  font-size: 11px;
  overflow-x: auto;
  white-space: pre-wrap;
  color: var(--text-muted);
}

.chat-input-bar {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}

.chat-input-field {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  background: var(--bg);
}

.chat-input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(54, 197, 240, 0.2);
}

@media (max-width: 768px) {
  .chat-sidebar {
    width: 60px;
  }
  .chat-session-title {
    display: none;
  }
  .chat-new-btn {
    font-size: 11px;
    padding: 6px;
  }
}
</style>
