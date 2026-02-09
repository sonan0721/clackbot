<template>
  <div v-if="totalPages > 1" class="pagination">
    <button :disabled="page === 0" @click="emit('page-change', page - 1)">이전</button>
    <span style="padding: 6px 12px; font-size: 13px;">{{ page + 1 }} / {{ totalPages }}</span>
    <button :disabled="page >= totalPages - 1" @click="emit('page-change', page + 1)">다음</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  total: number
  limit: number
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()

const totalPages = computed(() => Math.ceil(props.total / props.limit))
</script>
