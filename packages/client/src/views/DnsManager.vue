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
import IconMdiDelete from '~icons/mdi/delete'
import IconMdiPlus from '~icons/mdi/plus'
import IconMdiRefresh from '~icons/mdi/refresh'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { useTunnelStore } from '../stores/tunnels'

const authStore = useAuthStore()
const tunnelStore = useTunnelStore()
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
  loadingZones.value = true
  try {
    zones.value = await api.get<ZoneDTO[]>('/zones')
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
  if (!zoneId.value)
    return
  loadingRecords.value = true
  try {
    records.value = await api.get<DnsRecordView[]>(`/zones/${zoneId.value}/records`)
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
    await api.post<DnsRecordView>(`/zones/${zoneId.value}/records`, input.data)
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
        await api.delete(`/zones/${zoneId.value}/records/${record.id}`)
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
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type', width: 80 },
  { title: 'Content', key: 'content' },
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
  await authStore.checkStatus()
  if (authStore.configured) {
    await Promise.all([loadZones(), tunnelStore.fetchTunnels()])
  }
})
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold">
        DNS 管理
      </h2>
      <NSpace>
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
    </div>

    <NCard>
      <NSpin :show="loadingZones || loadingRecords">
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
