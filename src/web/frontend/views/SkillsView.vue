<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <h1 class="page-title" style="margin-bottom: 0;">스킬</h1>
      <button class="btn btn-primary" @click="startNew">+ 새 스킬</button>
    </div>

    <div v-if="skills.length === 0 && !showEditor" class="card">
      <div class="empty-state">
        <p>등록된 스킬이 없습니다.</p>
        <p style="font-size:13px;margin-top:8px;">스킬을 추가하면 봇이 특정 작업에 대해 전문적인 지시를 따릅니다.</p>
      </div>
    </div>

    <SkillCard
      v-for="s in skills"
      :key="s.slug"
      :skill="s"
      @edit="startEdit"
      @delete="deleteSkill"
    />

    <div v-if="showEditor" style="margin-top: 16px;">
      <SkillEditor :edit-slug="editingSlug" @saved="onSaved" @cancel="showEditor = false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import type { SkillSummary } from '../types/api'
import SkillCard from '../components/SkillCard.vue'
import SkillEditor from '../components/SkillEditor.vue'

const skills = ref<SkillSummary[]>([])
const showEditor = ref(false)
const editingSlug = ref<string | null>(null)

async function loadSkills() {
  try {
    const data = await api<{ skills: SkillSummary[] }>('/api/skills')
    skills.value = data.skills || []
  } catch {
    skills.value = []
  }
}

function startNew() {
  editingSlug.value = null
  showEditor.value = true
}

function startEdit(slug: string) {
  editingSlug.value = slug
  showEditor.value = true
}

async function deleteSkill(slug: string, name: string) {
  if (!confirm(`스킬 '${name}'을(를) 삭제하시겠습니까?`)) return

  try {
    await api(`/api/skills/${slug}`, { method: 'DELETE' })
    await loadSkills()
  } catch (err) {
    alert('삭제 실패: ' + (err instanceof Error ? err.message : String(err)))
  }
}

function onSaved() {
  showEditor.value = false
  loadSkills()
}

onMounted(loadSkills)
</script>
