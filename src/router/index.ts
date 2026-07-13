import { createRouter, createWebHistory } from 'vue-router'
import { ApiError, getToken } from '@/api/client'
import { showToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { i18n } from '@/i18n'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
    { path: '/s/:token', name: 'share', component: () => import('@/views/ShareView.vue'), meta: { guest: true } },
    { path: '/pickup', name: 'pickup', component: () => import('@/views/PickupView.vue'), meta: { guest: true } },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { auth: true },
      children: [
        { path: '', redirect: '/files' },
        {
          path: 'files',
          name: 'files',
          component: () => import('@/views/FilesView.vue'),
          meta: { flushLayout: true },
        },
        {
          path: 'agents/:slug',
          name: 'agent',
          component: () => import('@/views/AgentView.vue'),
          meta: { flushLayout: true },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { pageTitleKey: 'nav.profile' },
        },
        {
          path: 'admin/overview',
          name: 'admin-overview',
          component: () => import('@/views/admin/OverviewView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.overview' },
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/views/admin/UsersView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.users' },
        },
        {
          path: 'admin/configs',
          name: 'admin-configs',
          component: () => import('@/views/admin/ConfigsView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.configs' },
        },
        {
          path: 'admin/logs',
          name: 'admin-logs',
          component: () => import('@/views/admin/LogsView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.logs' },
        },
        {
          path: 'admin/storages',
          name: 'admin-storages',
          component: () => import('@/views/admin/StoragesView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.storages' },
        },
        {
          path: 'admin/departments',
          name: 'admin-departments',
          component: () => import('@/views/admin/DepartmentsView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.departments' },
        },
        {
          path: 'admin/permissions',
          name: 'admin-permissions',
          component: () => import('@/views/admin/PermissionsView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.permissions' },
        },
        {
          path: 'admin/plugins',
          name: 'admin-plugins',
          component: () => import('@/views/admin/PluginsView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.plugins' },
        },
        {
          path: 'admin/agents',
          name: 'admin-agents',
          component: () => import('@/views/admin/AgentsView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.agentsAdmin' },
        },
        {
          path: 'admin/appearance',
          name: 'admin-appearance',
          component: () => import('@/views/admin/AppearanceView.vue'),
          meta: { admin: true, pageTitleKey: 'nav.appearance' },
        },
        { path: 'admin', redirect: '/admin/overview' },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/files' },
  ],
})

const PUBLIC_ROUTE_NAMES = new Set(['login', 'share', 'pickup'])

router.beforeEach(async (to) => {
  const token = getToken()
  const auth = useAuthStore()

  const isPublicRoute = to.meta.guest === true || PUBLIC_ROUTE_NAMES.has(String(to.name ?? ''))
  if (isPublicRoute) {
    if (to.name === 'login' && token && auth.user) return '/files'
    // 后端短暂不可达时 token 仍有效，恢复会话而非要求重新输入密码
    if (to.name === 'login' && token && !auth.user && !auth.sessionInvalid) {
      try {
        await auth.fetchMe()
        return '/files'
      } catch {
        return true
      }
    }
    return true
  }

  if (to.meta.auth && !token) return '/login'

  if (token) {
    if (!auth.user && !auth.sessionInvalid) {
      try {
        await auth.fetchMe()
      } catch (e) {
        const isAuthError = e instanceof ApiError && e.code === 401
        if (!auth.sessionErrorShown) {
          auth.sessionErrorShown = true
          const msg = isAuthError
            ? e instanceof ApiError
              ? e.message
              : i18n.global.t('errors.serviceError')
            : i18n.global.t('errors.serviceUnavailable')
          showToast(msg)
        }
        return '/login'
      }
    }
    if (auth.sessionInvalid || !getToken()) return '/login'
    if (to.meta.admin && !auth.isAdmin) return '/files'
  }
})

export default router
