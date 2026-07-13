<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppSidebar from '@/components/AppSidebar.vue'

const route = useRoute()
const { t } = useI18n()

const pageTitle = computed(() => {
  const key = route.meta.pageTitleKey as string | undefined
  return key ? t(key) : (route.meta.pageTitle as string) || ''
})
const flush = computed(() => !!route.meta.flushLayout)
</script>

<template>
  <div class="cd-shell">
    <AppSidebar />
    <div class="cd-main">
      <header v-if="pageTitle" class="cd-page-header">
        <h1 class="cd-page-title">{{ pageTitle }}</h1>
      </header>
      <div class="cd-page-body" :class="{ 'cd-page-body--flush': flush }">
        <RouterView />
      </div>
    </div>
  </div>
</template>
