<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconShieldLock,
  IconMail,
  IconBrandGithub,
  IconServer,
  IconAdjustments,
  IconLock,
  IconFileText,
} from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as settingsApi from '@/api/settings'
import type {
  AccessSettings,
  EmailSettings,
  GeneralSettings,
  LDAPSettings,
  OAuthSettings,
  OnlyOfficeSettings,
  SecuritySettings,
  SettingsSection,
} from '@/api/settings'
import { useToast } from '@/composables/useToast'
import { mergeLoginOAuthProviders } from '@/constants/oauthPresets'
import GeneralPanel from './config/GeneralPanel.vue'
import OAuthPanel from './config/OAuthPanel.vue'
import SecurityPanel from './config/SecurityPanel.vue'
import AccessPanel from './config/AccessPanel.vue'
import EmailPanel from './config/EmailPanel.vue'
import LDAPPanel from './config/LDAPPanel.vue'
import OnlyOfficePanel from './config/OnlyOfficePanel.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loading = ref(false)

const general = ref<GeneralSettings>({ page_size: 20 })
const oauth = ref<OAuthSettings>({ enabled: false, providers: [] })
const security = ref<SecuritySettings>({
  captcha_enabled: false,
  captcha: { type: 'digit', length: 4, noise_level: 'low', width: 120, height: 44, expiry_seconds: 180, case_sensitive: false, obfuscate_image: true },
  login_fail_window_sec: 60,
  login_fail_max: 5,
  login_ban_sec: 600,
  password_min_len: 8,
  password_require_upper: false,
  password_require_lower: true,
  password_require_digit: true,
  password_require_special: false,
  admin_2fa_enabled: false,
})
const access = ref<AccessSettings>({ ip_blacklist: [], ua_blacklist: [] })
const email = ref<EmailSettings>({
  enabled: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_pass: '',
  from: '',
  use_tls: true,
  templates: { reset_password: '', register: '', test: '' },
})
const ldap = ref<LDAPSettings>({
  enabled: false,
  host: '',
  port: 389,
  use_tls: false,
  bind_dn: '',
  bind_pass: '',
  base_dn: '',
  user_filter: '(uid=%s)',
  username_attr: 'uid',
  email_attr: 'mail',
})
const onlyoffice = ref<OnlyOfficeSettings>({
  enabled: false,
  server_url: '',
  jwt_secret: '',
  version_keep: 5,
  callback_base_url: '',
})

const nav: { id: SettingsSection; label: string; icon: typeof IconAdjustments }[] = [
  { id: 'general', label: '常规', icon: IconAdjustments },
  { id: 'oauth', label: 'OAuth 登录', icon: IconBrandGithub },
  { id: 'security', label: '安全', icon: IconShieldLock },
  { id: 'access', label: '访问控制', icon: IconLock },
  { id: 'email', label: '发件邮箱', icon: IconMail },
  { id: 'ldap', label: 'LDAP / 域', icon: IconServer },
  { id: 'onlyoffice', label: 'ONLYOFFICE', icon: IconFileText },
]

const validSections = new Set(nav.map((n) => n.id))

function parseTab(raw: unknown): SettingsSection {
  if (typeof raw === 'string' && validSections.has(raw as SettingsSection)) {
    return raw as SettingsSection
  }
  return 'general'
}

const activeTab = computed(() => parseTab(route.query.tab))

async function loadSection(section: SettingsSection) {
  loading.value = true
  try {
    switch (section) {
      case 'general':
        general.value = await settingsApi.getSettings<GeneralSettings>('general')
        break
      case 'oauth':
        oauth.value = await settingsApi.getSettings<OAuthSettings>('oauth')
        oauth.value.providers = mergeLoginOAuthProviders(oauth.value.providers || [])
        break
      case 'security':
        security.value = await settingsApi.getSettings<SecuritySettings>('security')
        break
      case 'access':
        access.value = await settingsApi.getSettings<AccessSettings>('access')
        if (!access.value.ip_blacklist) access.value.ip_blacklist = []
        if (!access.value.ua_blacklist) access.value.ua_blacklist = []
        break
      case 'email':
        email.value = await settingsApi.getSettings<EmailSettings>('email')
        break
      case 'ldap':
        ldap.value = await settingsApi.getSettings<LDAPSettings>('ldap')
        break
      case 'onlyoffice':
        onlyoffice.value = await settingsApi.getSettings<OnlyOfficeSettings>('onlyoffice')
        break
    }
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function selectSection(id: SettingsSection) {
  if (id === activeTab.value) return
  router.replace({ path: '/admin/configs', query: { tab: id } })
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'cloud_storage') {
      router.replace({ path: '/admin/storages', query: { tab: 'cloud' } })
      return
    }
    loadSection(activeTab.value)
  },
)

onMounted(async () => {
  if (route.query.tab === 'cloud_storage') {
    await router.replace({ path: '/admin/storages', query: { tab: 'cloud' } })
    return
  }
  if (!route.query.tab) {
    await router.replace({ path: '/admin/configs', query: { tab: 'general' } })
  }
  await loadSection(activeTab.value)
})
</script>

<template>
  <div class="card cd-settings-layout">
    <aside class="cd-settings-nav">
      <nav class="cd-settings-nav-list">
        <button
          v-for="item in nav"
          :key="item.id"
          type="button"
          class="cd-settings-nav-item"
          :class="{ active: activeTab === item.id }"
          @click="selectSection(item.id)"
        >
          <component :is="item.icon" :size="17" :stroke="1.75" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="cd-settings-main">
      <div v-if="loading" class="text-center text-secondary py-5">加载中…</div>
      <template v-else>
        <GeneralPanel v-if="activeTab === 'general'" v-model="general" />
        <OAuthPanel v-else-if="activeTab === 'oauth'" v-model="oauth" />
        <SecurityPanel v-else-if="activeTab === 'security'" v-model="security" />
        <AccessPanel v-else-if="activeTab === 'access'" v-model="access" />
        <EmailPanel v-else-if="activeTab === 'email'" v-model="email" />
        <LDAPPanel v-else-if="activeTab === 'ldap'" v-model="ldap" />
        <OnlyOfficePanel v-else-if="activeTab === 'onlyoffice'" v-model="onlyoffice" />
      </template>
    </main>
  </div>
  <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
</template>
