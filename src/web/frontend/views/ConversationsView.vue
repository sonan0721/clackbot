<template>
  <div>
    <h1 class="page-title">대화 이력</h1>
    <div class="search-bar">
      <input v-model="searchText" type="text" placeholder="대화 검색..." />
    </div>
    <div v-if="sessions.length === 0 && !loading" class="card">
      <div class="empty-state"><p>대화가 없습니다.</p></div>
    </div>
    <template v-else>
      <SessionCard v-for="s in sessions" :key="s.threadTs" :session="s" />
    </template>
    <PaginationBar :page="currentPage" :total="total" :limit="limit" @page-change="onPageChange" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { api } from '../composables/useApi'
import { debounce } from '../utils/debounce'
import type { ConversationsResponse, SessionSummary } from '../types/api'
import SessionCard from '../components/SessionCard.vue'
import PaginationBar from '../components/PaginationBar.vue'

const sessions = ref<SessionSummary[]>([])
const total = ref(0)
const currentPage = ref(0)
const limit = 20
const searchText = ref('')
const loading = ref(false)

async function loadSessions(page: number, search: string) {
  loading.value = true
  const offset = page * limit
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (search) params.set('search', search)

  try {
    const data = await api<ConversationsResponse>(`/api/conversations?${params}`)
    sessions.value = data.sessions
    total.value = data.total
  } catch {
    sessions.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function onPageChange(page: number) {
  currentPage.value = page
  loadSessions(page, searchText.value)
}

const debouncedSearch = debounce(() => {
  currentPage.value = 0
  loadSessions(0, searchText.value)
}, 300)

watch(searchText, debouncedSearch)

onMounted(() => {
  loadSessions(0, '')
})
</script>
