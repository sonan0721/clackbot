<template>
  <div>
    <h1 class="page-title">설정</h1>

    <div class="card">
      <h2>봇 성격</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>성격 프리셋</label>
        <select v-model="preset" class="form-control" style="max-width: 300px;">
          <option value="professional">전문적 (Professional)</option>
          <option value="friendly">친근한 (Friendly)</option>
          <option value="detailed">상세한 (Detailed)</option>
          <option value="custom">커스텀 (Custom)</option>
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
    </div>

    <div class="card">
      <h2>봇 설정</h2>
      <div class="form-group" style="margin-top: 16px;">
        <label>접근 모드</label>
        <select v-model="accessMode" class="form-control" style="max-width: 300px;">
          <option value="owner">소유자 전용 (owner)</option>
          <option value="public">공개 (public)</option>
        </select>
      </div>
      <div class="form-group">
        <label>응답 모드</label>
        <select v-model="replyMode" class="form-control" style="max-width: 300px;">
          <option value="thread">스레드 응답 (thread)</option>
          <option value="chat">채널 응답 (chat)</option>
        </select>
        <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">chat: 채널 최상위 멘션 시 채널에 직접 응답</div>
      </div>
      <div class="form-group">
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
import { ref, computed, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { ConfigResponse, SlackUser } from '../types/api'

const preset = ref<string>('professional')
const customPrompt = ref('')
const accessMode = ref('owner')
const replyMode = ref('thread')
const ownerUserId = ref('')
const maxMessages = ref(20)
const timeoutMinutes = ref(30)
const webPort = ref(3847)
const slackInfo = ref<{ botName?: string; botUserId?: string; teamName?: string; botToken?: string; appToken?: string }>({})

const slackUsers = ref<SlackUser[]>([])
const usersLoaded = ref(false)
const usersFailed = ref(false)

const presetDescriptions: Record<string, string> = {
  professional: '간결하고 명확. 3~5줄. 이모지 없음.',
  friendly: '친근한 동료 톤. 이모지 적절히 사용. 캐주얼.',
  detailed: '꼼꼼하고 상세. 5~15줄. 단계별 안내.',
  custom: '아래에 직접 프롬프트를 작성하세요.',
}

const presetDesc = computed(() => presetDescriptions[preset.value] || '')

onMounted(async () => {
  try {
    const config = await api<ConfigResponse>('/api/config')
    preset.value = config.personality?.preset || 'professional'
    customPrompt.value = config.personality?.customPrompt || ''
    accessMode.value = config.accessMode
    replyMode.value = config.replyMode
    ownerUserId.value = config.ownerUserId || ''
    maxMessages.value = config.session?.maxMessages || 20
    timeoutMinutes.value = config.session?.timeoutMinutes || 30
    webPort.value = config.webPort || 3847
    slackInfo.value = config.slack || {}

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

  const updates = {
    accessMode: accessMode.value,
    replyMode: replyMode.value,
    ownerUserId: ownerUserId.value || undefined,
    webPort: webPort.value,
    session: {
      maxMessages: maxMessages.value,
      timeoutMinutes: timeoutMinutes.value,
    },
    personality: {
      preset: preset.value,
      ...(preset.value === 'custom' ? { customPrompt: customPrompt.value } : {}),
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
