<template>
  <div>
    <h1 class="page-title">슈퍼바이저</h1>

    <FileEditor
      ref="editorRef"
      :base-files="baseFiles"
      :rules-files="rulesFiles"
      @refresh-rules="loadData"
    />

    <ConsolePanel
      ref="consoleRef"
      title="슈퍼바이저 콘솔"
      sse-url="/api/supervisor/events"
      send-url="/api/supervisor/send"
      reset-url="/api/supervisor/reset"
      @event="onConsoleEvent"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { SupervisorFile, RulesFile, SSEEvent } from '../types/api'
import FileEditor from '../components/FileEditor.vue'
import ConsolePanel from '../components/ConsolePanel.vue'

const baseFiles = ref<SupervisorFile[]>([])
const rulesFiles = ref<RulesFile[]>([])
const editorRef = ref<InstanceType<typeof FileEditor>>()
const consoleRef = ref<InstanceType<typeof ConsolePanel>>()

async function loadData() {
  try {
    const [filesData, rulesData] = await Promise.all([
      api<{ files: SupervisorFile[] }>('/api/supervisor/files'),
      api<{ files: RulesFile[] }>('/api/supervisor/rules'),
    ])
    baseFiles.value = filesData.files || []
    rulesFiles.value = rulesData.files || []
  } catch {
    baseFiles.value = []
    rulesFiles.value = []
  }
}

function onConsoleEvent(event: SSEEvent) {
  if (event.type === 'file_changed') {
    consoleRef.value?.addSystemLine(`파일 변경됨: ${event.data}`)

    if (event.data === 'rules/') {
      loadData()
    }

    editorRef.value?.reloadCurrentFile(event.data)
  }
}

onMounted(loadData)
</script>
