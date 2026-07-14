<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { IconPlus, IconTrash, IconPlayerPlay, IconRefresh } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as storageSyncsApi from '@/api/storageSyncs'
import type { StorageSyncRow } from '@/api/storageSyncs'
import * as storagesApi from '@/api/storages'
import type { StorageRow } from '@/types/files'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CdModal from '@/components/CdModal.vue'

const props = defineProps<{ storages: StorageRow[] }>()

const toast = useToast()
const auth = useAuthStore()
const syncs = ref<StorageSyncRow[]>([])
const loading = ref(false)
const showForm = ref(false)
const editing = ref<StorageSyncRow | null>(null)
const runningIds = ref<Set<string>>(new Set())
let pollTimer: ReturnType<typeof setInterval> | null = null

const scheduleOptions = [
  { value: 0, label: '仅手动执行' },
  { value: 15, label: '每 15 分钟' },
  { value: 30, label: '每 30 分钟' },
  { value: 60, label: '每 1 小时' },
  { value: 360, label: '每 6 小时' },
  { value: 1440, label: '每 24 小时' },
]

const emptyForm = () => ({
  name: '',
  source_storage_id: '',
  dest_storage_id: '',
  source_path: '/',
  dest_path: '/',
  mode: 'mirror',
  schedule_interval_minutes: 0,
  remark: '',
  enabled: true,
})

const form = ref(emptyForm())

const hasRunning = computed(() => syncs.value.some((s) => s.running || runningIds.value.has(s.id)))

function resetForm() {
  form.value = emptyForm()
  editing.value = null
}

function fillForm(s: StorageSyncRow) {
  form.value = {
    name: s.name,
    source_storage_id: s.source_storage_id,
    dest_storage_id: s.dest_storage_id,
    source_path: s.source_path || '/',
    dest_path: s.dest_path || '/',
    mode: s.mode || 'mirror',
    schedule_interval_minutes: s.schedule_interval_minutes ?? 0,
    remark: s.remark || '',
    enabled: s.enabled,
  }
}

async function load() {
  loading.value = true
  try {
    syncs.value = await storageSyncsApi.listStorageSyncs()
    runningIds.value = new Set(syncs.value.filter((s) => s.running).map((s) => s.id))
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(s: StorageSyncRow) {
  editing.value = s
  fillForm(s)
  showForm.value = true
}

async function save() {
  const payload = {
    name: form.value.name,
    source_storage_id: form.value.source_storage_id,
    dest_storage_id: form.value.dest_storage_id,
    source_path: form.value.source_path || '/',
    dest_path: form.value.dest_path || '/',
    mode: form.value.mode,
    schedule_interval_minutes: form.value.schedule_interval_minutes,
    remark: form.value.remark,
    enabled: form.value.enabled,
  }
  try {
    if (editing.value) {
      await storageSyncsApi.updateStorageSync(editing.value.id, payload)
      toast.show('已保存')
    } else {
      await storageSyncsApi.createStorageSync(payload)
      toast.show('已创建')
    }
    showForm.value = false
    resetForm()
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  }
}

async function remove(s: StorageSyncRow) {
  if (!confirm(`删除同步任务「${s.name}」？`)) return
  try {
    await storageSyncsApi.deleteStorageSync(s.id)
    toast.show('已删除')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '删除失败')
  }
}

async function runSync(s: StorageSyncRow) {
  if (s.running || runningIds.value.has(s.id)) return
  try {
    runningIds.value.add(s.id)
    await storageSyncsApi.runStorageSync(s.id)
    toast.show('同步已开始，后台执行中')
    await load()
  } catch (e) {
    runningIds.value.delete(s.id)
    toast.show(e instanceof ApiError ? e.message : '触发失败')
  }
}

function storageName(id: string) {
  return props.storages.find((s) => s.id === id)?.name || id
}

function storageDriver(id: string) {
  return props.storages.find((s) => s.id === id)?.driver || ''
}

function scheduleLabel(minutes: number) {
  return scheduleOptions.find((o) => o.value === minutes)?.label || (minutes > 0 ? `每 ${minutes} 分钟` : '仅手动')
}

function formatTime(raw?: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString()
}

function statusBadgeClass(s: StorageSyncRow) {
  if (s.running || runningIds.value.has(s.id)) return 'bg-blue-lt text-blue'
  if (s.last_status === 'success') return 'bg-green-lt text-green'
  if (s.last_status === 'failed') return 'bg-red-lt text-red'
  return 'bg-secondary-lt'
}

function statusLabel(s: StorageSyncRow) {
  if (s.running || runningIds.value.has(s.id)) return '执行中'
  if (s.last_status === 'success') return '上次成功'
  if (s.last_status === 'failed') return '上次失败'
  return '未执行'
}

function statsSummary(s: StorageSyncRow) {
  const st = s.last_stats
  if (!st) return ''
  return `上传 ${st.uploaded} · 跳过 ${st.skipped} · 删除 ${st.deleted}${st.failed ? ` · 失败 ${st.failed}` : ''}`
}

onMounted(() => {
  load()
  pollTimer = setInterval(() => {
    if (hasRunning.value) load()
  }, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div>
    <div class="d-flex gap-2 mb-3 flex-wrap align-items-center">
      <button type="button" class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" @click="openCreate">
        <IconPlus :size="16" /> 添加同步任务
      </button>
      <button type="button" class="btn btn-sm d-inline-flex align-items-center gap-1" :disabled="loading" @click="load">
        <IconRefresh :size="16" /> 刷新
      </button>
      <span class="text-secondary small">
        可将本地/FTP/SMB 等指定目录同步到百度网盘、OneDrive、Google Drive 的指定目录；支持定时调度
      </span>
    </div>

    <div class="cd-admin-cards cd-sync-cards" :class="{ 'opacity-50': loading && syncs.length }">
      <article v-for="s in syncs" :key="s.id" class="cd-admin-card">
        <div class="cd-admin-card-head">
          <span class="cd-admin-card-icon cd-storage-card-icon cd-storage-card-icon--baidu_pan">
            <IconPlayerPlay :size="20" />
          </span>
          <div class="min-w-0 flex-fill">
            <h3 class="cd-admin-card-title">{{ s.name }}</h3>
            <p v-if="s.remark" class="cd-admin-card-desc">{{ s.remark }}</p>
            <div class="cd-admin-card-badges">
              <span class="badge" :class="s.enabled ? 'bg-green-lt text-green' : 'bg-secondary-lt'">
                {{ s.enabled ? '启用' : '禁用' }}
              </span>
              <span class="badge bg-secondary-lt">{{ s.mode === 'mirror' ? '镜像' : '增量上传' }}</span>
              <span class="badge" :class="statusBadgeClass(s)">{{ statusLabel(s) }}</span>
              <span v-if="s.schedule_interval_minutes > 0" class="badge bg-purple-lt text-purple">
                {{ scheduleLabel(s.schedule_interval_minutes) }}
              </span>
            </div>
          </div>
        </div>
        <div class="cd-admin-card-body">
          <dl class="cd-admin-card-meta mb-0">
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">源</dt>
              <dd class="cd-admin-card-meta-value mb-0">
                {{ storageName(s.source_storage_id) }}
                <span class="text-secondary">({{ storageDriver(s.source_storage_id) }})</span>
              </dd>
            </div>
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">目标</dt>
              <dd class="cd-admin-card-meta-value mb-0">
                {{ storageName(s.dest_storage_id) }}
                <span class="text-secondary">({{ storageDriver(s.dest_storage_id) }})</span>
              </dd>
            </div>
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">源目录</dt>
              <dd class="cd-admin-card-meta-value mb-0 font-monospace">{{ s.source_path }}</dd>
            </div>
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">目标目录</dt>
              <dd class="cd-admin-card-meta-value mb-0 font-monospace">{{ s.dest_path }}</dd>
            </div>
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">上次执行</dt>
              <dd class="cd-admin-card-meta-value mb-0">{{ formatTime(s.last_run_at) }}</dd>
            </div>
            <div v-if="statsSummary(s)" class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">统计</dt>
              <dd class="cd-admin-card-meta-value mb-0">{{ statsSummary(s) }}</dd>
            </div>
            <div v-if="s.last_error" class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label text-red">错误</dt>
              <dd class="cd-admin-card-meta-value mb-0 text-red small">{{ s.last_error }}</dd>
            </div>
          </dl>
        </div>
        <div class="cd-admin-card-foot">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            :disabled="s.running || runningIds.has(s.id)"
            @click="runSync(s)"
          >
            <IconPlayerPlay :size="16" />
            {{ s.running || runningIds.has(s.id) ? '执行中…' : '立即同步' }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost-secondary" @click="openEdit(s)">编辑</button>
          <button
            v-if="auth.isSuperAdmin"
            type="button"
            class="btn btn-sm btn-ghost-danger d-inline-flex align-items-center gap-1"
            @click="remove(s)"
          >
            <IconTrash :size="16" /> 删除
          </button>
        </div>
      </article>

      <div v-if="loading && !syncs.length" class="cd-admin-cards-empty">
        <div class="card"><div class="card-body text-center text-secondary">加载中…</div></div>
      </div>
      <div v-else-if="!syncs.length" class="cd-admin-cards-empty">
        <div class="card"><div class="card-body text-center text-secondary">暂无同步任务</div></div>
      </div>
    </div>

    <CdModal :show="showForm" :title="editing ? '编辑同步任务' : '添加同步任务'" @close="showForm = false">
      <form @submit.prevent="save">
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">任务名称</label>
            <input v-model="form.name" class="form-control" required placeholder="例如：文档备份到百度网盘" />
          </div>
          <div class="row g-2">
            <div class="col-sm-6">
              <label class="form-label">源存储源</label>
              <select v-model="form.source_storage_id" class="form-select" required>
                <option value="" disabled>选择源（本地/FTP/SMB 等）</option>
                <option v-for="s in storages" :key="s.id" :value="s.id">{{ s.name }} ({{ s.driver }})</option>
              </select>
            </div>
            <div class="col-sm-6">
              <label class="form-label">目标存储源</label>
              <select v-model="form.dest_storage_id" class="form-select" required>
                <option value="" disabled>选择目标（云盘）</option>
                <option v-for="s in storages" :key="s.id" :value="s.id">{{ s.name }} ({{ s.driver }})</option>
              </select>
            </div>
          </div>
          <div class="row g-2 mt-2">
            <div class="col-sm-6">
              <label class="form-label">源目录</label>
              <input v-model="form.source_path" class="form-control font-monospace" placeholder="/docs" />
              <div class="form-text">源存储源中要同步的目录</div>
            </div>
            <div class="col-sm-6">
              <label class="form-label">目标目录</label>
              <input v-model="form.dest_path" class="form-control font-monospace" placeholder="/backup/docs" />
              <div class="form-text">写入目标网盘的目录（自动创建）</div>
            </div>
          </div>
          <div class="row g-2 mt-2">
            <div class="col-sm-6">
              <label class="form-label">同步模式</label>
              <select v-model="form.mode" class="form-select">
                <option value="mirror">镜像（增量上传 + 删除目标多余文件）</option>
                <option value="upload">仅上传（跳过已存在且大小相同的文件）</option>
              </select>
            </div>
            <div class="col-sm-6">
              <label class="form-label">定时执行</label>
              <select v-model.number="form.schedule_interval_minutes" class="form-select">
                <option v-for="o in scheduleOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>
          <div class="mb-3 mt-2">
            <label class="form-label">备注</label>
            <input v-model="form.remark" class="form-control" placeholder="可选" />
          </div>
          <label class="form-check">
            <input v-model="form.enabled" class="form-check-input" type="checkbox" />
            <span class="form-check-label">启用（含定时调度）</span>
          </label>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showForm = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">保存</button>
        </div>
      </form>
    </CdModal>
  </div>
</template>
