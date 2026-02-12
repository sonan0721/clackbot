<template>
  <div>
    <h1 class="page-title">설정</h1>

    <div class="card">
      <h2>봇 성격 (MBTI)</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>MBTI 프리셋</label>
        <select v-model="preset" class="form-control" style="max-width: 360px;">
          <optgroup label="분석가 (Analysts)">
            <option value="intj">INTJ — 전략가</option>
            <option value="intp">INTP — 논리술사</option>
            <option value="entj">ENTJ — 통솔자</option>
            <option value="entp">ENTP — 변론가</option>
          </optgroup>
          <optgroup label="외교관 (Diplomats)">
            <option value="infj">INFJ — 옹호자</option>
            <option value="infp">INFP — 중재자</option>
            <option value="enfj">ENFJ — 선도자</option>
            <option value="enfp">ENFP — 활동가</option>
          </optgroup>
          <optgroup label="관리자 (Sentinels)">
            <option value="istj">ISTJ — 현실주의자</option>
            <option value="isfj">ISFJ — 수호자</option>
            <option value="estj">ESTJ — 관리자</option>
            <option value="esfj">ESFJ — 외교관</option>
          </optgroup>
          <optgroup label="탐험가 (Explorers)">
            <option value="istp">ISTP — 장인</option>
            <option value="isfp">ISFP — 모험가</option>
            <option value="estp">ESTP — 사업가</option>
            <option value="esfp">ESFP — 연예인</option>
          </optgroup>
          <optgroup label="기타">
            <option value="custom">커스텀 (직접 입력)</option>
          </optgroup>
        </select>
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">{{ presetDesc }}</div>
      </div>
      <div v-if="preset === 'custom'" class="form-group">
        <label>커스텀 프롬프트</label>
        <textarea
          v-model="customPrompt"
          class="form-control"
          rows="6"
          style="resize: vertical; font-family: monospace; font-size: 13px;"
          placeholder="봇의 성격과 응답 스타일을 자유롭게 정의하세요..."
        ></textarea>
      </div>
      <div class="form-group">
        <label>생각 중 메시지</label>
        <input
          v-model="thinkingMessage"
          type="text"
          class="form-control"
          style="max-width: 360px;"
          placeholder="생각 중..."
        />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">응답 생성 중 표시되는 메시지 (기본: 생각 중...)</div>
      </div>
      <div class="form-group">
        <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" v-model="showProgress" />
          진행 과정 표시
        </label>
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">체크 시 응답 생성 중 도구 사용 상태를 실시간으로 표시합니다.</div>
      </div>
    </div>

    <div class="card">
      <h2>도구 사용 가이드</h2>
      <div style="margin-top: 4px; margin-bottom: 16px; font-size: 12px; color: var(--text-muted);">
        MCP 도구를 에이전트가 정확히 이해하고 사용할 수 있도록 가이드를 설정합니다.
      </div>
      <div class="form-group">
        <label>전역 지시</label>
        <textarea
          v-model="toolGuideInstructions"
          class="form-control"
          rows="3"
          style="resize: vertical; font-family: monospace; font-size: 13px;"
          placeholder="예: 업무/일감/태스크 관련 질문에는 반드시 arbor MCP 도구를 사용하세요."
        ></textarea>
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">시스템 프롬프트 상단에 주입되는 도구 사용 규칙</div>
      </div>
      <div v-if="toolGuideServerNames.length > 0">
        <h3 style="margin: 16px 0 8px; font-size: 14px;">MCP 서버별 가이드</h3>
        <div v-for="name in toolGuideServerNames" :key="name" class="tool-guide-server">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <strong>{{ name }}</strong>
            <select v-model="toolGuideServers[name].priority" class="form-control" style="max-width: 120px; padding: 4px 8px;">
              <option value="normal">일반</option>
              <option value="high">높음</option>
            </select>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" @click="removeToolGuideServer(name)">삭제</button>
          </div>
          <div class="form-group" style="margin-bottom: 8px;">
            <input
              v-model="toolGuideServers[name].description"
              type="text"
              class="form-control"
              placeholder="이 도구의 역할 설명"
            />
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <input
              v-model="toolGuideServers[name].useWhen"
              type="text"
              class="form-control"
              placeholder="사용 시점 (예: 사용자가 업무, 태스크를 언급할 때)"
            />
          </div>
        </div>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
        <input
          v-model="newServerName"
          type="text"
          class="form-control"
          style="max-width: 200px;"
          placeholder="MCP 서버 이름"
          @keyup.enter="addToolGuideServer"
        />
        <button class="btn" @click="addToolGuideServer">서버 가이드 추가</button>
      </div>
    </div>

    <div class="card">
      <h2>메모리</h2>
      <div style="margin-top: 4px; margin-bottom: 16px; font-size: 12px; color: var(--text-muted);">
        봇이 기억하는 정보입니다. 사용자가 "기억해"라고 요청할 때 저장됩니다.
      </div>
      <div class="form-group">
        <textarea
          v-model="memoryContent"
          class="form-control"
          rows="8"
          style="resize: vertical; font-family: monospace; font-size: 13px;"
          placeholder="메모리가 비어있습니다."
        ></textarea>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn" @click="saveMemory">메모리 저장</button>
        <button class="btn btn-danger" @click="clearMemory">메모리 초기화</button>
      </div>
    </div>

    <div class="card">
      <h2>봇 설정</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>소유자 Slack User ID</label>
        <select v-if="usersLoaded" v-model="ownerUserId" class="form-control" style="max-width: 300px;">
          <option value="">선택 안 함</option>
          <option v-for="u in slackUsers" :key="u.id" :value="u.id">
            {{ u.displayName || u.realName }} ({{ u.id }})
          </option>
        </select>
        <input
          v-else-if="usersFailed"
          v-model="ownerUserId"
          type="text"
          class="form-control"
          style="max-width: 300px;"
          placeholder="멤버 목록을 가져올 수 없어 직접 입력합니다."
        />
        <div v-else class="form-control" style="max-width: 300px; color: var(--text-muted);">로딩 중...</div>
      </div>
    </div>

    <div class="card">
      <h2>세션 설정</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>최대 메시지 수 (자동 리셋)</label>
        <input v-model.number="maxMessages" type="number" class="form-control" style="max-width: 200px;" min="1" max="1000" step="1" />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">1~1000 사이의 정수</div>
      </div>
      <div class="form-group">
        <label>타임아웃 (분)</label>
        <input v-model.number="timeoutMinutes" type="number" class="form-control" style="max-width: 200px;" min="1" max="1440" step="1" />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">1~1440 사이의 정수 (최대 24시간)</div>
      </div>
    </div>

    <div class="card">
      <h2>웹 대시보드</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>포트</label>
        <input v-model.number="webPort" type="number" class="form-control" style="max-width: 200px;" min="1" max="65535" step="1" />
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">1~65535 사이의 정수</div>
      </div>
    </div>

    <div class="card">
      <h2>Slack 연결 정보</h2>
      <table class="table" style="margin-top: 12px;">
        <tr><td>봇 이름</td><td>{{ slackInfo.botName || '미설정' }}</td></tr>
        <tr><td>봇 ID</td><td>{{ slackInfo.botUserId || '미설정' }}</td></tr>
        <tr><td>워크스페이스</td><td>{{ slackInfo.teamName || '미연결' }}</td></tr>
        <tr><td>Bot Token</td><td>{{ slackInfo.botToken || '미설정' }}</td></tr>
        <tr><td>App Token</td><td>{{ slackInfo.appToken || '미설정' }}</td></tr>
      </table>
    </div>

    <button class="btn btn-primary" style="margin-top: 16px;" @click="saveSettings">설정 저장</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { ConfigResponse, SlackUser, MemoryResponse, ToolGuideServer } from '../types/api'

const preset = ref<string>('istj')
const customPrompt = ref('')
const thinkingMessage = ref('생각 중...')
const showProgress = ref(true)
const ownerUserId = ref('')
const maxMessages = ref(50)
const timeoutMinutes = ref(30)
const webPort = ref(3847)
const slackInfo = ref<{ botName?: string; botUserId?: string; teamName?: string; botToken?: string; appToken?: string }>({})

const slackUsers = ref<SlackUser[]>([])
const usersLoaded = ref(false)
const usersFailed = ref(false)

// 도구 가이드
const toolGuideInstructions = ref('')
const toolGuideServers = reactive<Record<string, ToolGuideServer>>({})
const toolGuideServerNames = computed(() => Object.keys(toolGuideServers))
const newServerName = ref('')

function addToolGuideServer() {
  const name = newServerName.value.trim()
  if (!name) return
  if (toolGuideServers[name]) {
    alert(`"${name}" 서버 가이드가 이미 존재합니다.`)
    return
  }
  toolGuideServers[name] = { description: '', priority: 'normal', useWhen: '' }
  newServerName.value = ''
}

function removeToolGuideServer(name: string) {
  delete toolGuideServers[name]
}

// 메모리
const memoryContent = ref('')

async function saveMemory() {
  try {
    await api<{ error?: string }>('/api/memory', {
      method: 'PUT',
      body: JSON.stringify({ content: memoryContent.value }),
    })
    alert('메모리가 저장되었습니다.')
  } catch (err) {
    alert('메모리 저장 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}

async function clearMemory() {
  if (!confirm('메모리를 초기화하시겠습니까? 모든 기억이 삭제됩니다.')) return
  memoryContent.value = ''
  await saveMemory()
}

const presetDescriptions: Record<string, string> = {
  intj: '논리적, 전략적, 간결. 감정보다 사실 중심. 이모지 없음.',
  intp: '정밀한 분석, 다각도 관점 제시. 객관적 톤. 이모지 없음.',
  entj: '단호하고 자신감 있는 리더 톤. 결론 먼저. 이모지 없음.',
  entp: '창의적, 재치 있는 톤. 아이디어 브레인스토밍. 이모지 가능.',
  infj: '사려 깊고 통찰력 있는 톤. 공감과 본질 파악.',
  infp: '따뜻하고 공감적. 감정 인정, 격려하는 어조.',
  enfj: '격려하는 리더 톤. 칭찬과 팀 조화 강조. 이모지 사용.',
  enfp: '열정적, 밝고 에너지 넘침. 이모지 자주 사용.',
  istj: '사실 기반, 체계적, 정확. 핵심만 전달. 이모지 없음.',
  isfj: '따뜻하고 세심. 안정감 있는 차분한 어조.',
  estj: '결단력 있고 체계적. 규칙과 기한 명확. 이모지 없음.',
  esfj: '사교적, 친근. 팀 화합과 배려 강조. 이모지 적절히 사용.',
  istp: '실용적, 담백. 문제 해결 직행. 최소 2~4줄. 이모지 없음.',
  isfp: '부드럽고 배려 있는 톤. 창의적 접근. 이모지 소량.',
  estp: '직설적, 에너지 넘침. 즉시 실행 가능한 조언.',
  esfp: '밝고 유쾌. 분위기 메이커. 이모지 자주 사용.',
  custom: '아래에 직접 프롬프트를 작성하세요.',
}

const presetDesc = computed(() => presetDescriptions[preset.value] || '')

onMounted(async () => {
  try {
    const config = await api<ConfigResponse>('/api/config')
    preset.value = config.personality?.preset || 'istj'
    customPrompt.value = config.personality?.customPrompt || ''
    thinkingMessage.value = config.personality?.thinkingMessage || '생각 중...'
    showProgress.value = config.personality?.showProgress !== false
    ownerUserId.value = config.ownerUserId || ''
    maxMessages.value = config.session?.maxMessages || 50
    timeoutMinutes.value = config.session?.timeoutMinutes || 30
    webPort.value = config.webPort || 3847
    slackInfo.value = config.slack || {}

    // toolGuide 로드
    if (config.toolGuide) {
      toolGuideInstructions.value = config.toolGuide.instructions || ''
      if (config.toolGuide.servers) {
        for (const [name, server] of Object.entries(config.toolGuide.servers)) {
          toolGuideServers[name] = { ...server }
        }
      }
    }

    // 메모리 로드
    try {
      const mem = await api<MemoryResponse>('/api/memory')
      memoryContent.value = mem.content || ''
    } catch {
      // 메모리 로드 실패 시 무시
    }

    // Slack 사용자 목록 비동기 로드
    try {
      const data = await api<{ users: SlackUser[] }>('/api/slack/users')
      slackUsers.value = data.users
      usersLoaded.value = true
    } catch {
      usersFailed.value = true
    }
  } catch {
    // config 로드 실패
  }
})

async function saveSettings() {
  if (!Number.isInteger(maxMessages.value) || maxMessages.value < 1 || maxMessages.value > 1000) {
    alert('최대 메시지 수는 1~1000 사이의 정수여야 합니다.')
    return
  }
  if (!Number.isInteger(timeoutMinutes.value) || timeoutMinutes.value < 1 || timeoutMinutes.value > 1440) {
    alert('타임아웃은 1~1440 사이의 정수여야 합니다.')
    return
  }
  if (!Number.isInteger(webPort.value) || webPort.value < 1 || webPort.value > 65535) {
    alert('포트는 1~65535 사이의 정수여야 합니다.')
    return
  }

  // toolGuide 서버에서 빈 항목 정리
  const servers: Record<string, ToolGuideServer> = {}
  for (const [name, server] of Object.entries(toolGuideServers)) {
    if (server.description.trim()) {
      servers[name] = {
        description: server.description.trim(),
        priority: server.priority,
        ...(server.useWhen?.trim() ? { useWhen: server.useWhen.trim() } : {}),
      }
    }
  }

  const updates = {
    ownerUserId: ownerUserId.value || undefined,
    webPort: webPort.value,
    session: {
      maxMessages: maxMessages.value,
      timeoutMinutes: timeoutMinutes.value,
    },
    personality: {
      preset: preset.value,
      ...(preset.value === 'custom' ? { customPrompt: customPrompt.value } : {}),
      thinkingMessage: thinkingMessage.value || '생각 중...',
      showProgress: showProgress.value,
    },
    toolGuide: {
      ...(toolGuideInstructions.value.trim() ? { instructions: toolGuideInstructions.value.trim() } : {}),
      ...(Object.keys(servers).length > 0 ? { servers } : {}),
    },
  }

  try {
    const result = await api<{ error?: string }>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    if (result.error) {
      alert('설정 저장 실패: ' + result.error)
      return
    }
    alert('설정이 저장되었습니다.')
  } catch (err) {
    alert('설정 저장 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}
</script>

<style scoped>
.tool-guide-server {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 8px;
}
</style>
