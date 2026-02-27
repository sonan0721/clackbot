<template>
  <div>
    <h1 class="page-title">Brain 메모리</h1>

    <div v-if="loading" class="card">
      <div class="empty-state"><p>불러오는 중...</p></div>
    </div>

    <div v-else-if="files.length === 0" class="card">
      <div class="empty-state"><p>Brain 메모리 파일이 없습니다.</p></div>
    </div>

    <div v-else class="brain-layout">
      <div class="brain-sidebar card">
        <h3>파일 목록</h3>
        <ul class="file-tree">
          <li
            v-for="f in files"
            :key="f"
            :class="['file-tree-item', { active: selectedFile === f }]"
            @click="selectFile(f)"
          >
            {{ f }}
          </li>
        </ul>
      </div>

      <div class="brain-content">
        <div v-if="!selectedFile" class="card">
          <div class="empty-state"><p>좌측에서 파일을 선택하세요.</p></div>
        </div>

        <template v-else>
          <div class="card">
            <div class="card-header">
              <h2>{{ selectedFile }}</h2>
            </div>
            <div v-if="contentLoading" class="empty-state" style="padding: 16px;"><p>로딩 중...</p></div>
            <pre v-else class="brain-file-content">{{ fileContent }}</pre>
          </div>

          <div class="card">
            <div class="card-header">
              <h2>변경 이력</h2>
            </div>
            <div v-if="historyLoading" class="empty-state" style="padding: 16px;"><p>로딩 중...</p></div>
            <div v-else-if="history.length === 0" class="empty-state" style="padding: 16px;"><p>변경 이력이 없습니다.</p></div>
            <table v-else class="table">
              <thead>
                <tr><th>#</th><th>변경자</th><th>시간</th><th>내용 미리보기</th></tr>
              </thead>
              <tbody>
                <tr
                  v-for="(h, idx) in history"
                  :key="h.id"
                  :class="{ 'history-selected': selectedHistoryId === h.id }"
                  style="cursor: pointer;"
                  @click="showHistoryContent(h)"
                >
                  <td>{{ history.length - idx }}</td>
                  <td><span class="badge badge-builtin">{{ h.changed_by }}</span></td>
                  <td>{{ formatDate(h.created_at) }}</td>
                  <td>{{ truncate(h.content, 60) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="selectedHistoryContent !== null" class="card">
            <div class="card-header">
              <h2>스냅샷 내용</h2>
              <button class="btn" style="font-size: 12px; padding: 4px 10px;" @click="selectedHistoryContent = null; selectedHistoryId = null">닫기</button>
            </div>
            <pre class="brain-file-content">{{ selectedHistoryContent }}</pre>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import { formatDate, encodePath } from '../utils/agentFormatters'
import type { BrainFileTree, BrainFileContent, BrainMemorySnapshot } from '../types/api'

const files = ref<string[]>([])
const loading = ref(false)
const selectedFile = ref<string | null>(null)
const fileContent = ref('')
const contentLoading = ref(false)
const history = ref<BrainMemorySnapshot[]>([])
const historyLoading = ref(false)
const selectedHistoryContent = ref<string | null>(null)
const selectedHistoryId = ref<number | null>(null)

function truncate(str: string, max: number): string {
  if (!str) return ''
  const oneLine = str.replace(/\n/g, ' ')
  return oneLine.length > max ? oneLine.slice(0, max) + '...' : oneLine
}

async function loadFiles() {
  loading.value = true
  try {
    const data = await api<BrainFileTree>('/api/memory/brain')
    files.value = data.files
  } catch {
    files.value = []
  } finally {
    loading.value = false
  }
}

async function selectFile(filePath: string) {
  selectedFile.value = filePath
  selectedHistoryContent.value = null
  selectedHistoryId.value = null

  contentLoading.value = true
  historyLoading.value = true

  try {
    const data = await api<BrainFileContent>(`/api/memory/brain/${encodePath(filePath)}`)
    fileContent.value = data.content
  } catch {
    fileContent.value = '(파일을 불러올 수 없습니다.)'
  } finally {
    contentLoading.value = false
  }

  try {
    const data = await api<BrainMemorySnapshot[]>(`/api/memory/brain/${encodePath(filePath)}/history`)
    history.value = data
  } catch {
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

function showHistoryContent(snapshot: BrainMemorySnapshot) {
  selectedHistoryContent.value = snapshot.content
  selectedHistoryId.value = snapshot.id
}

onMounted(loadFiles)
</script>

<style scoped>
.brain-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 20px;
  align-items: start;
}
.brain-sidebar {
  position: sticky;
  top: 32px;
}
.brain-sidebar h3 {
  margin-bottom: 12px;
}
.file-tree {
  list-style: none;
}
.file-tree-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  transition: background 0.15s;
}
.file-tree-item:hover {
  background: var(--bg);
}
.file-tree-item.active {
  background: var(--primary);
  color: white;
}
.brain-file-content {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}
.history-selected {
  background: #e8f4fd !important;
}
@media (max-width: 768px) {
  .brain-layout {
    grid-template-columns: 1fr;
  }
  .brain-sidebar {
    position: static;
  }
}
</style>
