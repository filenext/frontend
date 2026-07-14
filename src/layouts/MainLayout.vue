<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { IconMenu2, IconX } from '@tabler/icons-vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useBrandingStore } from '@/stores/branding'

const route = useRoute()
const { t } = useI18n()
const branding = useBrandingStore()
const { mobileOpen, openMobile, closeMobile } = useSidebar()

const pageTitle = computed(() => {
  const key = route.meta.pageTitleKey as string | undefined
  return key ? t(key) : (route.meta.pageTitle as string) || ''
})
const flush = computed(() => !!route.meta.flushLayout)

watch(
  () => route.fullPath,
  () => closeMobile(),
)
</script>

<template>
  <div class="cd-shell" :class="{ 'cd-shell--nav-open': mobileOpen }">
    <div
      class="cd-shell-nav-backdrop"
      :class="{ 'is-open': mobileOpen }"
      aria-hidden="true"
      @click="closeMobile"
    />
    <AppSidebar />
    <div class="cd-main">
      <header class="cd-mobile-topbar">
        <button
          type="button"
          class="cd-mobile-topbar__menu"
          :aria-label="mobileOpen ? '关闭菜单' : '打开菜单'"
          @click="mobileOpen ? closeMobile() : openMobile()"
        >
          <IconX v-if="mobileOpen" :size="22" :stroke="1.75" />
          <IconMenu2 v-else :size="22" :stroke="1.75" />
        </button>
        <span class="cd-mobile-topbar__title text-truncate">
          {{ pageTitle || branding.settings.site_name }}
        </span>
      </header>
      <header v-if="pageTitle" class="cd-page-header">
        <h1 class="cd-page-title">{{ pageTitle }}</h1>
      </header>
      <div class="cd-page-body" :class="{ 'cd-page-body--flush': flush }">
        <RouterView />
      </div>
    </div>
  </div>
</template>
