import { useOsTheme } from 'naive-ui'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'cftm-theme-mode'
const VALID_MODES: ThemeMode[] = ['light', 'dark', 'system']

export const useThemeStore = defineStore('theme', () => {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  const mode = ref<ThemeMode>(saved && VALID_MODES.includes(saved) ? saved : 'system')

  const osTheme = useOsTheme()

  const isDark = computed(() => {
    if (mode.value === 'dark')
      return true
    if (mode.value === 'light')
      return false
    return osTheme.value === 'dark'
  })

  function setMode(value: ThemeMode) {
    mode.value = value
    localStorage.setItem(STORAGE_KEY, value)
  }

  function toggle() {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    setMode(order[(order.indexOf(mode.value) + 1) % order.length])
  }

  return { mode, isDark, setMode, toggle }
})
