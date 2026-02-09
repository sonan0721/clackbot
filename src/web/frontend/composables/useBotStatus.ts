import { reactive } from 'vue'
import { api } from './useApi'
import type { StatusResponse } from '../types/api'

interface BotState {
  online: boolean
  version: string
  botName: string | null
  teamName: string | null
  accessMode: string
  loaded: boolean
}

const state = reactive<BotState>({
  online: false,
  version: '',
  botName: null,
  teamName: null,
  accessMode: 'owner',
  loaded: false,
})

export function useBotStatus() {
  async function refresh() {
    try {
      const status = await api<StatusResponse>('/api/status')
      state.online = status.online
      state.version = status.version
      state.botName = status.botName
      state.teamName = status.teamName
      state.accessMode = status.accessMode
      state.loaded = true
    } catch {
      state.online = false
      state.loaded = true
    }
  }

  return { state, refresh }
}
