<template>
  <div class="skill-card">
    <div class="skill-card-body">
      <div class="skill-card-info">
        <div class="skill-card-name">{{ skill.name }}</div>
        <div class="skill-card-desc">
          <span v-if="skill.description">{{ skill.description }}</span>
          <span v-else style="color:var(--text-muted);">설명 없음</span>
        </div>
        <div class="skill-card-slug">slug: {{ skill.slug }}</div>
      </div>
      <div class="skill-card-actions">
        <button class="btn" style="font-size: 12px; padding: 4px 8px;" @click="emit('edit', skill.slug)">편집</button>
        <button class="btn btn-danger" style="font-size: 12px; padding: 4px 8px;" @click="emit('delete', skill.slug, skill.name)">삭제</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SkillSummary } from '../types/api'

defineProps<{
  skill: SkillSummary
}>()

const emit = defineEmits<{
  edit: [slug: string]
  delete: [slug: string, name: string]
}>()
</script>
