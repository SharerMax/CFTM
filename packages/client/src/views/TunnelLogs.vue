<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconMdiArrowLeft from '~icons/mdi/arrow-left'
import IconMdiClear from '~icons/mdi/delete-sweep'

const route = useRoute()
const router = useRouter()

const logs = ref<string[]>([])
const logContainer = ref<HTMLElement | null>(null)
const connected = ref(false)
const tunnelId = ref('')

let eventSource: EventSource | null = null

onMounted(() => {
  tunnelId.value = route.params.id as string
  connectSSE()
})

function connectSSE() {
  eventSource = new EventSource(`/api/tunnels/${tunnelId.value}/logs`)

  eventSource.onopen = () => {
    connected.value = true
  }

  eventSource.onmessage = (event) => {
    if (event.data.startsWith(': keepalive'))
      return
    logs.value.push(event.data)
    if (logs.value.length > 1000) {
      logs.value.shift()
    }
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }

  eventSource.onerror = () => {
    connected.value = false
    eventSource?.close()
  }
}

function clearLogs() {
  logs.value = []
}

onUnmounted(() => {
  eventSource?.close()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center gap-3">
      <NButton text @click="router.push(`/tunnels/${tunnelId}`)">
        <template #icon>
          <IconMdiArrowLeft />
        </template>
        返回
      </NButton>
      <h2 class="text-xl font-semibold">
        实时日志
      </h2>
      <span
        :class="connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
        class="rounded px-2 py-0.5 text-xs"
      >
        {{ connected ? '已连接' : '断开' }}
      </span>
      <div class="flex-1" />
      <NButton size="small" @click="clearLogs">
        <template #icon>
          <IconMdiClear />
        </template>
        清屏
      </NButton>
    </div>

    <NCard class="flex-1 overflow-hidden">
      <div
        ref="logContainer"
        class="h-full overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100 font-mono"
        style="max-height: calc(100vh - 200px);"
      >
        <div v-if="logs.length === 0" class="text-gray-500">
          等待日志...
        </div>
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="leading-5 hover:bg-gray-800"
        >
          <span class="text-gray-500">{{ index + 1 }}</span>
          <span class="ml-2">{{ log }}</span>
        </div>
      </div>
    </NCard>
  </div>
</template>
