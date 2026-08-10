<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { Tunnel } from '../stores/tunnels'
import { createTunnelSchema } from '@cftm/shared/schemas'
import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpin,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import IconMdiPlus from '~icons/mdi/plus'
import { useAuthStore } from '../stores/auth'
import { useTunnelStore } from '../stores/tunnels'

const tunnelStore = useTunnelStore()
const authStore = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const router = useRouter()

const showCreate = ref(false)
const creating = ref(false)
const name = ref('')
const accountId = ref('')

async function handleCreate() {
  const input = createTunnelSchema.safeParse({
    name: name.value.trim(),
    accountId: accountId.value.trim(),
  })

  if (!input.success) {
    message.warning('请填写有效的名称 (1-64 字符) 和 Account ID')
    return
  }

  creating.value = true
  try {
    await tunnelStore.createTunnel(input.data.name, input.data.accountId)
    message.success('隧道创建成功')
    showCreate.value = false
    name.value = ''
    accountId.value = ''
  }
  catch (e) {
    message.error(`创建失败: ${(e as Error).message}`)
  }
  finally {
    creating.value = false
  }
}

const columns: DataTableColumns<Tunnel> = [
  {
    title: 'Name',
    key: 'name',
    width: 200,
  },
  {
    title: 'Account ID',
    key: 'accountId',
    width: 280,
  },
  {
    title: 'Status',
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
    title: 'Created',
    key: 'createdAt',
    width: 180,
    render(row) {
      return new Date(row.createdAt).toLocaleString()
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    render(row) {
      return h('div', { style: 'display:flex;gap:8px' }, [
        h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => router.push(`/tunnels/${row.id}`) }, { default: () => '详情' }),
        h(NButton, { size: 'small', text: true, type: 'error', onClick: () => handleDelete(row) }, { default: () => '删除' }),
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
  if (authStore.configured) {
    tunnelStore.fetchTunnels()
  }
})
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold">
        Tunnels
      </h2>
      <NButton v-if="!authStore.configured" type="primary" @click="router.push('/settings')">
        配置 Token
      </NButton>
      <NButton v-else type="primary" @click="showCreate = true">
        <template #icon>
          <IconMdiPlus />
        </template>
        新建隧道
      </NButton>
    </div>

    <NModal v-model:show="showCreate" preset="dialog" title="新建隧道">
      <NForm label-placement="top">
        <NFormItem label="名称">
          <NInput v-model:value="name" placeholder="隧道名称 (1-64 字符)" clearable />
        </NFormItem>
        <NFormItem label="Account ID">
          <NInput v-model:value="accountId" placeholder="Cloudflare Account ID" clearable />
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

    <NCard>
      <NSpin v-if="tunnelStore.loading" />
      <NEmpty v-else-if="tunnelStore.tunnels.length === 0" description="暂无隧道，点击上方按钮创建" />
      <NDataTable v-else :columns="columns" :data="tunnelStore.tunnels" :bordered="false" />
    </NCard>
  </div>
</template>
