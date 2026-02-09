<template>
  <div class="card">
    <h2>가이드 학습</h2>
    <p style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
      MCP 서버 연동 가이드(MD 파일)를 업로드하거나 붙여넣으면, 콘솔에서 자동으로 분석하여 설치를 안내합니다.
    </p>

    <div
      :class="['guide-dropzone', { 'guide-dropzone-active': dragging }]"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div v-if="!content" class="guide-dropzone-placeholder">
        MD 파일을 여기에 드래그하거나, 아래에 내용을 붙여넣으세요
      </div>
      <textarea
        v-model="content"
        class="guide-textarea"
        placeholder="가이드 마크다운 내용을 붙여넣으세요..."
        rows="6"
      ></textarea>
    </div>

    <div style="margin-top: 12px; display: flex; gap: 8px;">
      <button class="btn btn-primary" :disabled="!content.trim()" @click="submit">학습</button>
      <button class="btn" :disabled="!content.trim()" @click="content = ''">초기화</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  submit: [mdContent: string]
}>()

const content = ref('')
const dragging = ref(false)

function onDrop(e: DragEvent) {
  dragging.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (!file.name.endsWith('.md') && file.type !== 'text/markdown' && file.type !== 'text/plain') {
    alert('MD 또는 텍스트 파일만 지원합니다.')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    content.value = reader.result as string
  }
  reader.readAsText(file)
}

function submit() {
  const trimmed = content.value.trim()
  if (!trimmed) return
  emit('submit', trimmed)
  content.value = ''
}
</script>

<style scoped>
.guide-dropzone {
  margin-top: 12px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 12px;
  transition: border-color 0.2s, background 0.2s;
}

.guide-dropzone-active {
  border-color: var(--accent);
  background: rgba(54, 197, 240, 0.05);
}

.guide-dropzone-placeholder {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 8px 0;
}

.guide-textarea {
  width: 100%;
  border: none;
  background: transparent;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  color: var(--text);
}
</style>
