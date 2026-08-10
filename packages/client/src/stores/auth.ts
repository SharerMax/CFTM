import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const configured = ref(false)
  const tokenId = ref<string | null>(null)
  const checking = ref(false)
  const error = ref<string | null>(null)

  async function verifyToken(token: string) {
    checking.value = true
    error.value = null
    try {
      const res = await api.post<{ success: boolean, tokenId: string }>('/auth/verify', { token })
      configured.value = true
      tokenId.value = res.tokenId
    }
    catch (e) {
      error.value = (e as Error).message
      configured.value = false
      throw e
    }
    finally {
      checking.value = false
    }
  }

  async function checkStatus() {
    try {
      const res = await api.get<{ configured: boolean, tokenId?: string }>('/auth/status')
      configured.value = res.configured
      tokenId.value = res.tokenId || null
    }
    catch {
      configured.value = false
      tokenId.value = null
    }
  }

  return { configured, tokenId, checking, error, verifyToken, checkStatus }
})

export function useAuthStoreRefs() {
  const store = useAuthStore()
  return storeToRefs(store)
}
