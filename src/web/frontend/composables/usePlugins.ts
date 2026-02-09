import { reactive, computed } from 'vue'
import { api } from './useApi'
import type { PluginRegistryItem } from '../types/plugin'
import type { ClackbotPlugin, PluginHelpers } from '../types/plugin'
import { escapeHtml } from '../utils/escapeHtml'
import { debounce } from '../utils/debounce'

interface PluginState {
  registry: PluginRegistryItem[]
  loadedScripts: Set<string>
}

const state = reactive<PluginState>({
  registry: [],
  loadedScripts: new Set(),
})

export function usePlugins() {
  async function loadRegistry() {
    try {
      const data = await api<{ plugins: PluginRegistryItem[] }>('/api/plugins')
      state.registry = data.plugins || []
    } catch {
      state.registry = []
    }
  }

  const dashboardPlugins = computed(() =>
    state.registry.filter(p => p.hasDashboard)
  )

  async function loadScript(name: string, url: string): Promise<void> {
    if (state.loadedScripts.has(name)) return
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => {
        state.loadedScripts.add(name)
        resolve()
      }
      script.onerror = () => reject(new Error(`스크립트 로드 실패: ${url}`))
      document.head.appendChild(script)
    })
  }

  function getPlugin(name: string): ClackbotPlugin | null {
    return window.__clackbot_plugins?.[name] ?? null
  }

  function getHelpers(): PluginHelpers {
    return {
      fetch: window.fetch.bind(window),
      escapeHtml,
      debounce: debounce as PluginHelpers['debounce'],
      api,
    }
  }

  return { state, loadRegistry, dashboardPlugins, loadScript, getPlugin, getHelpers }
}
