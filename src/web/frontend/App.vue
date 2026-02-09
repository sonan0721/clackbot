<template>
  <div id="app">
    <AppSidebar />
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from './components/AppSidebar.vue'
</script>
