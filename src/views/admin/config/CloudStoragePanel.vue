<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconPlugConnected } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as settingsApi from '@/api/settings'
import * as storagesApi from '@/api/storages'
import type { CloudStorageSettings } from '@/api/settings'
import type { StorageRow } from '@/types/files'
import {
  CLOUD_OPEN_CONSOLE_URLS,
  CLOUD_PLATFORM_TABS,
  cloudOAuthCallbackUrl,
  isCloudStorageDriver,
  platformForCloudDriver,
  sanitizeBaiduCloudScopes,
  type CloudPlatform,
} from '@/constants/cloudStoragePresets'
import { useToast } from '@/composables/useToast'
import { copyToClipboard } from '@/utils/clipboard'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const form = defineModel<CloudStorageSettings>({ required: true })
const saving = ref(false)
const storages = ref<StorageRow[]>([])
const storagesLoading = ref(false)
const cloudOAuthLoading = ref<string | null>(null)
const callbackLoading = ref(false)
const callbackInfo = ref<storagesApi.CloudOAuthCallbackInfo | null>(null)

const activeCallbackUrl = computed(() => callbackInfo.value?.redirect_uri || '')

const displayCallbackUrl = computed(() => {
  if (callbackLoading.value) return '加载中…'
  if (activeCallbackUrl.value) return activeCallbackUrl.value
  if (activeApp.value) return cloudOAuthCallbackUrl(activePlatform.value)
  return ''
})

const callbackSourceHint = computed(() => {
  if (!activeCallbackUrl.value && displayCallbackUrl.value) {
    return '后端接口暂不可用，以下为根据当前浏览器地址预估的回调地址（重启后端后可刷新为精确值）'
  }
  const src = callbackInfo.value?.base_url_source
  if (src === 'public_base_url') return '来自服务端 PUBLIC_BASE_URL 环境变量'
  if (src === 'x_forwarded_host') {
    return '来自当前浏览器访问地址（经 Vite 代理转发，通常为 :5434 端口）'
  }
  return '来自当前 API 请求 Host'
})

function parsePlatform(raw: unknown): CloudPlatform {
  if (typeof raw === 'string' && CLOUD_PLATFORM_TABS.some((t) => t.id === raw)) {
    return raw as CloudPlatform
  }
  return 'baidu'
}

const activePlatform = ref<CloudPlatform>(parsePlatform(route.query.platform))

const activeApp = computed(() => form.value.apps.find((a) => a.platform === activePlatform.value))

const platformTabs = computed(() =>
  CLOUD_PLATFORM_TABS.map((tab) => ({
    ...tab,
    enabled: form.value.apps.find((a) => a.platform === tab.id)?.enabled ?? false,
  })),
)

const platformStorages = computed(() =>
  storages.value.filter((s) => platformForCloudDriver(s.driver) === activePlatform.value),
)

function switchPlatform(platform: CloudPlatform) {
  if (platform === activePlatform.value) return
  activePlatform.value = platform
  router.replace({
    path: '/admin/storages',
    query: { ...route.query, tab: 'cloud', platform },
  })
}

watch(
  () => route.query.platform,
  (platform) => {
    activePlatform.value = parsePlatform(platform)
    loadCallbackUrl()
  },
)

watch(
  () => form.value.apps,
  (apps) => {
    if (!apps.some((a) => a.platform === activePlatform.value)) {
      activePlatform.value = (apps[0]?.platform as CloudPlatform) || 'baidu'
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (route.query.tab === 'cloud' && !route.query.platform) {
    router.replace({
      path: '/admin/storages',
      query: { ...route.query, tab: 'cloud', platform: activePlatform.value },
    })
  }
  loadStorages().then(() => loadCallbackUrl())
})

async function loadCallbackUrl() {
  callbackLoading.value = true
  try {
    callbackInfo.value = await storagesApi.getCloudOAuthCallbackUrl(activePlatform.value)
    return
  } catch {
    callbackInfo.value = null
  } finally {
    callbackLoading.value = false
  }

  const storage = platformStorages.value[0]
  if (!storage) return

  callbackLoading.value = true
  try {
    const { redirect_uri: redirectUri } = await storagesApi.getCloudOAuthUrl(storage.id)
    if (redirectUri) {
      callbackInfo.value = { redirect_uri: redirectUri, base_url_source: 'request_host' }
    }
  } catch {
    /* client-side fallback via displayCallbackUrl */
  } finally {
    callbackLoading.value = false
  }
}

async function copyCallbackUrl() {
  const text = displayCallbackUrl.value
  if (!text) return
  if (await copyToClipboard(text)) {
    toast.show('回调地址已复制')
  } else {
    toast.show('复制失败，请手动选择复制')
  }
}

async function loadStorages() {
  storagesLoading.value = true
  try {
    const res = await storagesApi.listStorages({ all: true })
    storages.value = res.items.filter((s) => isCloudStorageDriver(s.driver))
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载存储源失败')
  } finally {
    storagesLoading.value = false
  }
}

async function connectCloudOAuth(s: StorageRow) {
  if (cloudOAuthLoading.value) return
  cloudOAuthLoading.value = s.id
  try {
    const { url, redirect_uri: redirectUri } = await storagesApi.getCloudOAuthUrl(s.id)
    if (redirectUri) {
      console.info('[cloud-oauth] redirect_uri =', redirectUri)
    }
    if (redirectUri && activeCallbackUrl.value && redirectUri !== activeCallbackUrl.value) {
      await loadCallbackUrl()
    }
    window.location.href = url
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '获取授权链接失败')
    cloudOAuthLoading.value = null
  }
}

function storageAuthLabel(s: StorageRow) {
  return s.config?.connected ? '已授权' : '未授权'
}

function storageScopeText(s: StorageRow) {
  const scope = String(s.config?.oauth_scope || '').trim()
  return scope || '—'
}

watch(
  () => route.query.cloud_oauth,
  (status) => {
    if (status === 'ok') {
      loadStorages()
      loadCallbackUrl()
    }
  },
)

async function save() {
  saving.value = true
  try {
    const payload: CloudStorageSettings = {
      ...form.value,
      apps: form.value.apps.map((a) =>
        a.platform === 'baidu' ? { ...a, scopes: sanitizeBaiduCloudScopes(a.scopes) } : a,
      ),
    }
    form.value = await settingsApi.saveSettings('cloud_storage', payload)
    toast.show('云盘对接配置已保存')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">云盘对接</h3>
    <p class="text-secondary small mb-4">
      用于<strong>存储源授权</strong>与<strong>跨存储同步</strong>（如本地 → 百度网盘、FTP → OneDrive），与「OAuth 登录」完全独立。
      在此填写各云平台的应用凭证；在「存储源」中创建云盘驱动并完成 OAuth 授权后即可使用。
    </p>

    <label class="form-check form-switch mb-3">
      <input v-model="form.enabled" class="form-check-input" type="checkbox" />
      <span class="form-check-label">启用云盘对接</span>
    </label>

    <ul class="nav nav-tabs cd-cloud-subtabs mb-3">
      <li v-for="tab in platformTabs" :key="tab.id" class="nav-item">
        <button
          type="button"
          class="nav-link d-inline-flex align-items-center gap-2"
          :class="{ active: activePlatform === tab.id }"
          @click="switchPlatform(tab.id)"
        >
          {{ tab.label }}
          <span
            class="badge rounded-pill"
            :class="tab.enabled ? 'bg-green-lt text-green' : 'bg-secondary-lt text-secondary'"
          >
            {{ tab.enabled ? '已启用' : '未启用' }}
          </span>
        </button>
      </li>
    </ul>

    <div v-if="activeApp" class="cd-settings-card">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <strong>{{ activeApp.name }}</strong>
          <div class="text-secondary small mt-1">
            平台标识：
            <a
              :href="CLOUD_OPEN_CONSOLE_URLS[activeApp.platform as CloudPlatform]"
              target="_blank"
              rel="noopener noreferrer"
              title="打开开放平台注册应用"
            >
              <code>{{ activeApp.platform }}</code>
            </a>
            <span class="ms-1">·</span>
            <a
              :href="CLOUD_OPEN_CONSOLE_URLS[activeApp.platform as CloudPlatform]"
              target="_blank"
              rel="noopener noreferrer"
              class="ms-1"
            >
              前往注册应用
            </a>
          </div>
        </div>
        <label class="form-check mb-0">
          <input v-model="activeApp.enabled" class="form-check-input" type="checkbox" />
          <span class="form-check-label">启用此平台</span>
        </label>
      </div>

      <div class="cd-settings-form">
        <div class="cd-settings-form-row">
          <div class="cd-settings-form-label">Client ID / API Key</div>
          <div class="cd-settings-form-control">
            <input v-model="activeApp.client_id" class="form-control form-control-sm" />
          </div>
        </div>
        <div class="cd-settings-form-row">
          <div class="cd-settings-form-label">Client Secret</div>
          <div class="cd-settings-form-control">
            <input v-model="activeApp.client_secret" type="password" class="form-control form-control-sm" />
          </div>
        </div>
        <div class="cd-settings-form-row">
          <div class="cd-settings-form-label">Scopes</div>
          <div class="cd-settings-form-control">
            <input v-model="activeApp.scopes" class="form-control form-control-sm" />
            <div v-if="activePlatform === 'baidu'" class="form-text text-warning">
              百度个人开发者仅支持 <code>basic,netdisk</code>；<code>share</code> 分享权限未开放，填写后保存也会自动移除。
            </div>
            <div v-else-if="activePlatform === 'google'" class="form-text">
              需先在
              <a :href="CLOUD_OPEN_CONSOLE_URLS.google" target="_blank" rel="noopener noreferrer">Google Cloud</a>
              启用 Drive API，再创建 OAuth 客户端（类型选「Web 应用」），并把上方回调地址填入「已授权的重定向 URI」。
            </div>
            <div v-else-if="activePlatform === 'microsoft'" class="form-text">
              在
              <a :href="CLOUD_OPEN_CONSOLE_URLS.microsoft" target="_blank" rel="noopener noreferrer">Azure 应用注册</a>
              创建应用后，添加委托权限
              <code>Files.ReadWrite.All</code>、<code>User.Read</code>、<code>offline_access</code>，
              并把上方回调地址填入「重定向 URI」（平台选 Web）。
            </div>
          </div>
        </div>
        <div class="cd-settings-form-row">
          <div class="cd-settings-form-label">OAuth 回调地址</div>
          <div class="cd-settings-form-control">
            <div class="input-group input-group-sm">
              <input class="form-control font-monospace" readonly :value="displayCallbackUrl" />
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="!displayCallbackUrl || callbackLoading"
                @click="copyCallbackUrl"
              >
                复制
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="callbackLoading"
                title="重新检测当前环境下的回调地址"
                @click="loadCallbackUrl"
              >
                刷新
              </button>
            </div>
            <div class="form-text">{{ callbackSourceHint }}</div>
            <div class="form-text text-warning">
              须复制到云厂商「授权回调页」，与发起授权时<strong>完全一致</strong>。若报
              <code>redirect_uri_mismatch</code>，说明登记地址与上方不一致（常见：登记了 <code>:8080</code> 但当前为 <code>:5434</code>）。
              生产环境建议设置 <code>PUBLIC_BASE_URL</code>。
            </div>
          </div>
        </div>
        <div class="cd-settings-form-row">
          <div class="cd-settings-form-label">授权 URL</div>
          <div class="cd-settings-form-control">
            <input v-model="activeApp.auth_url" class="form-control form-control-sm" readonly />
          </div>
        </div>
        <div class="cd-settings-form-row">
          <div class="cd-settings-form-label">Token URL</div>
          <div class="cd-settings-form-control">
            <input v-model="activeApp.token_url" class="form-control form-control-sm" readonly />
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeApp" class="cd-settings-form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>

    <div class="cd-settings-section mt-4">
      <h4 class="h6 mb-2">存储源 OAuth 授权</h4>
      <p class="text-secondary small mb-3">
        保存上方应用凭证后，为已创建的 {{ activeApp?.name || '云盘' }} 存储源发起授权（与存储源列表中的「授权」按钮相同）。
      </p>
      <div v-if="storagesLoading" class="text-secondary small py-2">加载存储源…</div>
      <div v-else-if="platformStorages.length === 0" class="cd-settings-card">
        <p class="text-secondary small mb-2">
          暂无 {{ activeApp?.name }} 存储源。
        </p>
        <router-link class="btn btn-sm btn-outline-primary" to="/admin/storages?tab=storages">
          前往添加存储源
        </router-link>
      </div>
      <div v-else class="cd-cloud-auth-list">
        <div v-for="s in platformStorages" :key="s.id" class="cd-cloud-auth-item cd-settings-card">
          <div class="cd-cloud-auth-meta">
            <div class="cd-cloud-auth-name">{{ s.name }}</div>
            <div class="text-secondary small mt-1">
              根目录 <code>{{ s.config?.remote_path || '/' }}</code>
              <span v-if="s.config?.account_name"> · {{ s.config.account_name }}</span>
            </div>
            <div v-if="activePlatform === 'baidu'" class="text-secondary small mt-1">
              Scope：<code>{{ storageScopeText(s) }}</code>
            </div>
          </div>
          <div class="cd-cloud-auth-actions">
            <span
              class="badge rounded-pill"
              :class="s.config?.connected ? 'bg-green-lt text-green' : 'bg-secondary-lt text-secondary'"
            >
              {{ storageAuthLabel(s) }}
            </span>
            <button
              type="button"
              class="btn btn-sm btn-outline-primary"
              :disabled="cloudOAuthLoading === s.id || !form.enabled || !activeApp?.enabled"
              :title="!form.enabled || !activeApp?.enabled ? '请先启用云盘对接及当前平台' : 'OAuth 授权'"
              @click="connectCloudOAuth(s)"
            >
              <IconPlugConnected :size="16" class="me-1" />
              {{ cloudOAuthLoading === s.id ? '跳转中…' : 'OAuth 授权' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="cd-settings-section mt-4">
      <h4 class="h6 mb-2">配置流程</h4>
      <ol class="text-secondary small mb-0 ps-3">
        <li>在浏览器中通过实际访问地址打开本页（回调地址将据此自动生成）</li>
        <li>
          在云厂商开放平台注册应用，并填写上方 OAuth 回调地址（必须完全一致）：
          <a :href="CLOUD_OPEN_CONSOLE_URLS.baidu" target="_blank" rel="noopener noreferrer">百度</a>
          ·
          <a :href="CLOUD_OPEN_CONSOLE_URLS.microsoft" target="_blank" rel="noopener noreferrer">OneDrive</a>
          ·
          <a :href="CLOUD_OPEN_CONSOLE_URLS.google" target="_blank" rel="noopener noreferrer">Google Drive</a>
        </li>
        <li>填写 Client ID / Secret 并启用当前平台，保存本页</li>
        <li>前往 <router-link to="/admin/storages?tab=storages">存储源</router-link> 添加「百度网盘 / OneDrive / Google Drive」驱动（若尚未创建）</li>
        <li>在本页「存储源 OAuth 授权」或存储源列表中点击「OAuth 授权」，完成网盘账号授权</li>
        <li>在 <router-link to="/admin/storages?tab=sync">同步任务</router-link> 中配置本地/FTP → 云盘的同步规则</li>
      </ol>
    </div>
  </div>
</template>
