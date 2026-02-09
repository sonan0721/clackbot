<template>
  <div class="session-card">
    <div class="session-header" @click="toggle">
      <div class="session-info">
        <div class="session-title">{{ truncate(session.firstMessage, 100) }}</div>
        <div class="session-meta">{{ session.lastAt }} · 채널: {{ session.channelId }} · {{ session.messageCount }}개 메시지</div>
      </div>
      <div class="session-toggle">&#9660;</div>
    </div>
    <div v-if="expanded" class="session-messages">
      <div v-if="loading" style="padding: 12px; color: var(--text-muted);">로딩 중...</div>
      <div v-else-if="loadError" style="padding: 12px; color: var(--error);">메시지 로드 실패</div>
      <template v-else>
        <div v-for="(m, i) in messages" :key="i" class="chat-pair">
          <div class="chat-bubble chat-user">
            <div class="chat-role">사용자</div>
            <div class="chat-text">{{ m.inputText }}</div>
            <div class="chat-time">{{ m.createdAt }}</div>
          </div>
          <div class="chat-bubble chat-bot">
            <div class="chat-role">봇</div>
            <div class="chat-text">{{ m.outputText || '(응답 없음)' }}</div>
            <div v-if="m.toolsUsed.length > 0" class="chat-tools">도구: {{ m.toolsUsed.join(', ') }}</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../composables/useApi'
import type { SessionSummary, Message, ConversationDetailResponse } from '../types/api'

const props = defineProps<{
  session: SessionSummary
}>()

const expanded = ref(false)
const messages = ref<Message[]>([])
const loading = ref(false)
const loadError = ref(false)
const loaded = ref(false)

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}

async function toggle() {
  if (expanded.value) {
    expanded.value = false
    return
  }

  expanded.value = true

  if (loaded.value) return

  loading.value = true
  loadError.value = false

  try {
    const data = await api<ConversationDetailResponse>(`/api/conversations/${props.session.threadTs}`)
    messages.value = data.messages
    loaded.value = true
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}
</script>
