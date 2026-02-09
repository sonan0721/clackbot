<template>
  <div class="card">
    <div class="card-header" style="cursor: pointer;" @click="collapsed = !collapsed">
      <h2>CLAUDE.md</h2>
      <span style="font-size: 12px; color: var(--text-muted);">{{ collapsed ? '펼치기 ▼' : '접기 ▲' }}</span>
    </div>
    <div v-show="!collapsed">
      <div class="file-editor-container" style="border-top: 1px solid var(--border); border-radius: 0 0 8px 8px;">
        <textarea
          v-model="editorContent"
          class="file-editor"
          placeholder="CLAUDE.md 내용..."
        ></textarea>
        <div class="file-status">{{ statusText }}</div>
        <div class="file-actions">
          <button class="btn btn-primary" @click="saveFile">저장</button>
          <button class="btn" @click="refreshFile">새로고침</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { FileContentResponse } from '../types/api'

const editorContent = ref('')
const statusText = ref('')
const collapsed = ref(true)

async function loadFile() {
  editorContent.value = ''
  statusText.value = '로딩 중...'

  try {
    const data = await api<FileContentResponse>('/api/supervisor/files/claude-md')
    editorContent.value = data.content || ''
    statusText.value = data.exists === false
      ? '파일이 존재하지 않습니다. 저장하면 생성됩니다.'
      : '파일이 존재합니다.'
  } catch {
    statusText.value = '파일 로드 실패'
  }
}

async function saveFile() {
  try {
    await api('/api/supervisor/files/claude-md', {
      method: 'PUT',
      body: JSON.stringify({ content: editorContent.value }),
    })
    statusText.value = '저장되었습니다.'
  } catch {
    statusText.value = '저장 실패'
  }
}

function refreshFile() {
  loadFile()
}

function reloadCurrentFile(changedFile: string) {
  if (changedFile === 'CLAUDE.md') {
    refreshFile()
  }
}

onMounted(loadFile)

defineExpose({ refreshFile, reloadCurrentFile })
</script>
