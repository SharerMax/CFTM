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
      path: '/tunnels/remote/:accountId/:tunnelId',
      name: 'remote-tunnel-ingress',
      component: () => import('../views/RemoteTunnelIngress.vue'),
    },
    {
      path: '/tunnels/remote/:accountId/:tunnelId/ingress/:index',
      name: 'remote-ingress-edit',
      component: () => import('../views/RemoteIngressEdit.vue'),
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
      name: 'settings',
      component: () => import('../views/Settings.vue'),
    },
  ],
})

export default router
