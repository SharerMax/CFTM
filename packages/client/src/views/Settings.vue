<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { onMounted, ref } from 'vue'
import IconMdiContentSave from '~icons/mdi/content-save'
import PageHeader from '../components/PageHeader.vue'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()
const message = useMessage()

const path = ref('')
const detectedVersion = ref<string | null>(null)
const detectedAt = ref('')

onMounted(async () => {
  await settingsStore.load()
  path.value = settingsStore.cloudflaredPath || ''
})

async function handleSave() {
  try {
    const result = await settingsStore.save(path.value)
    if (result.path) {
      detectedVersion.value = result.version
      detectedAt.value = new Date().toLocaleString()
      message.success('cloudflared 路径已保存')
    }
    else {
      detectedVersion.value = null
      detectedAt.value = ''
      message.success('已恢复默认，将使用 PATH 中的 cloudflared')
    }
  }
  catch (e) {
    message.error(`保存失败: ${(e as Error).message}`)
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="设置"
      :crumbs="[{ label: '首页', to: '/' }, { label: '设置' }]"
    />

    <NCard title="cloudflared 路径">
      <NAlert type="info" class="mb-4">
        指定用于启动隧道的 cloudflared 可执行文件路径。留空则使用 PATH 中的 cloudflared。
      </NAlert>

      <NForm label-placement="top">
        <NFormItem label="可执行文件路径">
          <NInput
            v-model:value="path"
            placeholder="例如: C:\cloudflared\cloudflared.exe 或 /usr/local/bin/cloudflared"
            clearable
          />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace align="center">
          <NButton type="primary" :loading="settingsStore.saving" @click="handleSave">
            <template #icon>
              <IconMdiContentSave />
            </template>
            保存并验证
          </NButton>
          <NText v-if="detectedVersion" depth="3">
            已检测版本: {{ detectedVersion }}
            <NText depth="3" class="ml-2">
              ({{ detectedAt }})
            </NText>
          </NText>
        </NSpace>
      </template>
    </NCard>
  </div>
</template>
