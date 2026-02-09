<template>
  <div class="card">
    <div class="card-header">
      <h2>규칙 파일 관리</h2>
      <button class="btn" style="font-size: 12px; padding: 4px 8px;" @click="addRuleFile">+ 새 규칙 파일</button>
    </div>
    <div style="margin-top: 16px;">
      <div class="file-tabs">
        <button
          v-for="f in baseFiles"
          :key="f.slug"
          :class="['file-tab', { active: currentSlug === f.slug && currentType === 'base' }]"
          @click="selectTab(f.slug, 'base')"
        >
          {{ f.path }}
        </button>
      </div>

      <div v-if="rulesFiles.length > 0" class="rules-file-list">
        <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0 4px 0; font-weight: 600;">rules/ 폴더:</div>
        <div
          v-for="f in rulesFiles"
          :key="f.filename"
          :class="['rules-file-item', { active: currentSlug === f.filename && currentType === 'rules' }]"
        >
          <span class="rules-file-name" style="cursor: pointer;" @click="selectTab(f.filename, 'rules')">{{ f.path }}</span>
          <button class="btn btn-danger" style="font-size: 11px; padding: 2px 6px;" @click="deleteRuleFile(f.filename, f.path)">삭제</button>
        </div>
      </div>

      <div class="file-editor-container">
        <textarea
          v-model="editorContent"
          class="file-editor"
          placeholder="파일을 선택하세요..."
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
import type { SupervisorFile, RulesFile, FileContentResponse } from '../types/api'

const props = defineProps<{
  baseFiles: SupervisorFile[]
  rulesFiles: RulesFile[]
}>()

const emit = defineEmits<{
  'refresh-rules': []
}>()

const currentSlug = ref('')
const currentType = ref<'base' | 'rules'>('base')
const editorContent = ref('')
const statusText = ref('')

async function selectTab(slug: string, type: 'base' | 'rules') {
  currentSlug.value = slug
  currentType.value = type
  await loadFileContent(slug, type)
}

async function loadFileContent(slug: string, type: 'base' | 'rules') {
  editorContent.value = ''
  statusText.value = '로딩 중...'

  try {
    const endpoint = type === 'rules'
      ? `/api/supervisor/rules/${slug}`
      : `/api/supervisor/files/${slug}`
    const data = await api<FileContentResponse>(endpoint)
    editorContent.value = data.content || ''
    statusText.value = data.exists === false
      ? '파일이 존재하지 않습니다. 저장하면 생성됩니다.'
      : '파일이 존재합니다.'
  } catch {
    statusText.value = '파일 로드 실패'
  }
}

async function saveFile() {
  if (!currentSlug.value) return

  try {
    const endpoint = currentType.value === 'rules'
      ? `/api/supervisor/rules/${currentSlug.value}`
      : `/api/supervisor/files/${currentSlug.value}`
    await api(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ content: editorContent.value }),
    })
    statusText.value = '저장되었습니다.'
  } catch {
    statusText.value = '저장 실패'
  }
}

function refreshFile() {
  if (currentSlug.value) {
    loadFileContent(currentSlug.value, currentType.value)
  }
}

async function addRuleFile() {
  const filename = prompt('새 규칙 파일명을 입력하세요 (예: etiquette.md, slack/rules.md):')
  if (!filename) return

  let normalized = filename.trim()
  if (!normalized.endsWith('.md')) normalized += '.md'

  const encoded = normalized.replace(/\//g, '--')

  try {
    await api(`/api/supervisor/rules/${encoded}`, {
      method: 'PUT',
      body: JSON.stringify({ content: `# ${normalized}\n\n` }),
    })
    emit('refresh-rules')
  } catch (err) {
    alert('파일 생성 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}

async function deleteRuleFile(filename: string, displayPath: string) {
  if (!confirm(`규칙 파일 '${displayPath}'를 삭제하시겠습니까?`)) return

  try {
    await api(`/api/supervisor/rules/${filename}`, { method: 'DELETE' })
    emit('refresh-rules')
  } catch (err) {
    alert('삭제 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}

function reloadCurrentFile(changedFile: string) {
  const fileMap: Record<string, string> = { 'CLAUDE.md': 'claude-md', 'rules.md': 'rules-md' }
  if (currentType.value === 'base' && fileMap[changedFile] === currentSlug.value) {
    refreshFile()
  }
}

onMounted(() => {
  if (props.baseFiles.length > 0) {
    selectTab(props.baseFiles[0].slug, 'base')
  }
})

defineExpose({ refreshFile, reloadCurrentFile })
</script>
