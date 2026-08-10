import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

let statusChecked = false

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/TunnelList.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tunnels/:id',
      name: 'tunnel-detail',
      component: () => import('../views/TunnelDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tunnels/:id/logs',
      name: 'tunnel-logs',
      component: () => import('../views/TunnelLogs.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dns',
      name: 'dns',
      component: () => import('../views/DnsManager.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/Settings.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  if (!statusChecked) {
    statusChecked = true
    await useAuthStore().checkStatus()
  }
  if (to.meta.requiresAuth && !useAuthStore().configured) {
    return { name: 'settings' }
  }
})

export default router
