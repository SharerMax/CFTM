import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export interface Tunnel {
  id: string
  name: string
  accountId: string
  cloudflareTunnelId: string | null
  status: 'stopped' | 'running' | 'error'
  isRunning: boolean
  config: { tunnel: string, ingress: { hostname?: string, service: string, path?: string }[] }
  createdAt: string
}

export interface RemoteTunnel {
  id: string
  name: string
  created_at: string
  deleted_at: string | null
  config_src?: 'local' | 'cloudflare'
}

export interface RemoteConfig {
  'ingress': { hostname?: string, service: string, path?: string, originRequest?: Record<string, unknown> }[]
  'originRequest'?: Record<string, unknown>
  'warp-routing'?: { enabled: boolean }
}

export const useTunnelStore = defineStore('tunnels', () => {
  const tunnels = ref<Tunnel[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTunnels() {
    loading.value = true
    error.value = null
    try {
      tunnels.value = await api.get<Tunnel[]>('/tunnels')
    }
    catch (e) {
      error.value = (e as Error).message
    }
    finally {
      loading.value = false
    }
  }

  async function fetchTunnel(id: string) {
    return await api.get<Tunnel>(`/tunnels/${id}`)
  }

  async function createTunnel(name: string, accountId: string) {
    const tunnel = await api.post<Tunnel>('/tunnels', { name, accountId })
    tunnels.value.unshift(tunnel)
    return tunnel
  }

  async function deleteTunnel(id: string) {
    await api.delete(`/tunnels/${id}`)
    tunnels.value = tunnels.value.filter(t => t.id !== id)
  }

  async function startTunnel(id: string) {
    const res = await api.post<{ status: string }>(`/tunnels/${id}/start`)
    const tunnel = tunnels.value.find(t => t.id === id)
    if (tunnel) {
      tunnel.status = 'running'
      tunnel.isRunning = true
    }
    return res
  }

  async function stopTunnel(id: string) {
    const res = await api.post<{ status: string }>(`/tunnels/${id}/stop`)
    const tunnel = tunnels.value.find(t => t.id === id)
    if (tunnel) {
      tunnel.status = 'stopped'
      tunnel.isRunning = false
    }
    return res
  }

  async function listRemote(accountId: string) {
    return await api.get<RemoteTunnel[]>('/tunnels/remote', { params: { accountId } })
  }

  async function getRemoteConfig(accountId: string, tunnelId: string) {
    return await api.get<RemoteConfig>('/tunnels/remote/config', { params: { accountId, tunnelId } })
  }

  async function updateRemoteConfig(accountId: string, tunnelId: string, config: RemoteConfig) {
    return await api.put<RemoteConfig>('/tunnels/remote/config', { config }, { params: { accountId, tunnelId } })
  }

  return {
    tunnels,
    loading,
    error,
    fetchTunnels,
    fetchTunnel,
    createTunnel,
    deleteTunnel,
    startTunnel,
    stopTunnel,
    listRemote,
    getRemoteConfig,
    updateRemoteConfig,
  }
})

export function useTunnelStoreRefs() {
  const store = useTunnelStore()
  return storeToRefs(store)
}
