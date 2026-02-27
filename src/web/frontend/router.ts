import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/conversations',
      name: 'conversations',
      component: () => import('./views/ConversationsView.vue'),
    },
    {
      path: '/sessions',
      name: 'sessions',
      component: () => import('./views/SessionsView.vue'),
    },
    {
      path: '/tools',
      name: 'tools',
      component: () => import('./views/ToolsView.vue'),
    },
    {
      path: '/brain-memory',
      name: 'brain-memory',
      component: () => import('./views/BrainMemoryView.vue'),
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('./views/ProjectsView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsView.vue'),
    },
    {
      path: '/plugin/:name',
      name: 'plugin',
      component: () => import('./views/PluginView.vue'),
      props: true,
    },
  ],
})

export default router
