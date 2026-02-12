<template>
  <div>
    <h1 class="page-title">프로젝트</h1>
    <p style="color: var(--text-muted); margin-bottom: 20px;">
      Slack에서 <code>[태그]</code> 문법으로 프로젝트별 컨텍스트를 활용합니다.
      예: <code>@봇 [dev] API 수정해줘</code>
    </p>

    <!-- 등록된 프로젝트 목록 -->
    <div v-if="projects.length > 0">
      <div v-for="p in projects" :key="p.name" class="card project-card">
        <div class="project-header">
          <div>
            <strong class="project-tag">[{{ p.name }}]</strong>
            <span v-if="p.description" style="margin-left: 8px; color: var(--text-muted);">{{ p.description }}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm" @click="previewProject(p.name)">미리보기</button>
            <button class="btn btn-sm btn-danger" @click="deleteProject(p.name)">삭제</button>
          </div>
        </div>
        <div class="project-path">{{ p.path }}</div>
        <div class="project-status">
          <span :class="p.pathExists ? 'status-ok' : 'status-err'">
            {{ p.pathExists ? '경로 확인' : '경로 없음' }}
          </span>
          <span :class="p.hasClaudeMd ? 'status-ok' : 'status-warn'">
            {{ p.hasClaudeMd ? 'CLAUDE.md' : 'CLAUDE.md 없음' }}
          </span>
          <span :class="p.hasMemory ? 'status-ok' : 'status-warn'">
            {{ p.hasMemory ? '메모리' : '메모리 없음' }}
          </span>
        </div>
      </div>
    </div>
    <div v-else class="card" style="color: var(--text-muted);">
      등록된 프로젝트가 없습니다. 아래에서 프로젝트를 추가하세요.
    </div>

    <!-- 프로젝트 추가 -->
    <div class="card">
      <h2>프로젝트 추가</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>태그명</label>
        <input
          v-model="newName"
          type="text"
          class="form-control"
          style="max-width: 200px;"
          placeholder="예: dev, game, api"
          @keyup.enter="addProject"
        />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">영문, 숫자, 언더스코어만 가능</div>
      </div>
      <div class="form-group">
        <label>프로젝트 경로</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            v-model="newPath"
            type="text"
            class="form-control"
            placeholder="예: /Users/me/Git/my-project"
            @keyup.enter="addProject"
          />
          <button class="btn" @click="openBrowser" style="white-space: nowrap;">폴더 선택</button>
        </div>
      </div>
      <div class="form-group">
        <label>설명 (선택)</label>
        <input
          v-model="newDescription"
          type="text"
          class="form-control"
          style="max-width: 400px;"
          placeholder="예: 게임 서버 프로젝트"
          @keyup.enter="addProject"
        />
      </div>
      <button class="btn" @click="addProject" :disabled="!newName.trim() || !newPath.trim()">추가</button>
    </div>

    <!-- 컨텍스트 미리보기 -->
    <div v-if="preview" class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2>컨텍스트 미리보기: [{{ preview.projectName }}]</h2>
        <button class="btn btn-sm" @click="preview = null">닫기</button>
      </div>
      <div style="margin-top: 16px;">
        <h3 style="font-size: 14px; margin-bottom: 8px;">CLAUDE.md</h3>
        <pre v-if="preview.claudeMd" class="preview-box">{{ preview.claudeMd }}</pre>
        <p v-else style="color: var(--text-muted); font-size: 13px;">CLAUDE.md가 없습니다.</p>
      </div>
      <div style="margin-top: 16px;">
        <h3 style="font-size: 14px; margin-bottom: 8px;">Claude Code 메모리</h3>
        <pre v-if="preview.memory" class="preview-box">{{ preview.memory }}</pre>
        <p v-else style="color: var(--text-muted); font-size: 13px;">프로젝트 메모리가 없습니다.</p>
      </div>
    </div>

    <!-- 폴더 선택 모달 -->
    <div v-if="browserOpen" class="modal-overlay" @click.self="browserOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>폴더 선택</h3>
          <button class="modal-close" @click="browserOpen = false">&times;</button>
        </div>
        <div class="browser-path">
          <input
            v-model="browserInput"
            type="text"
            class="form-control"
            style="font-family: monospace; font-size: 13px;"
            @keyup.enter="browseTo(browserInput)"
          />
        </div>
        <div class="browser-indicators">
          <span v-if="browserData?.hasGit" class="status-ok">Git 저장소</span>
          <span v-if="browserData?.hasClaudeMd" class="status-ok">CLAUDE.md</span>
        </div>
        <div class="browser-list">
          <div
            v-if="browserData?.parent"
            class="browser-item browser-parent"
            @click="browseTo(browserData.parent)"
          >
            ../ (상위 폴더)
          </div>
          <div
            v-for="dir in browserData?.dirs"
            :key="dir"
            class="browser-item"
            @click="browseTo(browserData!.current + '/' + dir)"
          >
            {{ dir }}/
          </div>
          <div v-if="browserData && browserData.dirs.length === 0" style="padding: 12px; color: var(--text-muted); font-size: 13px;">
            하위 폴더가 없습니다.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="selectFolder">이 폴더 선택</button>
          <button class="btn" style="opacity: 0.7;" @click="browserOpen = false">취소</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { ProjectInfo, ProjectContextPreview } from '../types/api'

interface BrowseResult {
  current: string
  parent: string | null
  dirs: string[]
  hasClaudeMd: boolean
  hasGit: boolean
}

const projects = ref<ProjectInfo[]>([])
const preview = ref<ProjectContextPreview | null>(null)

const newName = ref('')
const newPath = ref('')
const newDescription = ref('')

// 폴더 브라우저 상태
const browserOpen = ref(false)
const browserInput = ref('')
const browserData = ref<BrowseResult | null>(null)

async function loadProjects() {
  try {
    projects.value = await api<ProjectInfo[]>('/api/projects')
  } catch {
    // 로드 실패
  }
}

async function addProject() {
  const name = newName.value.trim()
  const path = newPath.value.trim()
  if (!name || !path) return

  try {
    await api<ProjectInfo>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name,
        path,
        description: newDescription.value.trim() || undefined,
      }),
    })
    newName.value = ''
    newPath.value = ''
    newDescription.value = ''
    await loadProjects()
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err))
  }
}

async function deleteProject(name: string) {
  if (!confirm(`프로젝트 [${name}]을 삭제하시겠습니까?`)) return
  try {
    await api(`/api/projects/${name}`, { method: 'DELETE' })
    if (preview.value?.projectName === name) preview.value = null
    await loadProjects()
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err))
  }
}

async function previewProject(name: string) {
  try {
    preview.value = await api<ProjectContextPreview>(`/api/projects/${name}/context`)
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err))
  }
}

async function openBrowser() {
  const startPath = newPath.value.trim() || undefined
  await browseTo(startPath)
  browserOpen.value = true
}

async function browseTo(dirPath?: string | null) {
  if (!dirPath && dirPath !== undefined) return
  try {
    const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''
    browserData.value = await api<BrowseResult>(`/api/projects/browse${query}`)
    browserInput.value = browserData.value.current
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err))
  }
}

function selectFolder() {
  if (browserData.value) {
    newPath.value = browserData.value.current
  }
  browserOpen.value = false
}

onMounted(loadProjects)
</script>

<style scoped>
.project-card {
  margin-bottom: 12px;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-tag {
  font-family: monospace;
  font-size: 15px;
  color: var(--primary);
}

.project-path {
  margin-top: 8px;
  font-family: monospace;
  font-size: 13px;
  color: var(--text-muted);
}

.project-status {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.status-ok {
  color: var(--success, #22c55e);
}
.status-ok::before {
  content: '\2713 ';
}

.status-warn {
  color: var(--text-muted);
  opacity: 0.7;
}
.status-warn::before {
  content: '\2013 ';
}

.status-err {
  color: var(--danger, #ef4444);
}
.status-err::before {
  content: '\2717 ';
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.preview-box {
  background: var(--bg, #f8f9fa);
  border: 1px solid var(--border, #e1e1e1);
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text, #1d1c1d);
}

/* 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border, #e1e1e1);
  border-radius: 10px;
  width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #e1e1e1);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text, #1d1c1d);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted, #616061);
  font-size: 22px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.modal-close:hover {
  color: var(--text, #1d1c1d);
}

.browser-path {
  padding: 12px 20px 0;
}

.browser-indicators {
  padding: 8px 20px 0;
  display: flex;
  gap: 12px;
  font-size: 12px;
  min-height: 20px;
}

.browser-list {
  flex: 1;
  overflow-y: auto;
  margin: 8px 0;
  max-height: 400px;
  border-top: 1px solid var(--border, #e1e1e1);
  border-bottom: 1px solid var(--border, #e1e1e1);
}

.browser-item {
  padding: 10px 20px;
  cursor: pointer;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 13px;
  color: var(--text, #1d1c1d);
  border-bottom: 1px solid var(--bg, #f8f9fa);
}
.browser-item:hover {
  background: var(--bg, #f8f9fa);
}

.browser-parent {
  color: var(--text-muted, #616061);
  font-style: italic;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border, #e1e1e1);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
