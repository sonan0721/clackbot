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
      path: '/tools',
      name: 'tools',
      component: () => import('./views/ToolsView.vue'),
    },
    {
      path: '/supervisor',
      name: 'supervisor',
      component: () => import('./views/SupervisorView.vue'),
    },
    {
      path: '/skills',
      name: 'skills',
      component: () => import('./views/SkillsView.vue'),
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
