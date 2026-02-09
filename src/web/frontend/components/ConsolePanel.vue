<template>
  <div class="card">
    <div class="card-header">
      <h2>{{ title }}</h2>
      <button class="btn" style="font-size: 12px; padding: 4px 8px;" @click="resetSession">세션 초기화</button>
    </div>
    <div class="console-container">
      <div ref="outputEl" class="console-output">
        <div v-for="(line, i) in lines" :key="i" :class="['console-line', `console-${line.type}`]">
          {{ line.text }}
        </div>
      </div>
      <div class="console-input-bar">
        <span class="console-prompt">$</span>
        <input
          ref="inputEl"
          v-model="inputText"
          type="text"
          class="console-input"
          placeholder="메시지 입력..."
          @keydown.enter="send"
        />
        <button class="btn btn-primary" style="margin-left: 8px; padding: 6px 12px; font-size: 12px;" @click="send">전송</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useSSE } from '../composables/useSSE'
import { api } from '../composables/useApi'
import type { SSEEvent } from '../types/api'

interface ConsoleLine {
  type: string
  text: string
}

const props = defineProps<{
  title: string
  sseUrl: string
  sendUrl: string
  resetUrl: string
}>()

const emit = defineEmits<{
  event: [data: SSEEvent]
}>()

const lines = ref<ConsoleLine[]>([])
const inputText = ref('')
const outputEl = ref<HTMLDivElement>()
const inputEl = ref<HTMLInputElement>()

const { messages, connect, clear: clearSSE } = useSSE(props.sseUrl)

function appendLine(type: string, text: string) {
  const splitLines = text.split('\n')
  for (const line of splitLines) {
    if (!line.trim()) continue
    lines.value.push({ type, text: line })
  }
}

watch(messages, (msgs) => {
  if (msgs.length === 0) return
  const latest = msgs[msgs.length - 1]

  emit('event', latest)

  if (latest.type === 'text') {
    appendLine('text', latest.data)
  } else if (latest.type === 'tool_call') {
    try {
      const tool = JSON.parse(latest.data)
      appendLine('tool', `도구 호출: ${tool.name}`)
    } catch {
      appendLine('tool', latest.data)
    }
  } else if (latest.type === 'error') {
    appendLine('error', latest.data)
  } else if (latest.type === 'done') {
    appendLine('system', '완료')
  }

  nextTick(() => {
    if (outputEl.value) {
      outputEl.value.scrollTop = outputEl.value.scrollHeight
    }
  })
}, { deep: true })

async function send() {
  const message = inputText.value.trim()
  if (!message) return
  inputText.value = ''

  try {
    await api(props.sendUrl, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    appendLine('error', `전송 실패: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function resetSession() {
  try {
    await api(props.resetUrl, { method: 'POST' })
    lines.value = [{ type: 'system', text: '세션이 초기화되었습니다.' }]
    clearSSE()
  } catch {
    // 무시
  }
}

function addSystemLine(text: string) {
  appendLine('system', text)
}

onMounted(() => {
  connect()
})

defineExpose({ addSystemLine })
</script>
