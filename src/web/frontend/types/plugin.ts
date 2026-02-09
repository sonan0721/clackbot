// 플러그인 인터페이스 + window 글로벌 선언

export interface PluginHelpers {
  fetch: typeof window.fetch
  escapeHtml: (str: string) => string
  debounce: <T extends (...args: unknown[]) => void>(fn: T, delay: number) => T
  api: <T = unknown>(path: string, options?: RequestInit) => Promise<T>
}

export interface ClackbotPlugin {
  render: (container: HTMLElement, helpers: PluginHelpers) => Promise<void>
  destroy?: () => void
}

export interface PluginRegistryItem {
  name: string
  displayName: string
  navLabel?: string
  hasDashboard: boolean
  pageUrl: string
}

declare global {
  interface Window {
    __clackbot_plugins?: Record<string, ClackbotPlugin>
  }
}
