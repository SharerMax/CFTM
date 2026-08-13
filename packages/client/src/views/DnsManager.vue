<script setup lang="ts">
import type { DnsRecordType, DnsRecordView, ZoneDTO } from '@cftm/shared/types'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import { createDnsRecordSchema } from '@cftm/shared/schemas'
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconMdiDelete from '~icons/mdi/delete'
import IconMdiPlus from '~icons/mdi/plus'
import IconMdiRefresh from '~icons/mdi/refresh'
import { api } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { useAccountStore } from '../stores/accounts'
import { useTunnelStore } from '../stores/tunnels'

const accountStore = useAccountStore()
const tunnelStore = useTunnelStore()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const zones = ref<ZoneDTO[]>([])
const zoneId = ref<string | null>(null)
const records = ref<DnsRecordView[]>([])
const loadingZones = ref(false)
const loadingRecords = ref(false)

const showCreate = ref(false)
const creating = ref(false)
const form = ref({
  name: '',
  type: 'CNAME' as DnsRecordType,
  content: '',
  proxied: true,
  tunnelId: null as string | null,
})

const activeAccountId = computed(() => accountStore.selectedCloudflareAccountId)

const hasAccount = computed(() => accountStore.accounts.length > 0)
const hasSelection = computed(() => !!(activeAccountId.value))

const zoneOptions = computed(() =>
  zones.value.map(z => ({ label: z.name, value: z.id })))

const tunnelOptions = computed(() =>
  tunnelStore.tunnels.map(t => ({ label: t.name, value: t.id })))

const typeOptions: SelectOption[] = [
  { label: 'CNAME', value: 'CNAME' },
  { label: 'A', value: 'A' },
  { label: 'AAAA', value: 'AAAA' },
]

async function loadZones() {
  if (!activeAccountId.value)
    return
  loadingZones.value = true
  try {
    zones.value = await api.get<ZoneDTO[]>('/zones', { params: { accountId: activeAccountId.value } })
    if (zoneId.value) {
      await loadRecords()
    }
    else if (zones.value.length > 0) {
      zoneId.value = zones.value[0].id
    }
  }
  catch (e) {
    message.error(`加载 Zone 失败: ${(e as Error).message}`)
  }
  finally {
    loadingZones.value = false
  }
}

async function loadRecords() {
  if (!zoneId.value || !activeAccountId.value)
    return
  loadingRecords.value = true
  try {
    records.value = await api.get<DnsRecordView[]>(`/zones/${zoneId.value}/records`, { params: { accountId: activeAccountId.value } })
  }
  catch (e) {
    message.error(`加载 DNS 记录失败: ${(e as Error).message}`)
  }
  finally {
    loadingRecords.value = false
  }
}

watch(zoneId, () => {
  loadRecords()
})

watch(() => accountStore.selectedAccountId, () => {
  zones.value = []
  zoneId.value = null
  records.value = []
  if (activeAccountId.value) {
    loadZones()
  }
})

function openCreate() {
  form.value = { name: '', type: 'CNAME', content: '', proxied: true, tunnelId: null }
  showCreate.value = true
}

function handleTunnelChange(value: string | null) {
  form.value.tunnelId = value
  if (value) {
    const tunnel = tunnelStore.tunnels.find(t => t.id === value)
    if (tunnel?.cloudflareTunnelId) {
      form.value.type = 'CNAME'
      form.value.content = `${tunnel.cloudflareTunnelId}.cfargotunnel.com`
    }
  }
}

async function handleCreate() {
  const payload: Record<string, unknown> = { ...form.value }
  if (!payload.tunnelId)
    delete payload.tunnelId

  const input = createDnsRecordSchema.safeParse({
    zoneId: zoneId.value!,
    ...payload,
  })

  if (!input.success) {
    message.warning('请检查填写内容')
    return
  }

  creating.value = true
  try {
    await api.post<DnsRecordView>(`/zones/${zoneId.value}/records`, input.data, { params: { accountId: activeAccountId.value! } })
    message.success('DNS 记录已创建')
    showCreate.value = false
    await loadRecords()
  }
  catch (e) {
    message.error(`创建失败: ${(e as Error).message}`)
  }
  finally {
    creating.value = false
  }
}

function handleDelete(record: DnsRecordView) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除 DNS 记录 "${record.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.delete(`/zones/${zoneId.value}/records/${record.id}`, { params: { accountId: activeAccountId.value! } })
        message.success('DNS 记录已删除')
        await loadRecords()
      }
      catch (e) {
        message.error(`删除失败: ${(e as Error).message}`)
      }
    },
  })
}

const columns: DataTableColumns<DnsRecordView> = [
  { title: '名称', key: 'name' },
  { title: '类型', key: 'type', width: 80 },
  { title: '内容', key: 'content' },
  {
    title: '代理',
    key: 'proxied',
    width: 80,
    render(row) {
      return row.proxied
        ? h(NTag, { type: 'success', size: 'small' }, { default: () => 'ON' })
        : h(NTag, { size: 'small' }, { default: () => 'OFF' })
    },
  },
  { title: 'TTL', key: 'ttl', width: 80 },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      return h(NButton, {
        size: 'small',
        type: 'error',
        onClick: () => handleDelete(row),
      }, {
        default: () => h(IconMdiDelete),
      })
    },
  },
]

onMounted(async () => {
  tunnelStore.fetchTunnels()
  if (activeAccountId.value) {
    await loadZones()
  }
})
</script>

<template>
  <div>
    <PageHeader
      title="DNS 管理"
      :crumbs="[{ label: '首页', to: '/' }, { label: 'DNS 管理' }]"
    >
      <template #actions>
        <NSpace v-if="hasSelection">
          <NSelect
            v-model:value="zoneId"
            :options="zoneOptions"
            placeholder="选择 Zone"
            style="width: 260px;"
            clearable
          />
          <NButton :disabled="!zoneId" @click="loadRecords">
            <template #icon>
              <IconMdiRefresh />
            </template>
            刷新
          </NButton>
          <NButton type="primary" :disabled="!zoneId" @click="openCreate">
            <template #icon>
              <IconMdiPlus />
            </template>
            新建记录
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NCard>
      <NEmpty
        v-if="!hasAccount"
        description="暂无账户，请先配置账户"
      >
        <template #extra>
          <NButton type="primary" @click="router.push('/accounts')">
            前往 Accounts
          </NButton>
        </template>
      </NEmpty>
      <NEmpty
        v-else-if="!hasSelection"
        description="请先在顶部选择具体账户以加载 Zone"
      />
      <NSpin v-else :show="loadingZones || loadingRecords">
        <NEmpty v-if="!zoneId" description="请选择 Zone" />
        <NEmpty v-else-if="records.length === 0 && !loadingRecords" description="暂无 DNS 记录" />
        <NDataTable v-else :columns="columns" :data="records" :bordered="false" />
      </NSpin>
    </NCard>

    <NModal v-model:show="showCreate" preset="dialog" title="新建 DNS 记录">
      <NForm label-placement="top">
        <NFormItem label="名称 (子域名)">
          <NInput v-model:value="form.name" placeholder="例如: www、api 或 @（根域名）" clearable />
        </NFormItem>
        <NFormItem label="类型">
          <NSelect v-model:value="form.type" :options="typeOptions" :disabled="!!form.tunnelId" />
        </NFormItem>
        <NFormItem label="内容">
          <NInput v-model:value="form.content" placeholder="IP 地址或 CNAME 目标" clearable />
        </NFormItem>
        <NFormItem label="关联隧道 (可选)">
          <NSelect
            v-model:value="form.tunnelId"
            :options="tunnelOptions"
            placeholder="选择隧道自动填充 CNAME"
            clearable
            @update:value="handleTunnelChange"
          />
        </NFormItem>
        <NFormItem label="Cloudflare 代理 (橙色云)">
          <NSwitch v-model:value="form.proxied" />
        </NFormItem>
      </NForm>
      <template #action>
        <NButton @click="showCreate = false">
          取消
        </NButton>
        <NButton type="primary" :loading="creating" @click="handleCreate">
          创建
        </NButton>
      </template>
    </NModal>
  </div>
</template>
