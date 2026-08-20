import type { CloudflaredPathResult } from '@cftm/shared/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useSettingsStore = defineStore('settings', () => {
  const cloudflaredPath = ref<string | null>(null)
  const loading = ref(false)
  const saving = ref(false)

  async function load() {
    loading.value = true
    try {
      const data = await api.get<{ path: string | null }>('/settings/cloudflared-path')
      cloudflaredPath.value = data.path
    }
    finally {
      loading.value = false
    }
  }

  async function save(path: string): Promise<CloudflaredPathResult> {
    saving.value = true
    try {
      const result = await api.put<CloudflaredPathResult>('/settings/cloudflared-path', { path })
      cloudflaredPath.value = result.path
      return result
    }
    finally {
      saving.value = false
    }
  }

  return {
    cloudflaredPath,
    loading,
    saving,
    load,
    save,
  }
})
