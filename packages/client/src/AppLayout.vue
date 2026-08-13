<script setup lang="ts">
import type { MenuOption, SelectOption } from 'naive-ui'
import {
  NBadge,
  NButton,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NSelect,
  useLoadingBar,
} from 'naive-ui'
import { computed, h, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import IconMdiAccountGroup from '~icons/mdi/account-group'
import IconMdiDns from '~icons/mdi/dns'
import IconMdiThemeLightDark from '~icons/mdi/theme-light-dark'
import IconMdiTunnel from '~icons/mdi/tunnel'
import IconMdiWeatherNight from '~icons/mdi/weather-night'
import IconMdiWhiteBalanceSunny from '~icons/mdi/white-balance-sunny'
import { useAccountStore } from './stores/accounts'
import { useThemeStore } from './stores/theme'

const accountStore = useAccountStore()
const themeStore = useThemeStore()
const router = useRouter()
const loadingBar = useLoadingBar()

const collapsed = ref(false)

const menuOptions: MenuOption[] = [
  {
    label: () => h(RouterLink, { to: '/' }, { default: () => '隧道' }),
    key: '/',
    icon: () => h(NIcon, null, { default: () => h(IconMdiTunnel) }),
  },
  {
    label: () => h(RouterLink, { to: '/dns' }, { default: () => 'DNS 管理' }),
    key: '/dns',
    icon: () => h(NIcon, null, { default: () => h(IconMdiDns) }),
  },
  {
    label: () => h(RouterLink, { to: '/accounts' }, { default: () => '账户' }),
    key: '/accounts',
    icon: () => h(NIcon, null, { default: () => h(IconMdiAccountGroup) }),
  },
]

const accountOptions = computed<SelectOption[]>(() => [
  { label: '全部账户', value: 'all' },
  ...accountStore.accounts.map(a => ({
    label: a.name,
    value: a.id,
  })),
])

function handleMenuUpdate(key: string) {
  router.push(key)
}

function handleAccountUpdate(value: string) {
  accountStore.setSelected(value)
}

const removeBeforeEach = router.beforeEach(() => {
  loadingBar.start()
})
const removeAfterEach = router.afterEach(() => {
  loadingBar.finish()
})

onMounted(() => {
  accountStore.loadAccounts()
})

onUnmounted(() => {
  removeBeforeEach()
  removeAfterEach()
})
</script>

<template>
  <NLayout position="absolute">
    <NLayoutHeader bordered class="h-16">
      <div class="h-full flex items-center px-4">
        <div class="flex items-center gap-2 px-2">
          <span class="text-primary text-lg font-bold">CFTM</span>
          <NBadge
            :type="accountStore.accounts.length > 0 ? 'success' : 'warning'"
            :value="accountStore.accounts.length"
            :max="99"
          />
        </div>
        <div class="ml-a">
          <NSelect
            :value="accountStore.selectedAccountId"
            :options="accountOptions"
            placeholder="选择账户"
            style="width: 220px;"
            @update:value="handleAccountUpdate"
          />
        </div>
      </div>
    </NLayoutHeader>

    <NLayout has-sider position="absolute" style="top: 4rem">
      <NLayoutSider
        v-model:collapsed="collapsed"
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="240"
        show-trigger
      >
        <NMenu
          :options="menuOptions"
          :value="$route.path"
          :collapsed="collapsed"
          :collapsed-width="64"
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
            {{ accountStore.accounts.length > 0 ? `${accountStore.accounts.length} 个账户` : '未配置账户' }}
          </div>
        </div>
      </NLayoutSider>
      <NLayoutContent content-style="padding: 24px;">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>
