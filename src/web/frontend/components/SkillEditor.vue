<template>
  <div class="card">
    <h2>{{ isNew ? '새 스킬' : '스킬 편집' }}</h2>
    <div class="form-group" style="margin-top: 16px;">
      <label>Slug (파일명, 영문/숫자/하이픈)</label>
      <input
        v-model="slug"
        type="text"
        class="form-control"
        style="max-width: 300px;"
        placeholder="예: draft-email"
        :disabled="!isNew"
      />
    </div>
    <div class="form-group">
      <label>이름</label>
      <input v-model="name" type="text" class="form-control" style="max-width: 400px;" placeholder="예: 이메일 초안 작성" />
    </div>
    <div class="form-group">
      <label>설명</label>
      <input v-model="description" type="text" class="form-control" placeholder="예: 전문적인 이메일 초안을 생성합니다" />
    </div>
    <div class="form-group">
      <label>프롬프트 (시스템 지시)</label>
      <textarea
        v-model="prompt"
        class="form-control"
        rows="12"
        style="resize: vertical; font-family: 'SF Mono', 'Monaco', 'Menlo', monospace; font-size: 13px;"
        placeholder="스킬의 지시사항을 작성하세요..."
      ></textarea>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" @click="save">저장</button>
      <button class="btn" @click="emit('cancel')">취소</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '../composables/useApi'
import type { SkillDetail } from '../types/api'

const props = defineProps<{
  editSlug: string | null
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const isNew = ref(true)
const slug = ref('')
const name = ref('')
const description = ref('')
const prompt = ref('')

watch(() => props.editSlug, async (val) => {
  if (val) {
    isNew.value = false
    try {
      const data = await api<SkillDetail>(`/api/skills/${val}`)
      slug.value = data.slug
      name.value = data.name || ''
      description.value = data.description || ''
      prompt.value = data.prompt || ''
    } catch {
      alert('스킬 로드 실패')
    }
  } else {
    isNew.value = true
    slug.value = ''
    name.value = ''
    description.value = ''
    prompt.value = ''
  }
}, { immediate: true })

async function save() {
  const s = slug.value.trim()
  if (!s) {
    alert('Slug를 입력하세요.')
    return
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) {
    alert('Slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.')
    return
  }
  if (!prompt.value.trim()) {
    alert('프롬프트를 입력하세요.')
    return
  }

  try {
    await api(`/api/skills/${s}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: name.value || s,
        description: description.value,
        prompt: prompt.value,
      }),
    })
    emit('saved')
  } catch (err) {
    alert('저장 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}
</script>
