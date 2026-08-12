import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/TunnelList.vue'),
    },
    {
      path: '/tunnels/:id',
      name: 'tunnel-detail',
      component: () => import('../views/TunnelDetail.vue'),
    },
    {
      path: '/tunnels/:id/logs',
      name: 'tunnel-logs',
      component: () => import('../views/TunnelLogs.vue'),
    },
    {
      path: '/dns',
      name: 'dns',
      component: () => import('../views/DnsManager.vue'),
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('../views/Accounts.vue'),
    },
    {
      path: '/settings',
      redirect: '/accounts',
    },
  ],
})

export default router
