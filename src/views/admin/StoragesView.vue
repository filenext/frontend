<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconPlus, IconPencil, IconTrash, IconPlugConnected, IconLink, IconFolder, IconCloud, IconDatabase, IconServer, IconShare, IconWorldWww, IconShieldLock } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as storagesApi from '@/api/storages'
import * as settingsApi from '@/api/settings'
import type { CloudStorageSettings } from '@/api/settings'
import type { StorageConfig, StorageRow } from '@/types/files'
import { useToast } from '@/composables/useToast'
import { usePageSize } from '@/composables/usePageSize'
import { useAuthStore } from '@/stores/auth'
import {
  defaultCloudStorageSettings,
  isCloudStorageDriver,
  mergeCloudStorageApps,
} from '@/constants/cloudStoragePresets'
import CdModal from '@/components/CdModal.vue'
import CdPagination from '@/components/CdPagination.vue'
import CloudStoragePanel from './config/CloudStoragePanel.vue'
import StorageSyncPanel from './StorageSyncPanel.vue'
import StoragePermissionsModal from '@/components/admin/StoragePermissionsModal.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const { pageSize, ensurePageSize } = usePageSize()

const storages = ref<StorageRow[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const showForm = ref(false)
const editing = ref<StorageRow | null>(null)
const testing = ref(false)
const cloudOAuthLoading = ref<string | null>(null)
const cloudStorage = ref<CloudStorageSettings>(defaultCloudStorageSettings())
const cloudLoading = ref(false)
const permStorage = ref<StorageRow | null>(null)
const showPermissions = ref(false)

type StoragePageTab = 'storages' | 'cloud' | 'sync'

const pageTab = computed((): StoragePageTab => {
  const tab = route.query.tab
  if (tab === 'sync' || tab === 'cloud') return tab
  return 'storages'
})

function emptyForm() {
  return {
    name: '',
    driver: 'local',
    root_path: '/',
    enabled: true,
    sort_order: 0,
    remark: '',
    base_path: '',
    endpoint: '',
    bucket: '',
    access_key: '',
    secret_key: '',
    region: 'us-east-1',
    use_ssl: true,
    prefix: '',
    host: '',
    port: 21,
    username: '',
    password: '',
    url: '',
    server: '',
    export: '',
    mount_point: '',
    sub_path: '',
    version: 4,
    options: '',
    share: '',
    domain: '',
    remote_path: '/',
  }
}

const form = ref(emptyForm())

const driverOptions = [
  { value: 'local', label: '本地存储' },
  { value: 'nfs', label: 'NFS' },
  { value: 'smb', label: 'SMB/CIFS' },
  { value: 'baidu_pan', label: '百度网盘（OAuth）' },
  { value: 'onedrive', label: 'OneDrive（OAuth）' },
  { value: 'google_drive', label: 'Google Drive（OAuth）' },
  { value: 's3', label: 'S3 兼容' },
  { value: 'ftp', label: 'FTP' },
  { value: 'sftp', label: 'SFTP' },
  { value: 'webdav', label: 'WebDAV' },
]

type StorageMetaRow = { label: string; value: string; mono?: boolean; title?: string }

function driverLabel(driver: string) {
  return driverOptions.find((d) => d.value === driver)?.label || driver
}

function driverIcon(driver: string) {
  switch (driver) {
    case 'local':
      return IconFolder
    case 'baidu_pan':
    case 'onedrive':
    case 'google_drive':
      return IconCloud
    case 's3':
      return IconDatabase
    case 'webdav':
      return IconWorldWww
    case 'nfs':
    case 'ftp':
    case 'sftp':
      return IconServer
    case 'smb':
      return IconShare
    default:
      return IconDatabase
  }
}

function secretStatus(value?: string) {
  return value?.trim() ? '已配置' : '未配置'
}

function storageMetaRows(s: StorageRow): StorageMetaRow[] {
  const c = s.config || {}
  const rows: StorageMetaRow[] = [
    { label: 'ID', value: s.id, mono: true },
    { label: '排序', value: String(s.sort_order ?? 0) },
    { label: '驱动', value: driverLabel(s.driver), title: s.driver },
    { label: '虚拟根路径', value: s.root_path || '/', mono: true },
  ]

  switch (s.driver) {
    case 's3':
      rows.push(
        { label: 'Endpoint', value: c.endpoint || '—', mono: true },
        { label: 'Bucket', value: c.bucket || '—', mono: true },
        { label: 'Region', value: c.region || '—' },
        { label: '对象前缀', value: c.prefix?.trim() || '—', mono: true },
        { label: 'Access Key', value: c.access_key || '—', mono: true },
        { label: 'Secret Key', value: secretStatus(c.secret_key) },
        { label: 'HTTPS', value: c.use_ssl !== false ? '是' : '否' },
      )
      break
    case 'ftp':
    case 'sftp':
      rows.push(
        { label: '主机', value: c.host || '—', mono: true },
        { label: '端口', value: String(c.port || (s.driver === 'sftp' ? 22 : 21)) },
        { label: '用户名', value: c.username || '—' },
        { label: '密码', value: secretStatus(c.password) },
        { label: '远端根目录', value: c.base_path || '/', mono: true },
      )
      break
    case 'smb':
      rows.push(
        { label: '主机', value: c.host || '—', mono: true },
        { label: '端口', value: String(c.port || 445) },
        { label: '共享名', value: c.share || '—', mono: true },
        { label: '域', value: c.domain?.trim() || '—' },
        { label: '用户名', value: c.username || '—' },
        { label: '密码', value: secretStatus(c.password) },
        { label: '共享内目录', value: c.base_path?.trim() || '—', mono: true },
      )
      break
    case 'webdav':
      rows.push(
        { label: 'URL', value: c.url || '—', mono: true },
        { label: '用户名', value: c.username || '—' },
        { label: '密码', value: secretStatus(c.password) },
      )
      break
    case 'nfs':
      rows.push(
        { label: 'NFS 服务器', value: c.server?.trim() || '—', mono: true },
        { label: '导出路径', value: c.export?.trim() || '—', mono: true },
        { label: '挂载点', value: c.mount_point || '—', mono: true },
        { label: '子目录', value: c.sub_path?.trim() || '—', mono: true },
        { label: 'NFS 版本', value: `v${c.version || 4}` },
        { label: '挂载选项', value: c.options?.trim() || '—', mono: true },
      )
      break
    case 'baidu_pan':
    case 'onedrive':
    case 'google_drive':
      rows.push(
        { label: '网盘根目录', value: c.remote_path || '/', mono: true },
        { label: 'OAuth 授权', value: c.connected ? '已授权' : '未授权' },
        { label: '账号', value: c.account_name?.trim() || '—' },
        { label: 'Token 过期', value: c.token_expiry ? formatDateTime(c.token_expiry) : '—' },
      )
      if (s.driver === 'baidu_pan') {
        const scope = String(c.oauth_scope || '').trim()
        rows.push({ label: 'OAuth Scope', value: scope || '—', mono: true })
        if (c.connected && !scope.split(/\s+/).includes('share')) {
          rows.push({
            label: '分享能力',
            value: '原生分享 API 未开放，文件页将使用平台分享',
          })
        }
      }
      break
    default:
      rows.push({ label: '本地路径', value: c.base_path?.trim() || '（默认 STORAGE_LOCAL_ROOT）', mono: true })
  }

  return rows
}

function formatDateTime(raw: string) {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

function resetForm() {
  form.value = emptyForm()
  editing.value = null
}

function fillForm(s: StorageRow) {
  const c = s.config || {}
  form.value = {
    name: s.name,
    driver: s.driver,
    root_path: s.root_path || '/',
    enabled: s.enabled,
    sort_order: s.sort_order ?? 0,
    remark: s.remark || '',
    base_path: c.base_path || '',
    endpoint: c.endpoint || '',
    bucket: c.bucket || '',
    access_key: c.access_key || '',
    secret_key: c.secret_key || '',
    region: c.region || 'us-east-1',
    use_ssl: c.use_ssl !== false,
    prefix: c.prefix || '',
    host: c.host || '',
    port: s.driver === 'smb' ? (c.port || 445) : s.driver === 'sftp' ? (c.port || 22) : (c.port || 21),
    username: c.username || '',
    password: c.password || '',
    url: c.url || '',
    server: c.server || '',
    export: c.export || '',
    mount_point: c.mount_point || '',
    sub_path: c.sub_path || '',
    version: c.version || 4,
    options: c.options || '',
    share: c.share || '',
    domain: c.domain || '',
    remote_path: c.remote_path || '/',
  }
}

function buildConfig(): StorageConfig {
  const f = form.value
  if (isCloudStorageDriver(f.driver)) {
    return { remote_path: f.remote_path || '/' }
  }
  switch (f.driver) {
    case 's3':
      return {
        endpoint: f.endpoint,
        bucket: f.bucket,
        access_key: f.access_key,
        secret_key: f.secret_key,
        region: f.region,
        use_ssl: f.use_ssl,
        prefix: f.prefix || undefined,
      }
    case 'ftp':
      return {
        host: f.host,
        port: f.port || 21,
        username: f.username,
        password: f.password,
        base_path: f.base_path || '/',
      }
    case 'sftp':
      return {
        host: f.host,
        port: f.port || 22,
        username: f.username,
        password: f.password,
        base_path: f.base_path || '/',
      }
    case 'smb':
      return {
        host: f.host,
        port: f.port || 445,
        username: f.username,
        password: f.password,
        domain: f.domain || undefined,
        share: f.share,
        base_path: f.base_path || undefined,
      }
    case 'webdav':
      return {
        url: f.url,
        username: f.username,
        password: f.password,
      }
    case 'nfs':
      return {
        server: f.server || undefined,
        export: f.export || undefined,
        mount_point: f.mount_point,
        sub_path: f.sub_path || undefined,
        version: f.version || 4,
        options: f.options || undefined,
      }
    default:
      return { base_path: f.base_path || undefined }
  }
}

async function load() {
  loading.value = true
  try {
    const res = await storagesApi.listStorages({ page: page.value, page_size: pageSize.value })
    storages.value = res.items
    total.value = res.total
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

watch(page, () => load())

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(s: StorageRow) {
  editing.value = s
  fillForm(s)
  showForm.value = true
}

async function save() {
  const payload = {
    name: form.value.name,
    driver: form.value.driver,
    root_path: form.value.root_path || '/',
    enabled: form.value.enabled,
    sort_order: form.value.sort_order ?? 0,
    remark: form.value.remark,
    config: buildConfig(),
  }
  try {
    if (editing.value) {
      await storagesApi.updateStorage(editing.value.id, payload)
      toast.show('已保存')
    } else {
      await storagesApi.createStorage(payload)
      toast.show('已添加')
    }
    showForm.value = false
    resetForm()
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  }
}

async function toggleEnabled(s: StorageRow) {
  try {
    await storagesApi.updateStorage(s.id, { enabled: !s.enabled })
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '操作失败')
  }
}

async function remove(s: StorageRow) {
  if (!confirm(`删除存储源「${s.name}」？不会删除远端或磁盘上的实际文件。`)) return
  try {
    await storagesApi.deleteStorage(s.id)
    toast.show('已删除')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '删除失败')
  }
}

async function testForm() {
  testing.value = true
  try {
    await storagesApi.testStorageConfig(form.value.driver, buildConfig())
    toast.show('连接正常')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '连接失败')
  } finally {
    testing.value = false
  }
}

async function testConnection(s: StorageRow) {
  try {
    await storagesApi.testStorage(s.id)
    toast.show(`「${s.name}」连接正常`)
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '连接失败')
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
    window.location.href = url
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '获取授权链接失败')
    cloudOAuthLoading.value = null
  }
}

function openPermissions(s: StorageRow) {
  permStorage.value = s
  showPermissions.value = true
}

function switchTab(tab: StoragePageTab) {
  const query: Record<string, string> = { tab }
  if (tab === 'cloud') {
    const platform = route.query.platform
    query.platform = typeof platform === 'string' ? platform : 'baidu'
  }
  router.replace({ path: '/admin/storages', query })
}

async function loadCloudStorage() {
  cloudLoading.value = true
  try {
    cloudStorage.value = await settingsApi.getSettings<CloudStorageSettings>('cloud_storage')
    cloudStorage.value.apps = mergeCloudStorageApps(cloudStorage.value.apps || [])
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载云盘配置失败')
  } finally {
    cloudLoading.value = false
  }
}

function handleCloudOAuthQuery() {
  const status = route.query.cloud_oauth as string
  if (!status) return
  if (status === 'ok') toast.show('云盘 OAuth 授权成功')
  else if (status === 'denied') toast.show('已取消云盘授权')
  else if (status === 'error') toast.show('云盘 OAuth 授权失败')
  const tab = route.query.tab === 'cloud' ? 'cloud' : 'storages'
  const query: Record<string, string> = { tab }
  if (tab === 'cloud' && typeof route.query.platform === 'string') {
    query.platform = route.query.platform
  }
  router.replace({ path: '/admin/storages', query })
}

onMounted(async () => {
  await ensurePageSize()
  if (!route.query.tab) {
    await router.replace({ path: '/admin/storages', query: { tab: 'storages' } })
  }
  handleCloudOAuthQuery()
  if (pageTab.value === 'cloud') {
    await loadCloudStorage()
  } else {
    load()
  }
})

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'cloud') loadCloudStorage()
    else load()
  },
)
</script>

<template>
  <div>
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button type="button" class="nav-link" :class="{ active: pageTab === 'storages' }" @click="switchTab('storages')">
          存储源
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" :class="{ active: pageTab === 'cloud' }" @click="switchTab('cloud')">
          云盘对接
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" :class="{ active: pageTab === 'sync' }" @click="switchTab('sync')">
          同步任务
        </button>
      </li>
    </ul>

    <div v-if="pageTab === 'cloud'">
      <div v-if="cloudLoading" class="text-center text-secondary py-5">加载中…</div>
      <CloudStoragePanel v-else v-model="cloudStorage" />
    </div>

    <StorageSyncPanel v-else-if="pageTab === 'sync'" :storages="storages" />

    <template v-else>
    <div class="d-flex gap-2 mb-3 flex-wrap align-items-center">
      <button type="button" class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" @click="openCreate">
        <IconPlus :size="16" /> 添加存储源
      </button>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="load">刷新</button>
      <span class="text-secondary small">
        云盘驱动需先在「云盘对接」填写应用凭证，保存后在此 OAuth 授权
      </span>
    </div>

    <div class="cd-admin-cards cd-storage-cards" :class="{ 'opacity-50': loading && storages.length }">
      <article
        v-for="s in storages"
        :key="s.id"
        class="cd-admin-card cd-storage-card"
        :class="{ 'cd-storage-card--disabled': !s.enabled }"
      >
        <div class="cd-admin-card-head">
          <span class="cd-admin-card-icon cd-storage-card-icon" :class="`cd-storage-card-icon--${s.driver}`">
            <component :is="driverIcon(s.driver)" :size="20" />
          </span>
          <div class="min-w-0 flex-fill">
            <h3 class="cd-admin-card-title">{{ s.name }}</h3>
            <p v-if="s.remark" class="cd-admin-card-desc">{{ s.remark }}</p>
            <div class="cd-admin-card-badges">
              <span class="badge" :class="s.enabled ? 'bg-green-lt text-green' : 'bg-secondary-lt'">
                {{ s.enabled ? '启用' : '禁用' }}
              </span>
              <span class="badge bg-blue-lt text-blue">{{ driverLabel(s.driver) }}</span>
              <span
                v-if="isCloudStorageDriver(s.driver)"
                class="badge"
                :class="s.config?.connected ? 'bg-blue-lt text-blue' : 'bg-yellow-lt text-yellow'"
              >
                {{ s.config?.connected ? '已授权' : '未授权' }}
              </span>
            </div>
          </div>
        </div>
        <div class="cd-admin-card-body">
          <dl class="cd-admin-card-meta mb-0">
            <div v-for="row in storageMetaRows(s)" :key="`${s.id}-${row.label}`" class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">{{ row.label }}</dt>
              <dd
                class="cd-admin-card-meta-value mb-0"
                :class="{ 'font-monospace': row.mono, 'text-truncate': row.mono }"
                :title="row.title || row.value"
              >
                {{ row.value }}
              </dd>
            </div>
          </dl>
        </div>
        <div class="cd-admin-card-foot">
          <button type="button" class="btn btn-sm" @click="toggleEnabled(s)">
            {{ s.enabled ? '禁用' : '启用' }}
          </button>
          <button
            v-if="isCloudStorageDriver(s.driver)"
            type="button"
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            title="OAuth 授权"
            :disabled="cloudOAuthLoading === s.id"
            @click="connectCloudOAuth(s)"
          >
            <IconLink :size="16" />
            {{ cloudOAuthLoading === s.id ? '跳转中…' : '授权' }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            title="测试连接"
            @click="testConnection(s)"
          >
            <IconPlugConnected :size="16" />
            测试
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" @click="openPermissions(s)">
            <IconShieldLock :size="16" />
            权限
          </button>
          <button type="button" class="btn btn-sm btn-ghost-secondary d-inline-flex align-items-center gap-1" @click="openEdit(s)">
            <IconPencil :size="16" />
            编辑
          </button>
          <button
            v-if="auth.isSuperAdmin"
            type="button"
            class="btn btn-sm btn-ghost-danger d-inline-flex align-items-center gap-1"
            @click="remove(s)"
          >
            <IconTrash :size="16" />
            删除
          </button>
        </div>
      </article>

      <div v-if="loading && !storages.length" class="cd-admin-cards-empty">
        <div class="card">
          <div class="card-body text-center text-secondary">加载中…</div>
        </div>
      </div>
      <div v-else-if="!storages.length" class="cd-admin-cards-empty">
        <div class="card">
          <div class="card-body text-center text-secondary">暂无存储源，点击上方添加</div>
        </div>
      </div>
    </div>

    <div class="cd-admin-cards-pagination">
      <CdPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
    </div>

    <CdModal :show="showForm" :title="editing ? '编辑存储源' : '添加存储源'" @close="showForm = false">
      <form @submit.prevent="save">
        <div class="modal-body">
          <div class="row g-2 mb-3">
            <div class="col-sm-8">
              <label class="form-label">名称</label>
              <input v-model="form.name" class="form-control" required placeholder="例如：对象存储" />
            </div>
            <div class="col-sm-4">
              <label class="form-label">排序</label>
              <input v-model.number="form.sort_order" class="form-control" type="number" min="0" />
            </div>
          </div>
          <div class="row g-2">
            <div class="col-sm-6">
              <label class="form-label">驱动类型</label>
              <select v-model="form.driver" class="form-select">
                <option v-for="d in driverOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
            </div>
            <div class="col-sm-6">
              <label class="form-label">虚拟根路径</label>
              <input v-model="form.root_path" class="form-control" placeholder="/" />
            </div>
          </div>

          <template v-if="form.driver === 'local'">
            <div class="mb-3 mt-2">
              <label class="form-label">本地磁盘路径</label>
              <input v-model="form.base_path" class="form-control" placeholder="留空使用 STORAGE_LOCAL_ROOT" />
            </div>
          </template>

          <template v-else-if="form.driver === 's3'">
            <div class="row g-2 mt-1">
              <div class="col-sm-8">
                <label class="form-label">Endpoint</label>
                <input v-model="form.endpoint" class="form-control" required placeholder="oss-cn-hangzhou.aliyuncs.com（勿含 https:// 或路径）" />
              </div>
              <div class="col-sm-4">
                <label class="form-label">Bucket</label>
                <input v-model="form.bucket" class="form-control" required />
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-sm-6">
                <label class="form-label">Access Key</label>
                <input v-model="form.access_key" class="form-control" required />
              </div>
              <div class="col-sm-6">
                <label class="form-label">Secret Key</label>
                <input v-model="form.secret_key" class="form-control" type="password" required />
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-sm-6">
                <label class="form-label">Region</label>
                <input v-model="form.region" class="form-control" placeholder="oss-cn-hangzhou" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">对象前缀（可选）</label>
                <input v-model="form.prefix" class="form-control" placeholder="data/files" />
              </div>
            </div>
            <label class="form-check mt-2">
              <input v-model="form.use_ssl" class="form-check-input" type="checkbox" />
              <span class="form-check-label">使用 HTTPS</span>
            </label>
          </template>

          <template v-else-if="form.driver === 'ftp' || form.driver === 'sftp'">
            <div class="row g-2 mt-1">
              <div class="col-sm-8">
                <label class="form-label">主机</label>
                <input v-model="form.host" class="form-control" required :placeholder="form.driver === 'sftp' ? 'sftp.example.com' : 'ftp.example.com'" />
              </div>
              <div class="col-sm-4">
                <label class="form-label">端口</label>
                <input v-model.number="form.port" class="form-control" type="number" min="1" max="65535" :placeholder="form.driver === 'sftp' ? '22' : '21'" />
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-sm-6">
                <label class="form-label">用户名</label>
                <input v-model="form.username" class="form-control" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">密码</label>
                <input v-model="form.password" class="form-control" type="password" />
              </div>
            </div>
            <div class="mb-3 mt-2">
              <label class="form-label">远端根目录</label>
              <input v-model="form.base_path" class="form-control" placeholder="/" />
            </div>
          </template>

          <template v-else-if="form.driver === 'smb'">
            <div class="row g-2 mt-1">
              <div class="col-sm-8">
                <label class="form-label">主机</label>
                <input v-model="form.host" class="form-control" required placeholder="192.168.1.10 或 nas.local" />
              </div>
              <div class="col-sm-4">
                <label class="form-label">端口</label>
                <input v-model.number="form.port" class="form-control" type="number" min="1" max="65535" placeholder="445" />
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-sm-6">
                <label class="form-label">共享名</label>
                <input v-model="form.share" class="form-control" required placeholder="public 或 \\nas\public" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">域（可选）</label>
                <input v-model="form.domain" class="form-control" placeholder="WORKGROUP" />
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-sm-6">
                <label class="form-label">用户名</label>
                <input v-model="form.username" class="form-control" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">密码</label>
                <input v-model="form.password" class="form-control" type="password" />
              </div>
            </div>
            <div class="mb-3 mt-2">
              <label class="form-label">共享内根目录（可选）</label>
              <input v-model="form.base_path" class="form-control" placeholder="shared/docs" />
            </div>
          </template>

          <template v-else-if="form.driver === 'webdav'">
            <div class="mb-3 mt-2">
              <label class="form-label">WebDAV URL</label>
              <input v-model="form.url" class="form-control" required placeholder="https://dav.example.com/remote" />
            </div>
            <div class="row g-2">
              <div class="col-sm-6">
                <label class="form-label">用户名</label>
                <input v-model="form.username" class="form-control" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">密码</label>
                <input v-model="form.password" class="form-control" type="password" />
              </div>
            </div>
          </template>

          <template v-else-if="form.driver === 'nfs'">
            <div class="row g-2 mt-1">
              <div class="col-sm-6">
                <label class="form-label">NFS 服务器</label>
                <input v-model="form.server" class="form-control" placeholder="192.168.1.10（预挂载时可留空）" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">导出路径</label>
                <input v-model="form.export" class="form-control" placeholder="/export/data" />
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-sm-6">
                <label class="form-label">挂载点</label>
                <input v-model="form.mount_point" class="form-control" required placeholder="/mnt/nfs-data" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">子目录（可选）</label>
                <input v-model="form.sub_path" class="form-control" placeholder="team/docs" />
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-sm-4">
                <label class="form-label">NFS 版本</label>
                <select v-model.number="form.version" class="form-select">
                  <option :value="4">NFSv4</option>
                  <option :value="3">NFSv3</option>
                </select>
              </div>
              <div class="col-sm-8">
                <label class="form-label">挂载选项（可选）</label>
                <input v-model="form.options" class="form-control" placeholder="nolock,rw" />
              </div>
            </div>
            <p class="text-secondary small mb-0 mt-2">
              填写服务器与导出路径时，测试/使用时将自动执行 mount；若已在宿主机挂载，可只填挂载点与子目录。
            </p>
          </template>

          <template v-else-if="isCloudStorageDriver(form.driver)">
            <div class="alert alert-info py-2 px-3 mt-2 mb-0 small">
              使用「云盘对接」中的应用凭证；保存后在列表或下方点击 OAuth 授权连接网盘账号。
              尚未配置时可切换到上方「云盘对接」标签页。
            </div>
            <div class="mb-3 mt-2">
              <label class="form-label">网盘内根目录</label>
              <input
                v-model="form.remote_path"
                class="form-control"
                :placeholder="form.driver === 'baidu_pan' ? '/apps/你的应用名' : '/backup'"
              />
              <p v-if="form.driver === 'baidu_pan'" class="text-secondary small mb-0 mt-1">
                百度开放平台要求上传路径位于 <code>/apps/应用名/</code> 下，请填写创建应用时的目录。
              </p>
            </div>
          </template>

          <div class="mb-3 mt-2">
            <label class="form-label">备注</label>
            <input v-model="form.remark" class="form-control" placeholder="可选" />
          </div>
          <label class="form-check">
            <input v-model="form.enabled" class="form-check-input" type="checkbox" />
            <span class="form-check-label">启用</span>
          </label>
        </div>
        <div class="modal-footer">
          <button
            v-if="editing && isCloudStorageDriver(editing.driver)"
            type="button"
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 me-auto"
            :disabled="cloudOAuthLoading === editing.id"
            @click="connectCloudOAuth(editing)"
          >
            <IconLink :size="16" />
            {{ cloudOAuthLoading === editing.id ? '跳转中…' : 'OAuth 授权' }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 me-auto"
            :disabled="testing"
            @click="testForm"
          >
            <IconPlugConnected :size="16" />
            {{ testing ? '测试中…' : '测试连接' }}
          </button>
          <button type="button" class="btn btn-sm" @click="showForm = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">保存</button>
        </div>
      </form>
    </CdModal>

    <StoragePermissionsModal
      :show="showPermissions"
      :storage-id="permStorage?.id || ''"
      :storage-name="permStorage?.name || ''"
      @close="showPermissions = false"
    />
    </template>

    <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
  </div>
</template>
