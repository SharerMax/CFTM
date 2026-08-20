<script setup lang="ts">
import { NBreadcrumb, NBreadcrumbItem } from 'naive-ui'
import { RouterLink } from 'vue-router'

export interface PageCrumb {
  label: string
  to?: string
}

defineProps<{
  title: string
  crumbs: PageCrumb[]
}>()
</script>

<template>
  <div>
    <NBreadcrumb class="mb-2">
      <NBreadcrumbItem v-for="crumb in crumbs" :key="crumb.label">
        <RouterLink v-if="crumb.to" :to="crumb.to">
          {{ crumb.label }}
        </RouterLink>
        <span v-else>{{ crumb.label }}</span>
      </NBreadcrumbItem>
    </NBreadcrumb>
    <div class="mb-2 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h2 class="m-0 text-xl font-semibold">
          {{ title }}
        </h2>
        <slot name="after-title" />
      </div>
      <div class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
