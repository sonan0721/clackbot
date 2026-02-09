<template>
  <div>
    <div v-if="errorMsg">
      <h1 class="page-title">{{ errorMsg }}</h1>
    </div>
    <div v-else-if="loading">
      <h1 class="page-title">로딩 중...</h1>
    </div>
    <div v-else ref="containerEl"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { usePlugins } from '../composables/usePlugins'
import type { ClackbotPlugin } from '../types/plugin'

const props = defineProps<{
  name: string
}>()

const { state, loadScript, getPlugin, getHelpers } = usePlugins()
const containerEl = ref<HTMLDivElement>()
const loading = ref(true)
const errorMsg = ref('')

let currentDestroy: (() => void) | null = null

async function renderPlugin(pluginName: string) {
  loading.value = true
  errorMsg.value = ''

  // 이전 플러그인 정리
  cleanup()

  const plugin = state.registry.find(p => p.name === pluginName)
  if (!plugin || !plugin.hasDashboard) {
    errorMsg.value = '플러그인을 찾을 수 없습니다'
    loading.value = false
    return
  }

  try {
    await loadScript(pluginName, plugin.pageUrl)
  } catch (err) {
    errorMsg.value = `플러그인 로드 실패: ${err instanceof Error ? err.message : String(err)}`
    loading.value = false
    return
  }

  const pluginModule: ClackbotPlugin | null = getPlugin(pluginName)
  if (!pluginModule || typeof pluginModule.render !== 'function') {
    errorMsg.value = `플러그인 '${pluginName}'의 render 함수를 찾을 수 없습니다.`
    loading.value = false
    return
  }

  if (typeof pluginModule.destroy === 'function') {
    currentDestroy = pluginModule.destroy
  }

  loading.value = false

  // nextTick 후 DOM에 렌더링
  setTimeout(async () => {
    if (containerEl.value) {
      try {
        await pluginModule.render(containerEl.value, getHelpers())
      } catch (err) {
        errorMsg.value = `플러그인 렌더링 실패: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }, 0)
}

function cleanup() {
  if (currentDestroy) {
    try { currentDestroy() } catch { /* 무시 */ }
    currentDestroy = null
  }
}

watch(() => props.name, (newName) => {
  renderPlugin(newName)
})

onMounted(() => {
  renderPlugin(props.name)
})

onBeforeUnmount(cleanup)
</script>
