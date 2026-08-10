<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  useMessage,
} from 'naive-ui'
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const message = useMessage()

const token = ref('')

async function handleVerify() {
  if (!token.value.trim()) {
    message.warning('请输入 Cloudflare API Token')
    return
  }
  try {
    await authStore.verifyToken(token.value.trim())
    message.success('Token 验证成功')
  }
  catch (e) {
    message.error(`验证失败: ${(e as Error).message}`)
  }
}
</script>

<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">
      Settings
    </h2>
    <NCard title="Cloudflare API Token" class="max-w-2xl">
      <NAlert type="info" title="Token 说明" class="mb-4">
        需要一个拥有 Tunnel 和 DNS 编辑权限的 API Token。
        可在 Cloudflare 控制台 My Profile > API Tokens 创建。
      </NAlert>

      <NForm label-placement="top">
        <NFormItem label="API Token">
          <NInput
            v-model:value="token"
            type="password"
            placeholder="输入 Cloudflare API Token"
            show-password-on="click"
            clearable
          />
        </NFormItem>
        <NButton
          type="primary"
          :loading="authStore.checking"
          @click="handleVerify"
        >
          验证并保存
        </NButton>
      </NForm>

      <div v-if="authStore.configured" class="mt-4">
        <NAlert type="success">
          Token 已配置 (Token ID: {{ authStore.tokenId }})
        </NAlert>
      </div>
    </NCard>
  </div>
</template>
