import { reactive } from 'vue'
import type { SSEEvent } from '../types/api'

// 콘솔 세션 전역 상태 — 라우트 전환에도 유지

export interface ChatMsg {
  role: 'user' | 'assistant' | 'tool' | 'system' | 'error'
  content: string
}

interface ConsoleState {
  messages: ChatMsg[]
  eventSource: EventSource | null
  connected: boolean
}

// 키별 싱글턴 상태 관리 (tools 등)
const stores = new Map<string, ConsoleState>()

function getOrCreate(key: string): ConsoleState {
  if (!stores.has(key)) {
    stores.set(key, reactive({
      messages: [],
      eventSource: null,
      connected: false,
    }))
  }
  return stores.get(key)!
}

export function useConsoleStore(key: string) {
  const state = getOrCreate(key)

  function addMessage(role: ChatMsg['role'], content: string) {
    const trimmed = content.trim()
    if (!trimmed) return
    state.messages.push({ role, content: trimmed })
  }

  function handleSSEEvent(event: SSEEvent) {
    if (event.type === 'text') {
      const text = event.data.trim()
      if (!text) return
      // `> ` 접두사는 사용자 echo — 무시 (이미 UI에 추가됨)
      if (text.startsWith('>')) return
      addMessage('assistant', text)
    } else if (event.type === 'tool_call') {
      try {
        const tool = JSON.parse(event.data)
        addMessage('tool', `도구 호출: ${tool.name}`)
      } catch {
        addMessage('tool', event.data)
      }
    } else if (event.type === 'error') {
      addMessage('error', event.data)
    } else if (event.type === 'done') {
      addMessage('system', '완료')
    }
  }

  function connect(url: string) {
    if (state.eventSource) return

    const es = new EventSource(url)
    state.eventSource = es
    state.connected = true

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent
        if (data.type === 'connected') return
        handleSSEEvent(data)
      } catch {
        // 파싱 실패 무시
      }
    }

    es.onerror = () => {
      // EventSource 기본 자동 재연결
    }
  }

  function disconnect() {
    if (state.eventSource) {
      state.eventSource.close()
      state.eventSource = null
      state.connected = false
    }
  }

  function clear() {
    state.messages.length = 0
  }

  function reset() {
    clear()
    state.messages.push({ role: 'system', content: '세션이 초기화되었습니다.' })
  }

  return {
    state,
    addMessage,
    connect,
    disconnect,
    clear,
    reset,
  }
}
