import { reactive } from 'vue'
import type { SSEEvent } from '../types/api'

// 콘솔 세션 전역 상태 — 라우트 전환에도 유지

export interface ConsoleLine {
  type: string
  text: string
}

interface ConsoleState {
  lines: ConsoleLine[]
  eventSource: EventSource | null
  connected: boolean
}

// 키별 싱글턴 상태 관리 (tools, supervisor 등)
const stores = new Map<string, ConsoleState>()

function getOrCreate(key: string): ConsoleState {
  if (!stores.has(key)) {
    stores.set(key, reactive({
      lines: [],
      eventSource: null,
      connected: false,
    }))
  }
  return stores.get(key)!
}

export function useConsoleStore(key: string) {
  const state = getOrCreate(key)

  function appendLine(type: string, text: string) {
    const splitLines = text.split('\n')
    for (const line of splitLines) {
      if (!line.trim()) continue
      state.lines.push({ type, text: line })
    }
  }

  function handleSSEEvent(event: SSEEvent) {
    if (event.type === 'text') {
      appendLine('text', event.data)
    } else if (event.type === 'tool_call') {
      try {
        const tool = JSON.parse(event.data)
        appendLine('tool', `도구 호출: ${tool.name}`)
      } catch {
        appendLine('tool', event.data)
      }
    } else if (event.type === 'error') {
      appendLine('error', event.data)
    } else if (event.type === 'done') {
      appendLine('system', '완료')
    }
  }

  function connect(url: string) {
    if (state.eventSource) return // 이미 연결됨

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
    state.lines.length = 0
  }

  function reset() {
    clear()
    state.lines.push({ type: 'system', text: '세션이 초기화되었습니다.' })
  }

  return {
    state,
    appendLine,
    connect,
    disconnect,
    clear,
    reset,
  }
}
