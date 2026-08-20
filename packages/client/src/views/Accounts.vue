<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { Account } from '../stores/accounts'
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
import { h, onMounted, reactive, ref } from 'vue'
import IconMdiPlus from '~icons/mdi/plus'
import PageHeader from '../components/PageHeader.vue'
import { useAccountStore } from '../stores/accounts'

const accountStore = useAccountStore()
const message = useMessage()
const dialog = useDialog()

const showModal = ref(false)
const editing = ref<Account | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  cloudflareAccountId: '',
  token: '',
})

function openCreate() {
  editing.value = null
  form.name = ''
  form.cloudflareAccountId = ''
  form.token = ''
  showModal.value = true
}

function openEdit(account: Account) {
  editing.value = account
  form.name = account.name
  form.cloudflareAccountId = account.cloudflareAccountId
  form.token = ''
  showModal.value = true
}

async function handleSave() {
  if (!form.name.trim() || !form.cloudflareAccountId.trim()) {
    message.warning('请填写名称和 Cloudflare Account ID')
    return
  }

  saving.value = true
  try {
    if (editing.value) {
      await accountStore.updateAccount(editing.value.id, {
        name: form.name.trim(),
        cloudflareAccountId: form.cloudflareAccountId.trim(),
        ...(form.token.trim() ? { token: form.token } : {}),
      })
      message.success('账户已更新')
    }
    else {
      if (!form.token.trim()) {
        message.warning('请填写 API Token')
        return
      }
      await accountStore.createAccount({
        name: form.name.trim(),
        cloudflareAccountId: form.cloudflareAccountId.trim(),
        token: form.token,
      })
      message.success('账户已创建')
    }
    showModal.value = false
  }
  catch (e) {
    message.error(`保存失败: ${(e as Error).message}`)
  }
  finally {
    saving.value = false
  }
}

function handleDelete(account: Account) {
  const suffix = account.cloudflareAccountId ? ' 若仍有隧道引用该账户将无法删除。' : ''
  dialog.warning({
    title: '确认删除',
    content: `确定要删除账户 "${account.name}" 吗？${suffix}`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await accountStore.deleteAccount(account.id)
        message.success('账户已删除')
      }
      catch (e) {
        const msg = (e as Error).message
        message.error(msg === 'account_in_use'
          ? '无法删除：仍有本地隧道引用该账户，请先删除相关隧道'
          : `删除失败: ${msg}`)
      }
    },
  })
}

const columns: DataTableColumns<Account> = [
  {
    title: '名称',
    key: 'name',
    width: 160,
  },
  {
    title: '账户 ID',
    key: 'cloudflareAccountId',
    width: 260,
    render(row) {
      if (!row.cloudflareAccountId)
        return h(NTag, { type: 'warning', size: 'small' }, { default: () => '需补充' })
      return row.cloudflareAccountId
    },
  },
  {
    title: '令牌 ID',
    key: 'cloudflareTokenId',
    width: 240,
    render(row) {
      return row.cloudflareTokenId || '-'
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
        h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(row) }, { default: () => '编辑' }),
        h(NButton, { size: 'small', text: true, type: 'error', onClick: () => handleDelete(row) }, { default: () => '删除' }),
      ])
    },
  },
]

onMounted(() => {
  accountStore.loadAccounts()
})
</script>

<template>
  <div>
    <PageHeader
      title="账户"
      :crumbs="[{ label: '首页', to: '/' }, { label: '账户' }]"
    >
      <template #actions>
        <NButton type="primary" @click="openCreate">
          <template #icon>
            <IconMdiPlus />
          </template>
          新建账户
        </NButton>
      </template>
    </PageHeader>

    <NCard>
      <NSpin v-if="accountStore.loading" />
      <NEmpty v-else-if="accountStore.accounts.length === 0" description="暂无账户，点击右上角创建" />
      <NDataTable v-else :columns="columns" :data="accountStore.accounts" :bordered="false" />
    </NCard>

    <NModal v-model:show="showModal" preset="dialog" :title="editing ? '编辑账户' : '新建账户'">
      <NForm label-placement="top">
        <NFormItem label="显示名称">
          <NInput v-model:value="form.name" placeholder="例如: 主账户 (1-64 字符)" clearable />
        </NFormItem>
        <NFormItem label="Cloudflare Account ID">
          <NInput v-model:value="form.cloudflareAccountId" placeholder="Cloudflare Account ID" clearable />
        </NFormItem>
        <NFormItem :label="editing ? 'API Token (留空则不修改)' : 'API Token'">
          <NInput
            v-model:value="form.token"
            type="password"
            placeholder="输入 Cloudflare API Token"
            show-password-on="click"
            clearable
          />
        </NFormItem>
      </NForm>
      <template #action>
        <NButton @click="showModal = false">
          取消
        </NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">
          保存并验证
        </NButton>
      </template>
    </NModal>
  </div>
</template>
