<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { RemoteTunnel, Tunnel } from '../stores/tunnels'
import { createTunnelSchema } from '@cftm/shared/schemas'
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NModal,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconMdiPlus from '~icons/mdi/plus'
import PageHeader from '../components/PageHeader.vue'
import { useAccountStore } from '../stores/accounts'
import { useTunnelStore } from '../stores/tunnels'

const tunnelStore = useTunnelStore()
const accountStore = useAccountStore()
const message = useMessage()
const dialog = useDialog()
const router = useRouter()

const showCreate = ref(false)
const creating = ref(false)
const name = ref('')
const createAccountId = ref<string | null>(null)

const activeTab = ref('local')
const remoteLoading = ref(false)
const remoteTunnels = ref<RemoteTunnel[]>([])

const accountOptions = computed(() =>
  accountStore.accounts.map(a => ({ label: a.name, value: a.id })))

const localTunnels = computed(() => {
  if (accountStore.selectedAccountId === 'all')
    return tunnelStore.tunnels
  const acc = accountStore.selectedAccount
  if (!acc)
    return tunnelStore.tunnels
  return tunnelStore.tunnels.filter(t => t.accountId === acc.cloudflareAccountId)
})

const remoteAccountId = computed(() =>
  accountStore.selectedCloudflareAccountId ?? '')

const isRemoteSupported = computed(() =>
  accountStore.selectedAccountId !== 'all' && !!remoteAccountId.value)

async function handleCreate() {
  const selected = accountStore.accounts.find(a => a.id === createAccountId.value)
  if (!selected) {
    message.warning('请选择账户')
    return
  }

  const input = createTunnelSchema.safeParse({
    name: name.value.trim(),
    accountId: selected.cloudflareAccountId,
  })

  if (!input.success) {
    message.warning('请填写有效的名称 (1-64 字符)')
    return
  }

  creating.value = true
  try {
    await tunnelStore.createTunnel(input.data.name, input.data.accountId)
    message.success('隧道创建成功')
    showCreate.value = false
    name.value = ''
    createAccountId.value = null
  }
  catch (e) {
    message.error(`创建失败: ${(e as Error).message}`)
  }
  finally {
    creating.value = false
  }
}

async function loadRemote() {
  if (!isRemoteSupported.value) {
    message.warning('请先在顶部选择具体账户')
    return
  }

  remoteLoading.value = true
  try {
    remoteTunnels.value = await tunnelStore.listRemote(remoteAccountId.value)
  }
  catch (e) {
    message.error(`加载失败: ${(e as Error).message}`)
  }
  finally {
    remoteLoading.value = false
  }
}

function openConfig(tunnel: RemoteTunnel) {
  router.push(`/tunnels/remote/${remoteAccountId.value}/${tunnel.id}`)
}

watch([() => activeTab.value, () => accountStore.selectedAccountId], () => {
  if (activeTab.value === 'remote' && isRemoteSupported.value)
    loadRemote()
})

const localColumns: DataTableColumns<Tunnel> = [
  {
    title: '名称',
    key: 'name',
    width: 200,
  },
  {
    title: '账户 ID',
    key: 'accountId',
    width: 280,
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      const map = {
        running: { type: 'success' as const, label: '运行中' },
        error: { type: 'error' as const, label: '错误' },
        stopped: { type: 'default' as const, label: '已停止' },
      }
      const { type, label } = map[row.status] || map.stopped
      return h(NTag, { type, size: 'small' }, { default: () => label })
    },
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render(row) {
      return new Date(row.createdAt).toLocaleString()
    },
  },
  {
    title: '操作',
    key: 'actions',
    render(row) {
      return h('div', { style: 'display:flex;gap:8px' }, [
        h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => router.push(`/tunnels/${row.id}`) }, { default: () => '详情' }),
        h(NButton, { size: 'small', text: true, type: 'error', onClick: () => handleDelete(row) }, { default: () => '删除' }),
      ])
    },
  },
]

const remoteColumns: DataTableColumns<RemoteTunnel> = [
  {
    title: '名称',
    key: 'name',
    width: 200,
  },
  {
    title: '隧道 ID',
    key: 'id',
    width: 280,
  },
  {
    title: '管理方式',
    key: 'config_src',
    width: 100,
    render(row) {
      const local = row.config_src === 'local'
      return h(NTag, { type: local ? 'warning' : 'primary', size: 'small' }, { default: () => local ? '本地托管' : '远程托管' })
    },
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 180,
    render(row) {
      return row.created_at ? new Date(row.created_at).toLocaleString() : '-'
    },
  },
  {
    title: '操作',
    key: 'actions',
    render(row) {
      const local = row.config_src === 'local'
      return h('div', { style: 'display:flex;gap:8px' }, [
        h(NButton, {
          size: 'small',
          text: true,
          type: 'primary',
          disabled: local,
          onClick: () => openConfig(row),
        }, {
          default: () => local ? '配置存储在源主机' : '编辑',
        }),
      ])
    },
  },
]

function handleDelete(tunnel: Tunnel) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除隧道 "${tunnel.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tunnelStore.deleteTunnel(tunnel.id)
        message.success('删除成功')
      }
      catch (e) {
        message.error(`删除失败: ${(e as Error).message}`)
      }
    },
  })
}

onMounted(() => {
  tunnelStore.fetchTunnels()
  if (activeTab.value === 'remote' && isRemoteSupported.value)
    loadRemote()
})
</script>

<template>
  <div>
    <PageHeader
      title="Tunnels"
      :crumbs="[{ label: '首页', to: '/' }, { label: '隧道' }]"
    >
      <template #actions>
        <NButton v-if="accountStore.accounts.length === 0" type="primary" @click="router.push('/accounts')">
          配置账户
        </NButton>
        <NButton v-else type="primary" @click="showCreate = true">
          <template #icon>
            <IconMdiPlus />
          </template>
          新建隧道
        </NButton>
      </template>
    </PageHeader>

    <NTabs v-if="accountStore.accounts.length > 0" v-model:value="activeTab" type="line">
      <NTabPane name="local" tab="本地管理">
        <NCard>
          <NSpin v-if="tunnelStore.loading" />
          <NEmpty v-else-if="localTunnels.length === 0" description="暂无本地隧道，点击上方按钮创建" />
          <NDataTable v-else :columns="localColumns" :data="localTunnels" :bordered="false" />
        </NCard>
      </NTabPane>

      <NTabPane name="remote" tab="远程管理">
        <NCard>
          <div class="mb-4 flex items-center gap-2">
            <span class="text-sm text-gray-500">
              当前账户: {{ accountStore.selectedAccountId === 'all' ? 'All accounts (请选择具体账户)' : (accountStore.selectedAccount?.name || '-') }}
            </span>
          </div>
          <NEmpty
            v-if="!isRemoteSupported"
            description="远程管理需要选择具体账户，请在顶部选择账户"
          />
          <template v-else>
            <NSpin v-if="remoteLoading" />
            <NEmpty v-else-if="remoteTunnels.length === 0" :description="`账户 ${accountStore.selectedAccount?.name || ''} 暂无远程隧道`" />
            <NDataTable v-else :columns="remoteColumns" :data="remoteTunnels" :bordered="false" />
          </template>
        </NCard>
      </NTabPane>
    </NTabs>
    <NEmpty v-else description="暂无账户，请先配置账户" class="mt-12">
      <template #extra>
        <NButton type="primary" @click="router.push('/accounts')">
          前往 Accounts
        </NButton>
      </template>
    </NEmpty>

    <NModal v-model:show="showCreate" preset="dialog" title="新建隧道">
      <NForm label-placement="top">
        <NFormItem label="名称">
          <NInput v-model:value="name" placeholder="隧道名称 (1-64 字符)" clearable />
        </NFormItem>
        <NFormItem label="账户">
          <NSelect
            v-model:value="createAccountId"
            :options="accountOptions"
            placeholder="选择账户"
            clearable
          />
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
