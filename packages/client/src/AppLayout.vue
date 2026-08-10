<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import {
  NBadge,
  NButton,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutSider,
  NMenu,
  useLoadingBar,
} from 'naive-ui'
import { h, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import IconMdiCog from '~icons/mdi/cog'
import IconMdiDns from '~icons/mdi/dns'
import IconMdiThemeLightDark from '~icons/mdi/theme-light-dark'
import IconMdiTunnel from '~icons/mdi/tunnel'
import IconMdiWeatherNight from '~icons/mdi/weather-night'
import IconMdiWhiteBalanceSunny from '~icons/mdi/white-balance-sunny'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const router = useRouter()
const loadingBar = useLoadingBar()

const collapsed = ref(false)

const menuOptions: MenuOption[] = [
  {
    label: () => h(RouterLink, { to: '/' }, { default: () => 'Tunnels' }),
    key: '/',
    icon: () => h(NIcon, null, { default: () => h(IconMdiTunnel) }),
  },
  {
    label: () => h(RouterLink, { to: '/dns' }, { default: () => 'DNS' }),
    key: '/dns',
    icon: () => h(NIcon, null, { default: () => h(IconMdiDns) }),
  },
  {
    label: () => h(RouterLink, { to: '/settings' }, { default: () => 'Settings' }),
    key: '/settings',
    icon: () => h(NIcon, null, { default: () => h(IconMdiCog) }),
  },
]

function handleMenuUpdate(key: string) {
  router.push(key)
}

const removeBeforeEach = router.beforeEach(() => {
  loadingBar.start()
})
const removeAfterEach = router.afterEach(() => {
  loadingBar.finish()
})

onUnmounted(() => {
  removeBeforeEach()
  removeAfterEach()
})
</script>

<template>
  <NLayout has-sider position="absolute">
    <NLayoutSider
      v-model:collapsed="collapsed"
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      show-trigger
      content-style="padding: 16px;"
    >
      <div class="mb-6 flex items-center gap-2 px-2">
        <span class="text-primary text-lg font-bold">CFTM</span>
        <NBadge :type="authStore.configured ? 'success' : 'warning'" dot />
      </div>
      <NMenu
        :options="menuOptions"
        :value="$route.path"
        @update:value="handleMenuUpdate"
      />
      <div v-if="!collapsed" class="absolute bottom-4 left-4 right-4 flex flex-col items-center gap-2 text-xs text-gray-400">
        <div class="flex items-center gap-1">
          <NButton
            quaternary
            size="small"
            :type="themeStore.mode === 'light' ? 'primary' : 'default'"
            title="浅色"
            @click="themeStore.setMode('light')"
          >
            <template #icon>
              <NIcon><IconMdiWhiteBalanceSunny /></NIcon>
            </template>
          </NButton>
          <NButton
            quaternary
            size="small"
            :type="themeStore.mode === 'dark' ? 'primary' : 'default'"
            title="深色"
            @click="themeStore.setMode('dark')"
          >
            <template #icon>
              <NIcon><IconMdiWeatherNight /></NIcon>
            </template>
          </NButton>
          <NButton
            quaternary
            size="small"
            :type="themeStore.mode === 'system' ? 'primary' : 'default'"
            title="跟随系统"
            @click="themeStore.setMode('system')"
          >
            <template #icon>
              <NIcon><IconMdiThemeLightDark /></NIcon>
            </template>
          </NButton>
        </div>
        <div>
          {{ authStore.configured ? 'Token 已配置' : 'Token 未配置' }}
        </div>
      </div>
    </NLayoutSider>
    <NLayoutContent content-style="padding: 24px;">
      <RouterView />
    </NLayoutContent>
  </NLayout>
</template>
