<template>
  <nav class="sidebar">
    <div class="sidebar-header">
      <h1>Clackbot <span style="font-size:12px;font-weight:400;opacity:0.6;">{{ status.version ? `v${status.version}` : '' }}</span></h1>
      <span :class="['status-badge', status.online ? 'online' : 'offline']">
        {{ status.online ? (status.botName ? `@${status.botName}` : '온라인') : (status.loaded ? '오프라인' : '연결 중...') }}
      </span>
    </div>
    <ul class="nav-menu">
      <li><router-link to="/" class="nav-link" :class="{ active: route.path === '/' }">홈</router-link></li>
      <li><router-link to="/conversations" class="nav-link" :class="{ active: route.path === '/conversations' }">대화 이력</router-link></li>
      <li><router-link to="/tools" class="nav-link" :class="{ active: route.path === '/tools' }">연동 툴</router-link></li>
      <li><router-link to="/supervisor" class="nav-link" :class="{ active: route.path === '/supervisor' }">슈퍼바이저</router-link></li>
      <li><router-link to="/skills" class="nav-link" :class="{ active: route.path === '/skills' }">스킬</router-link></li>
      <li><router-link to="/settings" class="nav-link" :class="{ active: route.path === '/settings' }">설정</router-link></li>
      <li v-if="dashboardPlugins.length > 0" class="nav-divider"></li>
    </ul>
    <div v-if="dashboardPlugins.length > 0">
      <router-link
        v-for="p in dashboardPlugins"
        :key="p.name"
        :to="`/plugin/${p.name}`"
        class="nav-link"
        :class="{ active: route.path === `/plugin/${p.name}` }"
      >
        {{ p.navLabel || p.displayName }}
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBotStatus } from '../composables/useBotStatus'
import { usePlugins } from '../composables/usePlugins'

const route = useRoute()
const { state: status, refresh } = useBotStatus()
const { dashboardPlugins, loadRegistry } = usePlugins()

onMounted(async () => {
  refresh()
  await loadRegistry()
})
</script>
