<script setup lang="ts">
import type { OriginRequest } from '@cftm/shared/types'
import type { FormInst, FormRules } from 'naive-ui'
import type { RemoteTunnel } from '../stores/tunnels'
import {
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpin,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconMdiContentSave from '~icons/mdi/content-save'
import PageHeader from '../components/PageHeader.vue'
import { useTunnelStore } from '../stores/tunnels'

const route = useRoute()
const router = useRouter()
const tunnelStore = useTunnelStore()
const message = useMessage()

const accountId = computed(() => route.params.accountId as string)
const tunnelId = computed(() => route.params.tunnelId as string)
const index = computed(() => Number(route.params.index))
const isNew = computed(() => route.params.index === 'new')

const loading = ref(true)
const saving = ref(false)
const formRef = ref<FormInst | null>(null)
const tunnel = ref<RemoteTunnel | null>(null)

const rule = ref({
  hostname: '',
  path: '',
  service: '',
})

const origin = ref({
  originServerName: '',
  matchSNItoHost: false,
  caPool: '',
  noTLSVerify: false,
  tlsTimeout: '',
  http2Origin: false,
  httpHostHeader: '',
  disableChunkedEncoding: false,
  connectTimeout: '',
  noHappyEyeballs: false,
  proxyType: '',
  keepAliveTimeout: '',
  keepAliveConnections: undefined as number | undefined,
  tcpKeepAlive: '',
})

const access = ref({
  required: false,
  teamName: '',
  audTags: '',
})

const rules: FormRules = {
  service: { required: true, trigger: ['blur', 'input'], message: 'service 为必填项' },
}

const proxyTypeOptions = [
  { label: '普通代理', value: '' },
  { label: 'SOCKS5', value: 'socks' },
]

onMounted(async () => {
  try {
    const list = await tunnelStore.listRemote(accountId.value)
    tunnel.value = list.find(t => t.id === tunnelId.value) || null
  }
  catch {
    tunnel.value = null
  }
  if (isNew.value) {
    loading.value = false
    return
  }
  try {
    const config = await tunnelStore.getRemoteConfig(accountId.value, tunnelId.value)
    const ingress = config.ingress?.[index.value]
    if (!ingress) {
      message.error('规则不存在')
      router.push(`/tunnels/remote/${accountId.value}/${tunnelId.value}`)
      return
    }
    rule.value.hostname = ingress.hostname ?? ''
    rule.value.path = ingress.path ?? ''
    rule.value.service = ingress.service

    const o: OriginRequest = ingress.originRequest ?? {}
    origin.value.originServerName = o.originServerName ?? ''
    origin.value.matchSNItoHost = o.matchSNItoHost ?? false
    origin.value.caPool = o.caPool ?? ''
    origin.value.noTLSVerify = o.noTLSVerify ?? false
    origin.value.tlsTimeout = o.tlsTimeout ?? ''
    origin.value.http2Origin = o.http2Origin ?? false
    origin.value.httpHostHeader = o.httpHostHeader ?? ''
    origin.value.disableChunkedEncoding = o.disableChunkedEncoding ?? false
    origin.value.connectTimeout = o.connectTimeout ?? ''
    origin.value.noHappyEyeballs = o.noHappyEyeballs ?? false
    origin.value.proxyType = o.proxyType ?? ''
    origin.value.keepAliveTimeout = o.keepAliveTimeout ?? ''
    origin.value.keepAliveConnections = o.keepAliveConnections
    origin.value.tcpKeepAlive = o.tcpKeepAlive ?? ''
    access.value.required = o.access?.required ?? false
    access.value.teamName = o.access?.teamName ?? ''
    access.value.audTags = o.access?.audTag?.join('\n') ?? ''
  }
  catch (e) {
    message.error(`加载失败: ${(e as Error).message}`)
  }
  finally {
    loading.value = false
  }
})

function collectOriginRequest(): OriginRequest {
  const result: OriginRequest = {}
  const { originServerName, matchSNItoHost, caPool, noTLSVerify, tlsTimeout, http2Origin, httpHostHeader, disableChunkedEncoding, connectTimeout, noHappyEyeballs, proxyType, keepAliveTimeout, keepAliveConnections, tcpKeepAlive } = origin.value

  if (originServerName.trim())
    result.originServerName = originServerName.trim()
  if (matchSNItoHost)
    result.matchSNItoHost = true
  if (caPool.trim())
    result.caPool = caPool.trim()
  if (noTLSVerify)
    result.noTLSVerify = true
  if (tlsTimeout.trim())
    result.tlsTimeout = tlsTimeout.trim()
  if (http2Origin)
    result.http2Origin = true
  if (httpHostHeader.trim())
    result.httpHostHeader = httpHostHeader.trim()
  if (disableChunkedEncoding)
    result.disableChunkedEncoding = true
  if (connectTimeout.trim())
    result.connectTimeout = connectTimeout.trim()
  if (noHappyEyeballs)
    result.noHappyEyeballs = true
  if (proxyType)
    result.proxyType = proxyType
  if (keepAliveTimeout.trim())
    result.keepAliveTimeout = keepAliveTimeout.trim()
  if (keepAliveConnections !== undefined)
    result.keepAliveConnections = keepAliveConnections
  if (tcpKeepAlive.trim())
    result.tcpKeepAlive = tcpKeepAlive.trim()

  const audTags = access.value.audTags.split('\n').map(s => s.trim()).filter(Boolean)
  if (access.value.required || access.value.teamName.trim() || audTags.length > 0) {
    result.access = {
      ...(access.value.required ? { required: true } : {}),
      ...(access.value.teamName.trim() ? { teamName: access.value.teamName.trim() } : {}),
      ...(audTags.length > 0 ? { audTag: audTags } : {}),
    }
  }

  return result
}

async function save() {
  try {
    await formRef.value?.validate()
  }
  catch {
    message.warning('请填写必填项')
    return
  }

  const ingress: {
    hostname?: string
    path?: string
    service: string
    originRequest?: OriginRequest
  } = {
    service: rule.value.service.trim(),
    ...(rule.value.hostname.trim() ? { hostname: rule.value.hostname.trim() } : {}),
    ...(rule.value.path.trim() ? { path: rule.value.path.trim() } : {}),
  }
  const originRequest = collectOriginRequest()
  if (Object.keys(originRequest).length > 0)
    ingress.originRequest = originRequest

  saving.value = true
  try {
    const config = await tunnelStore.getRemoteConfig(accountId.value, tunnelId.value)
    const ingressList = [...(config.ingress || [])]
    if (isNew.value)
      ingressList.push(ingress)
    else
      ingressList[index.value] = ingress

    await tunnelStore.updateRemoteConfig(accountId.value, tunnelId.value, {
      ...config,
      ingress: ingressList,
    })
    message.success('保存成功')
    router.push(`/tunnels/remote/${accountId.value}/${tunnelId.value}`)
  }
  catch (e) {
    message.error(`保存失败: ${(e as Error).message}`)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="isNew ? '新增 Ingress 规则' : `编辑 Ingress 规则 #${index + 1}`"
      :crumbs="[
        { label: '首页', to: '/' },
        { label: '隧道', to: '/' },
        { label: tunnel?.name || '远程隧道', to: `/tunnels/remote/${accountId}/${tunnelId}` },
        { label: isNew ? '新增规则' : `规则 #${index + 1}` },
      ]"
    />

    <NSpin v-if="loading" />
    <template v-else>
      <NCard title="基础信息" class="mb-4">
        <NForm ref="formRef" :model="rule" :rules="rules" label-placement="top">
          <div class="grid grid-cols-2 gap-4">
            <NFormItem label="Hostname">
              <NInput v-model:value="rule.hostname" placeholder="例如 example.com 或 *.example.com，留空匹配全部" clearable />
            </NFormItem>
            <NFormItem label="Path">
              <NInput v-model:value="rule.path" placeholder="例如 /api，支持正则，留空匹配全部" clearable />
            </NFormItem>
            <NFormItem label="Service" class="col-span-2">
              <NInput v-model:value="rule.service" placeholder="例如 http://localhost:3000 或 http_status:404 / ssh://localhost:22" clearable />
            </NFormItem>
          </div>
        </NForm>
      </NCard>

      <NCard title="Origin 配置" class="mb-4">
        <p class="mb-4 text-sm text-gray-500">
          可覆盖顶层 originRequest 的默认配置，参考 Cloudflare 文档。
        </p>

        <div class="mb-2 font-medium">
          TLS 设置
        </div>
        <div class="grid grid-cols-2 gap-4">
          <NFormItem label="Origin Server Name">
            <NInput v-model:value="origin.originServerName" placeholder="期望的源服务器证书主机名" clearable />
          </NFormItem>
          <NFormItem label="Match SNI to Host">
            <NCheckbox v-model:checked="origin.matchSNItoHost">
              自动将 SNI 设为请求 hostname
            </NCheckbox>
          </NFormItem>
          <NFormItem label="Certificate Authority Pool (caPool)">
            <NInput v-model:value="origin.caPool" placeholder="CA 证书文件路径，例如 /root/certs/ca.pem" clearable />
          </NFormItem>
          <NFormItem label="No TLS Verify">
            <NCheckbox v-model:checked="origin.noTLSVerify">
              跳过源服务器 TLS 证书校验
            </NCheckbox>
          </NFormItem>
          <NFormItem label="TLS Timeout">
            <NInput v-model:value="origin.tlsTimeout" placeholder="例如 10s" clearable />
          </NFormItem>
          <NFormItem label="HTTP2 Origin">
            <NCheckbox v-model:checked="origin.http2Origin">
              使用 HTTP/2.0 连接源服务器
            </NCheckbox>
          </NFormItem>
        </div>

        <NDivider />

        <div class="mb-2 font-medium">
          HTTP 设置
        </div>
        <div class="grid grid-cols-2 gap-4">
          <NFormItem label="HTTP Host Header">
            <NInput v-model:value="origin.httpHostHeader" placeholder="自定义发送给源服务的 Host 头" clearable />
          </NFormItem>
          <NFormItem label="Disable Chunked Encoding">
            <NCheckbox v-model:checked="origin.disableChunkedEncoding">
              禁用分块传输编码
            </NCheckbox>
          </NFormItem>
        </div>

        <NDivider />

        <div class="mb-2 font-medium">
          连接设置
        </div>
        <div class="grid grid-cols-2 gap-4">
          <NFormItem label="Connect Timeout">
            <NInput v-model:value="origin.connectTimeout" placeholder="例如 30s" clearable />
          </NFormItem>
          <NFormItem label="No Happy Eyeballs">
            <NCheckbox v-model:checked="origin.noHappyEyeballs">
              禁用 Happy Eyeballs 算法
            </NCheckbox>
          </NFormItem>
          <NFormItem label="Proxy Type">
            <NSelect v-model:value="origin.proxyType" :options="proxyTypeOptions" placeholder="选择代理类型" />
          </NFormItem>
          <NFormItem label="Keep Alive Timeout">
            <NInput v-model:value="origin.keepAliveTimeout" placeholder="例如 1m30s" clearable />
          </NFormItem>
          <NFormItem label="Keep Alive Connections">
            <NInputNumber v-model:value="origin.keepAliveConnections" :min="0" placeholder="例如 100" style="width: 100%;" />
          </NFormItem>
          <NFormItem label="TCP Keep Alive">
            <NInput v-model:value="origin.tcpKeepAlive" placeholder="例如 30s" clearable />
          </NFormItem>
        </div>

        <NDivider />

        <div class="mb-2 font-medium">
          Access 设置
        </div>
        <div class="grid grid-cols-2 gap-4">
          <NFormItem label="Protect with Access">
            <NCheckbox v-model:checked="access.required">
              启用 Cloudflare Access 校验
            </NCheckbox>
          </NFormItem>
          <NFormItem label="Team Name">
            <NInput v-model:value="access.teamName" placeholder="例如 my-team" clearable />
          </NFormItem>
          <NFormItem label="AUD Tags" class="col-span-2">
            <NInput
              v-model:value="access.audTags"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="每个 AUD tag 一行"
            />
          </NFormItem>
        </div>
      </NCard>

      <div class="flex justify-end gap-2">
        <NButton @click="router.push(`/tunnels/remote/${accountId}/${tunnelId}`)">
          取消
        </NButton>
        <NButton type="primary" :loading="saving" @click="save">
          <template #icon>
            <IconMdiContentSave />
          </template>
          保存
        </NButton>
      </div>
    </template>
  </div>
</template>
