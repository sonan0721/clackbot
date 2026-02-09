<template>
  <div class="card console-chat-card">
    <div class="card-header">
      <h2>{{ title }}</h2>
      <button class="btn" style="font-size: 12px; padding: 4px 8px;" @click="resetSession">세션 초기화</button>
    </div>
    <div ref="messagesEl" class="console-chat-messages">
      <div
        v-for="(msg, i) in store.state.messages"
        :key="i"
        :class="['console-chat-msg', `console-chat-${msg.role}`]"
      >
        <!-- 사용자 -->
        <template v-if="msg.role === 'user'">
          <div class="console-chat-role">사용자</div>
          <div class="console-chat-bubble console-chat-bubble-user">{{ msg.content }}</div>
        </template>
        <!-- 어시스턴트 -->
        <template v-else-if="msg.role === 'assistant'">
          <div class="console-chat-role">어시스턴트</div>
          <div class="console-chat-bubble console-chat-bubble-bot">{{ msg.content }}</div>
        </template>
        <!-- 도구 -->
        <template v-else-if="msg.role === 'tool'">
          <div class="console-chat-bubble console-chat-bubble-tool">
            <span class="console-chat-tool-icon">⚙</span> {{ msg.content }}
          </div>
        </template>
        <!-- 시스템 -->
        <template v-else-if="msg.role === 'system'">
          <div class="console-chat-system">{{ msg.content }}</div>
        </template>
        <!-- 에러 -->
        <template v-else-if="msg.role === 'error'">
          <div class="console-chat-bubble console-chat-bubble-error">{{ msg.content }}</div>
        </template>
      </div>
      <div v-if="store.state.messages.length === 0" class="console-chat-empty">
        메시지를 입력하여 대화를 시작하세요
      </div>
    </div>
    <div class="console-chat-input-bar">
      <input
        v-model="inputText"
        type="text"
        class="console-chat-input"
        placeholder="메시지 입력..."
        @keydown.enter="onEnter"
      />
      <button class="btn btn-primary" style="margin-left: 8px;" :disabled="!inputText.trim()" @click="send">전송</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { api } from '../composables/useApi'
import { useConsoleStore } from '../stores/consoleStore'

const props = defineProps<{
  title: string
  storeKey: string
  sseUrl: string
  sendUrl: string
  resetUrl: string
}>()

const inputText = ref('')
const messagesEl = ref<HTMLDivElement>()

const store = useConsoleStore(props.storeKey)

watch(() => store.state.messages.length, () => {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
})

function onEnter(e: KeyboardEvent) {
  if (e.isComposing) return
  send()
}

async function send() {
  const message = inputText.value.trim()
  if (!message) return
  inputText.value = ''

  // 사용자 메시지 즉시 UI에 추가
  store.addMessage('user', message)

  try {
    await api(props.sendUrl, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    store.addMessage('error', `전송 실패: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** 외부에서 메시지를 전송 (GuideUploader 등) */
async function sendMessage(message: string) {
  store.addMessage('user', message)

  try {
    await api(props.sendUrl, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    store.addMessage('error', `전송 실패: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function resetSession() {
  try {
    await api(props.resetUrl, { method: 'POST' })
    store.reset()
  } catch {
    // 무시
  }
}

function addSystemLine(text: string) {
  store.addMessage('system', text)
}

onMounted(() => {
  store.connect(props.sseUrl)
})

defineExpose({ addSystemLine, sendMessage })
</script>

<style scoped>
.console-chat-card {
  padding: 0;
  overflow: hidden;
}

.console-chat-card > .card-header {
  padding: 16px 20px;
  margin-bottom: 0;
}

.console-chat-messages {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  padding: 16px 20px;
  background: var(--bg);
}

.console-chat-msg {
  margin-bottom: 12px;
}

.console-chat-msg:last-child {
  margin-bottom: 0;
}

.console-chat-role {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.console-chat-user .console-chat-role {
  text-align: right;
}

.console-chat-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 85%;
}

.console-chat-bubble-user {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  margin-left: auto;
  border-radius: 12px 12px 4px 12px;
}

.console-chat-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.console-chat-bubble-bot {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px 12px 12px 4px;
}

.console-chat-bubble-tool {
  background: #f0f7ff;
  border: 1px solid #cce0ff;
  border-radius: 8px;
  font-size: 12px;
  color: #1a73e8;
  padding: 6px 10px;
  max-width: 85%;
}

.console-chat-tool-icon {
  margin-right: 4px;
}

.console-chat-bubble-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 8px;
  font-size: 13px;
  max-width: 85%;
}

.console-chat-system {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: 4px 0;
}

.console-chat-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  padding: 48px 16px;
}

.console-chat-input-bar {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}

.console-chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  background: var(--bg);
}

.console-chat-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(54, 197, 240, 0.2);
}
</style>
