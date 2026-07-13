<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IconFiles,
  IconUsers,
  IconDatabase,
  IconPalette,
  IconSettings,
  IconListDetails,
  IconUser,
  IconLogout,
  IconLayoutDashboard,
  IconChevronDown,
  IconChevronRight,
  IconChevronLeft,
  IconAiAgent,
  IconUsersGroup,
  IconShield,
  IconPlugConnected,
  IconCloud,
} from '@tabler/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useBrandingStore } from '@/stores/branding'
import { useAgentsStore } from '@/stores/agents'
import { useSidebar } from '@/composables/useSidebar'
import AppBrand from '@/components/AppBrand.vue'
import CdAvatar from '@/components/CdAvatar.vue'

const { t } = useI18n()

const auth = useAuthStore()
const branding = useBrandingStore()
const agentsStore = useAgentsStore()
const route = useRoute()
const router = useRouter()
const { collapsed, toggle } = useSidebar()

const adminOpen = ref(route.path.startsWith('/admin'))

const inAdmin = computed(() => route.path.startsWith('/admin'))

type AdminNavItem = {
  to: string
  label: string
  icon: typeof IconUsers
  sub?: boolean
}

const adminNav = computed(() => [
  { to: '/admin/overview', label: t('nav.overview'), icon: IconLayoutDashboard },
  { to: '/admin/users', label: t('nav.users'), icon: IconUsers },
  { to: '/admin/storages?tab=storages', label: t('nav.storages'), icon: IconDatabase },
  { to: '/admin/storages?tab=cloud', label: t('nav.cloud'), icon: IconCloud, sub: true },
  { to: '/admin/departments', label: t('nav.departments'), icon: IconUsersGroup },
  { to: '/admin/permissions', label: t('nav.permissions'), icon: IconShield },
  { to: '/admin/agents', label: t('nav.agentsAdmin'), icon: IconAiAgent },
  { to: '/admin/plugins', label: t('nav.plugins'), icon: IconPlugConnected },
  { to: '/admin/appearance', label: t('nav.appearance'), icon: IconPalette },
  { to: '/admin/configs?tab=general', label: t('nav.configs'), icon: IconSettings },
  { to: '/admin/logs?tab=log', label: t('nav.logs'), icon: IconListDetails },
])

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/admin')) adminOpen.value = true
  },
)

function isActive(path: string) {
  if (path === '/files') return route.path.startsWith('/files')
  if (path === '/admin/overview') return route.path === '/admin/overview'
  if (path === '/admin') return inAdmin.value
  if (path.startsWith('/agents/')) return route.path.startsWith(path)
  return route.path.startsWith(path)
}

function isAdminNavActive(item: AdminNavItem) {
  if (item.to.startsWith('/admin/storages')) {
    if (!route.path.startsWith('/admin/storages')) return false
    const tab = typeof route.query.tab === 'string' ? route.query.tab : 'storages'
    if (item.to.includes('tab=cloud')) return tab === 'cloud'
    return tab === 'storages' || tab === ''
  }
  if (item.to.includes('?tab=')) {
    const url = new URL(item.to, 'http://local')
    if (route.path !== url.pathname) return false
    return route.query.tab === url.searchParams.get('tab')
  }
  return isActive(item.to)
}

function agentPath(slug: string) {
  return `/agents/${slug}`
}

onMounted(() => {
  if (auth.user) agentsStore.load()
})

watch(
  () => auth.user,
  (user) => {
    if (user) agentsStore.load()
  },
)

function onAdminToggle() {
  adminOpen.value = !adminOpen.value
  if (adminOpen.value && !inAdmin.value) router.push('/admin/overview')
}

async function onLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="cd-app-sidebar" :class="{ 'cd-app-sidebar--collapsed': collapsed }">
    <div class="cd-app-sidebar-top">
      <div class="cd-app-sidebar-brand-row">
        <RouterLink to="/files" class="cd-app-brand-link" :title="collapsed ? branding.settings.site_name : undefined">
          <AppBrand size="sm" :icon-only="collapsed" />
        </RouterLink>
      </div>

      <nav class="cd-app-nav">
        <RouterLink
          to="/files"
          class="cd-app-nav-item"
          :class="{ active: isActive('/files') }"
          :title="collapsed ? t('nav.files') : undefined"
        >
          <IconFiles :size="18" :stroke="1.75" />
          <span v-if="!collapsed">{{ t('nav.files') }}</span>
        </RouterLink>

        <template v-if="agentsStore.sidebarAgents.length">
          <div v-if="!collapsed" class="cd-app-nav-label">{{ t('nav.agents') }}</div>
          <RouterLink
            v-for="a in agentsStore.sidebarAgents"
            :key="a.id"
            :to="agentPath(a.slug)"
            class="cd-app-nav-item"
            :class="{ active: route.path === agentPath(a.slug) }"
            :title="collapsed ? a.name : undefined"
          >
            <IconAiAgent :size="18" :stroke="1.75" />
            <span v-if="!collapsed">{{ a.name }}</span>
          </RouterLink>
        </template>
      </nav>

      <nav v-if="auth.isAdmin && collapsed && adminOpen" class="cd-app-nav cd-app-nav-admin-pop">
        <RouterLink
          v-for="item in adminNav"
          :key="item.to"
          :to="item.to"
          class="cd-app-nav-item cd-app-nav-child"
          :class="{ active: isAdminNavActive(item), 'cd-app-nav-sub': item.sub }"
          :title="item.label"
        >
          <component :is="item.icon" :size="16" :stroke="1.75" />
        </RouterLink>
      </nav>
    </div>

    <div class="cd-app-sidebar-bottom">
      <nav v-if="auth.isAdmin" class="cd-app-nav cd-app-nav-admin">
        <button
          type="button"
          class="cd-app-nav-item cd-app-nav-parent"
          :class="{ active: isActive('/admin') }"
          :title="collapsed ? t('nav.admin') : undefined"
          @click="onAdminToggle"
        >
          <IconLayoutDashboard :size="18" :stroke="1.75" />
          <span v-if="!collapsed" class="flex-fill text-start">{{ t('nav.admin') }}</span>
          <IconChevronDown v-if="adminOpen && !collapsed" :size="15" class="cd-app-nav-chevron" />
          <IconChevronRight v-else-if="!collapsed" :size="15" class="cd-app-nav-chevron" />
        </button>
        <div v-if="adminOpen && !collapsed" class="cd-app-nav-children">
          <RouterLink
            v-for="item in adminNav"
            :key="item.to"
            :to="item.to"
            class="cd-app-nav-item cd-app-nav-child"
            :class="{ active: isAdminNavActive(item), 'cd-app-nav-sub': item.sub }"
            :title="collapsed ? item.label : undefined"
          >
            <component :is="item.icon" :size="16" :stroke="1.75" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <RouterLink
        to="/profile"
        class="cd-app-nav-item"
        :class="{ active: isActive('/profile') }"
        :title="collapsed ? t('nav.profile') : undefined"
      >
        <IconUser :size="18" :stroke="1.75" />
        <span v-if="!collapsed">{{ t('nav.profile') }}</span>
      </RouterLink>

      <div class="cd-app-user" :class="{ 'cd-app-user--collapsed': collapsed }">
        <CdAvatar :src="auth.user?.avatar_url" :name="auth.displayName" kind="user" size="sm" />
        <span v-if="!collapsed" class="cd-app-user-name text-truncate">{{ auth.displayName }}</span>
        <button
          v-if="!collapsed"
          type="button"
          class="btn btn-sm btn-ghost-secondary p-1 ms-auto"
          :title="t('nav.logout')"
          @click="onLogout"
        >
          <IconLogout :size="16" />
        </button>
        <button
          v-else
          type="button"
          class="cd-app-nav-item cd-app-logout-mini"
          :title="t('nav.logout')"
          @click="onLogout"
        >
          <IconLogout :size="16" :stroke="1.75" />
        </button>
      </div>
    </div>

    <button
      type="button"
      class="cd-sidebar-fold"
      :title="collapsed ? '展开' : '收起'"
      @click="toggle"
    >
      <IconChevronLeft v-if="!collapsed" :size="14" :stroke="2" />
      <IconChevronRight v-else :size="14" :stroke="2" />
    </button>
  </aside>
</template>
