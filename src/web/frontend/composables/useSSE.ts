import { ref, onUnmounted } from 'vue'
import type { SSEEvent } from '../types/api'

export function useSSE(url: string) {
  const messages = ref<SSEEvent[]>([])
  let eventSource: EventSource | null = null

  function connect() {
    disconnect()
    eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent
        if (data.type === 'connected') return
        messages.value.push(data)
      } catch {
        // 파싱 실패 무시
      }
    }

    eventSource.onerror = () => {
      // EventSource 기본 자동 재연결
    }
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  function clear() {
    messages.value = []
  }

  onUnmounted(disconnect)

  return { messages, connect, disconnect, clear }
}
