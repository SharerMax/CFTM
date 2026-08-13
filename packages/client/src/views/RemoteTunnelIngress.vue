<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { RemoteTunnel } from '../stores/tunnels'
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NEmpty,
  NSpin,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconMdiPlus from '~icons/mdi/plus'
import PageHeader from '../components/PageHeader.vue'
import { useTunnelStore } from '../stores/tunnels'

interface IngressRow {
  index: number
  hostname?: string
  service: string
  path?: string
}

const route = useRoute()
const router = useRouter()
const tunnelStore = useTunnelStore()
const message = useMessage()
const dialog = useDialog()

const accountId = computed(() => route.params.accountId as string)
const tunnelId = computed(() => route.params.tunnelId as string)

const tunnel = ref<RemoteTunnel | null>(null)
const loading = ref(true)
const saving = ref(false)

const rows = ref<IngressRow[]>([])

const catchAll = ref<{ hostname?: string, service: string, path?: string } | null>(null)

const ingressRules = computed(() =>
  rows.value.map(r => ({
    hostname: r.hostname || undefined,
    service: r.service,
    path: r.path || undefined,
  })))

async function load() {
  loading.value = true
  try {
    const config = await tunnelStore.getRemoteConfig(accountId.value, tunnelId.value)
    const ingress = config.ingress || []
    const rules = [...ingress]
    const last = rules.pop()
    catchAll.value = last ?? null
    rows.value = rules.map((r, index) => ({
      index,
      hostname: r.hostname,
      service: r.service,
      path: r.path,
    }))
  }
  catch (e) {
    message.error(`加载配置失败: ${(e as Error).message}`)
  }
  finally {
    loading.value = false
  }
}

function addRule() {
  router.push(`/tunnels/remote/${accountId.value}/${tunnelId.value}/ingress/new`)
}

function removeRow(index: number) {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这条 ingress 规则吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      rows.value.splice(index, 1)
      rows.value.forEach((r, i) => {
        r.index = i
      })
    },
  })
}

function editRow(index: number) {
  router.push(`/tunnels/remote/${accountId.value}/${tunnelId.value}/ingress/${index}`)
}

const columns: DataTableColumns<IngressRow> = [
  {
    title: '#',
    key: 'index',
    width: 60,
    render(row) {
      return h('span', { style: 'color:#888' }, `${row.index + 1}`)
    },
  },
  {
    title: 'Hostname',
    key: 'hostname',
    render(row) {
      return row.hostname ? h('span', row.hostname) : h('span', { style: 'color:#999' }, '（全部）')
    },
  },
  {
    title: 'Path',
    key: 'path',
    render(row) {
      return row.path ? h('span', row.path) : h('span', { style: 'color:#999' }, '（全部）')
    },
  },
  {
    title: 'Service',
    key: 'service',
    render(row) {
      return h('code', { style: 'background:rgba(128,128,128,.1);padding:2px 6px;border-radius:4px' }, row.service)
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render(row) {
      return h('div', { style: 'display:flex;gap:8px' }, [
        h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => editRow(row.index) }, { default: () => '编辑' }),
        h(NButton, { size: 'small', text: true, type: 'error', onClick: () => removeRow(row.index) }, { default: () => '删除' }),
      ])
    },
  },
]

async function save() {
  const valid = rows.value.filter(r => r.service.trim())
  if (valid.length === 0) {
    message.warning('至少需要一条 ingress 规则')
    return
  }
  if (valid.length !== rows.value.length) {
    message.warning('存在空的 service，无法保存')
    return
  }

  saving.value = true
  try {
    const config = await tunnelStore.getRemoteConfig(accountId.value, tunnelId.value)
    await tunnelStore.updateRemoteConfig(accountId.value, tunnelId.value, {
      ...config,
      ingress: [...ingressRules.value, ...(catchAll.value ? [catchAll.value] : [])],
    })
    message.success('配置已保存')
    await load()
  }
  catch (e) {
    message.error(`保存失败: ${(e as Error).message}`)
  }
  finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const list = await tunnelStore.listRemote(accountId.value)
    tunnel.value = list.find(t => t.id === tunnelId.value) || null
  }
  catch {
    tunnel.value = null
  }
  await load()
})
</script>

<template>
  <div>
    <PageHeader
      title="Ingress 规则"
      :crumbs="[
        { label: '首页', to: '/' },
        { label: '隧道', to: '/' },
        { label: tunnel?.name || '远程隧道' },
        { label: 'Ingress 规则' },
      ]"
    />

    <NCard>
      <template #header>
        <div class="w-full flex items-center justify-between">
          <span>Ingress 规则列表</span>
          <div class="flex items-center gap-2">
            <NButton size="small" type="primary" ghost @click="addRule">
              <template #icon>
                <IconMdiPlus />
              </template>
              添加规则
            </NButton>
            <NButton size="small" type="primary" :loading="saving" @click="save">
              保存
            </NButton>
          </div>
        </div>
      </template>
      <NSpin v-if="loading" />
      <template v-else>
        <NEmpty v-if="rows.length === 0" description="暂无 ingress 规则，点击右上角添加" />
        <NDataTable v-else :columns="columns" :data="rows" :bordered="false" />
        <p class="mt-2 text-xs text-gray-500">
          点击规则行的"编辑"进入详细配置；每条规则支持 hostname / path / service 及各项 origin 参数。
        </p>

        <NDivider />

        <div class="mb-2 flex items-center gap-2">
          <span class="text-sm font-medium">兜底规则（Catch-all）</span>
          <NTag size="small" type="warning">
            匹配所有流量
          </NTag>
          <div class="flex-1" />
          <NButton size="small" text type="primary" @click="editRow(rows.length)">
            编辑
          </NButton>
        </div>
        <p v-if="!catchAll" class="text-sm text-gray-500">
          暂无兜底规则
        </p>
        <NDescriptions v-else :column="1" bordered size="small">
          <NDescriptionsItem label="Service">
            {{ catchAll.service }}
          </NDescriptionsItem>
        </NDescriptions>
      </template>
    </NCard>
  </div>
</template>
