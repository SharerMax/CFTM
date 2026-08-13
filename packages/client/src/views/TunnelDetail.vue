<script setup lang="ts">
import type { Tunnel } from '../stores/tunnels'
import {
  NButton,
  NButtonGroup,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { parse, stringify } from 'yaml'
import IconMdiContentSave from '~icons/mdi/content-save'
import IconMdiDelete from '~icons/mdi/delete'
import IconMdiFormatAlignLeft from '~icons/mdi/format-align-left'
import IconMdiPlay from '~icons/mdi/play'
import IconMdiStop from '~icons/mdi/stop'
import { api } from '../api'
import CodeEditor from '../components/CodeEditor.vue'
import PageHeader from '../components/PageHeader.vue'
import { useThemeStore } from '../stores/theme'
import { useTunnelStore } from '../stores/tunnels'

const route = useRoute()
const router = useRouter()
const tunnelStore = useTunnelStore()
const themeStore = useThemeStore()
const message = useMessage()
const dialog = useDialog()

const tunnel = ref<Tunnel | null>(null)
const loading = ref(true)
const saving = ref(false)
const configText = ref('')
const configError = ref<string | null>(null)
const editMode = ref<'json' | 'yaml'>('json')

const tunnelId = computed(() => route.params.id as string)

function parseConfig(): object {
  return editMode.value === 'yaml'
    ? parse(configText.value)
    : JSON.parse(configText.value)
}

onMounted(async () => {
  try {
    tunnel.value = await tunnelStore.fetchTunnel(tunnelId.value)
    configText.value = JSON.stringify(tunnel.value.config, null, 2)
  }
  catch (e) {
    message.error(`加载失败: ${(e as Error).message}`)
  }
  finally {
    loading.value = false
  }
})

watch(configText, () => {
  try {
    parseConfig()
    configError.value = null
  }
  catch (e) {
    configError.value = (e as Error).message
  }
})

function switchMode(mode: 'json' | 'yaml') {
  if (mode === editMode.value)
    return
  try {
    const obj = parseConfig()
    configText.value = mode === 'yaml'
      ? stringify(obj, { indent: 2 })
      : JSON.stringify(obj, null, 2)
    editMode.value = mode
  }
  catch {
    message.error('当前配置存在语法错误，无法切换格式')
  }
}

function handleFormat() {
  try {
    const obj = parseConfig()
    configText.value = editMode.value === 'yaml'
      ? stringify(obj, { indent: 2 })
      : JSON.stringify(obj, null, 2)
  }
  catch {
    message.error('配置格式错误，无法格式化')
  }
}

async function handleSave() {
  if (configError.value) {
    message.error('配置格式错误，无法保存')
    return
  }

  saving.value = true
  try {
    const config = parseConfig()
    await api.put(`/tunnels/${tunnelId.value}/config`, config)
    message.success(tunnel.value?.isRunning ? '配置已保存，重启隧道后生效' : '配置已保存')
  }
  catch (e) {
    message.error(`保存失败: ${(e as Error).message}`)
  }
  finally {
    saving.value = false
  }
}

async function handleStart() {
  try {
    await tunnelStore.startTunnel(tunnelId.value)
    message.success('隧道已启动')
    tunnel.value = await tunnelStore.fetchTunnel(tunnelId.value)
  }
  catch (e) {
    message.error(`启动失败: ${(e as Error).message}`)
  }
}

async function handleStop() {
  try {
    await tunnelStore.stopTunnel(tunnelId.value)
    message.success('隧道已停止')
    tunnel.value = await tunnelStore.fetchTunnel(tunnelId.value)
  }
  catch (e) {
    message.error(`停止失败: ${(e as Error).message}`)
  }
}

function handleDelete() {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除隧道 "${tunnel.value?.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tunnelStore.deleteTunnel(tunnelId.value)
        message.success('删除成功')
        router.push('/')
      }
      catch (e) {
        message.error(`删除失败: ${(e as Error).message}`)
      }
    },
  })
}
</script>

<template>
  <div>
    <PageHeader
      title="隧道详情"
      :crumbs="[{ label: '首页', to: '/' }, { label: '隧道', to: '/' }, { label: tunnel?.name || '隧道详情' }]"
    />

    <NSpin v-if="loading" />
    <NEmpty v-else-if="!tunnel" description="隧道不存在" />

    <template v-else>
      <NCard class="mb-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">
              {{ tunnel.name }}
            </h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ tunnel.accountId }}
            </p>
          </div>
          <NSpace>
            <NTag :type="tunnel.isRunning ? 'success' : tunnel.status === 'error' ? 'error' : 'default'">
              {{ tunnel.isRunning ? '运行中' : tunnel.status === 'error' ? '错误' : '已停止' }}
            </NTag>
            <NButton v-if="!tunnel.isRunning" type="success" size="small" @click="handleStart">
              <template #icon>
                <IconMdiPlay />
              </template>
              启动
            </NButton>
            <NButton v-else type="warning" size="small" @click="handleStop">
              <template #icon>
                <IconMdiStop />
              </template>
              停止
            </NButton>
            <NButton type="error" size="small" @click="handleDelete">
              <template #icon>
                <IconMdiDelete />
              </template>
              删除
            </NButton>
          </NSpace>
        </div>
      </NCard>

      <NTabs type="line">
        <NTabPane name="config" tab="配置">
          <NCard>
            <template #header>
              <div class="w-full flex items-center justify-between">
                <span>隧道配置</span>
                <NSpace>
                  <NButtonGroup size="small">
                    <NButton :type="editMode === 'json' ? 'primary' : 'default'" @click="switchMode('json')">
                      JSON
                    </NButton>
                    <NButton :type="editMode === 'yaml' ? 'primary' : 'default'" @click="switchMode('yaml')">
                      YAML
                    </NButton>
                  </NButtonGroup>
                  <NButton size="small" :disabled="!!configError" @click="handleFormat">
                    <template #icon>
                      <IconMdiFormatAlignLeft />
                    </template>
                    格式化
                  </NButton>
                  <NButton
                    type="primary"
                    size="small"
                    :loading="saving"
                    :disabled="!!configError"
                    @click="handleSave"
                  >
                    <template #icon>
                      <IconMdiContentSave />
                    </template>
                    保存
                  </NButton>
                </NSpace>
              </div>
            </template>
            <div v-if="configError" class="mb-2 text-sm text-red-500">
              {{ editMode === 'yaml' ? 'YAML' : 'JSON' }} 格式错误: {{ configError }}
            </div>
            <CodeEditor v-model="configText" :language="editMode" :dark="themeStore.isDark" style="height: 400px;" />
          </NCard>
        </NTabPane>

        <NTabPane name="info" tab="信息">
          <NCard>
            <NDescriptions :column="1" bordered>
              <NDescriptionsItem label="Tunnel ID">
                {{ tunnel.cloudflareTunnelId || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="Account ID">
                {{ tunnel.accountId }}
              </NDescriptionsItem>
              <NDescriptionsItem label="创建时间">
                {{ new Date(tunnel.createdAt).toLocaleString() }}
              </NDescriptionsItem>
              <NDescriptionsItem label="Ingress 规则数量">
                {{ tunnel.config.ingress?.length || 0 }}
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>
        </NTabPane>

        <NTabPane name="logs" tab="日志">
          <NCard>
            <template #header-extra>
              <RouterLink :to="`/tunnels/${tunnelId}/logs`">
                <NButton size="small" text type="primary">
                  查看实时日志
                </NButton>
              </RouterLink>
            </template>
            <p class="text-sm text-gray-500">
              点击上方链接查看实时日志流
            </p>
          </NCard>
        </NTabPane>
      </NTabs>
    </template>
  </div>
</template>
