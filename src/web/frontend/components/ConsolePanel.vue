<template>
  <div class="card">
    <div class="card-header">
      <h2>{{ title }}</h2>
      <button class="btn" style="font-size: 12px; padding: 4px 8px;" @click="resetSession">세션 초기화</button>
    </div>
    <div class="console-container">
      <div ref="outputEl" class="console-output">
        <div v-for="(line, i) in store.state.lines" :key="i" :class="['console-line', `console-${line.type}`]">
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
import { api } from '../composables/useApi'
import { useConsoleStore } from '../stores/consoleStore'

const props = defineProps<{
  title: string
  storeKey: string
  sseUrl: string
  sendUrl: string
  resetUrl: string
}>()

const emit = defineEmits<{
  event: [data: { type: string; data: string }]
}>()

const inputText = ref('')
const outputEl = ref<HTMLDivElement>()

const store = useConsoleStore(props.storeKey)

// 스크롤 감시 — lines가 변경될 때 자동 스크롤
watch(() => store.state.lines.length, () => {
  nextTick(() => {
    if (outputEl.value) {
      outputEl.value.scrollTop = outputEl.value.scrollHeight
    }
  })
})

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
    store.appendLine('error', `전송 실패: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** 외부에서 메시지를 콘솔에 전송 (GuideUploader 등) */
async function sendMessage(message: string) {
  try {
    await api(props.sendUrl, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    store.appendLine('error', `전송 실패: ${err instanceof Error ? err.message : String(err)}`)
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
  store.appendLine('system', text)
}

onMounted(() => {
  store.connect(props.sseUrl)
})

defineExpose({ addSystemLine, sendMessage })
</script>
