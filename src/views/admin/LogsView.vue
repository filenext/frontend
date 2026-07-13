<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconSearch,
  IconRefresh,
  IconListDetails,
  IconLogin2,
  IconShieldCheck,
  IconRepeat,
} from '@tabler/icons-vue'
import { fmtDate, ApiError } from '@/api/client'
import * as logsApi from '@/api/sysLogs'
import type { LogCategory, SysLogRow } from '@/api/sysLogs'
import { usePageSize } from '@/composables/usePageSize'
import { useToast } from '@/composables/useToast'
import CdPagination from '@/components/CdPagination.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { pageSize, ensurePageSize } = usePageSize()

const tabs: { key: LogCategory; label: string; icon: typeof IconListDetails }[] = [
  { key: 'log', label: '操作日志', icon: IconListDetails },
  { key: 'sync', label: '同步日志', icon: IconRepeat },
  { key: 'login', label: '登录日志', icon: IconLogin2 },
  { key: 'audit', label: '审计日志', icon: IconShieldCheck },
]

const items = ref<SysLogRow[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const keyword = ref('')
const result = ref('')

const activeTab = computed<LogCategory>(() => {
  const t = route.query.tab
  if (t === 'login' || t === 'audit' || t === 'sync') return t
  return 'log'
})

const showTypeColumn = computed(() => activeTab.value === 'log')

const subTagOptions = [
  { value: '', label: '全部子类型' },
  { value: 'file', label: '文件' },
  { value: 'storage', label: '存储' },
  { value: 'operation', label: '配置操作' },
  { value: 'share', label: '分享' },
  { value: 'agent', label: '智能体' },
  { value: 'department', label: '部门' },
  { value: 'plugin', label: '插件' },
  { value: 'site', label: '站点' },
]

const subTag = ref('')

const resultOptions = [
  { value: '', label: '全部结果' },
  { value: 'ok', label: '成功' },
  { value: 'fail', label: '失败' },
]

function tagLabel(v: string) {
  const map: Record<string, string> = {
    login: '登录',
    operation: '操作',
    audit: '审计',
    sync: '同步',
    file: '文件',
    storage: '存储',
    share: '分享',
    agent: '智能体',
    department: '部门',
    plugin: '插件',
    site: '站点',
  }
  return map[v] || v || '—'
}

function tagClass(v: string) {
  if (v === 'login') return 'cd-log-tag--login'
  if (v === 'sync') return 'cd-log-tag--sync'
  if (v === 'file') return 'cd-log-tag--file'
  if (v === 'storage') return 'cd-log-tag--storage'
  if (v === 'share') return 'cd-log-tag--share'
  if (v === 'audit') return 'cd-log-tag--audit'
  if (v === 'operation') return 'cd-log-tag--default'
  return 'cd-log-tag--default'
}

function resultLabel(v: string) {
  if (v === 'ok' || v === 'success') return '成功'
  if (v === 'fail' || v === 'failed') return '失败'
  return v || '—'
}

function isResultOk(v: string) {
  return v === 'ok' || v === 'success'
}

function userInitial(name?: string) {
  const n = (name || '?').trim()
  return n ? n.slice(0, 1).toUpperCase() : '?'
}

async function load() {
  loading.value = true
  try {
    const res = await logsApi.listSysLogs({
      page: page.value,
      page_size: pageSize.value,
      keyword: keyword.value || undefined,
      category: activeTab.value,
      tag: activeTab.value === 'log' && subTag.value ? subTag.value : undefined,
      result: result.value || undefined,
    })
    items.value = res.items
    total.value = res.total
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function switchTab(tab: LogCategory) {
  if (tab === activeTab.value) return
  subTag.value = ''
  page.value = 1
  router.replace({ path: '/admin/logs', query: { tab } })
}

watch(
  () => route.query.tab,
  () => {
    page.value = 1
    subTag.value = ''
    load()
  },
)

watch(page, () => load())

onMounted(async () => {
  if (!route.query.tab) {
    await router.replace({ path: '/admin/logs', query: { tab: 'log' } })
  }
  await ensurePageSize()
  load()
})
</script>

<template>
  <div class="card cd-settings-layout">
    <aside class="cd-settings-nav">
      <nav class="cd-settings-nav-list">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="cd-settings-nav-item"
          :class="{ active: activeTab === t.key }"
          @click="switchTab(t.key)"
        >
          <component :is="t.icon" :size="17" :stroke="1.75" />
          <span>{{ t.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="cd-settings-main cd-logs-main">
      <div class="cd-logs-toolbar">
        <div class="cd-logs-toolbar-filters">
          <div class="cd-logs-field">
            <div class="input-group input-group-sm">
              <span class="input-group-text"><IconSearch :size="14" /></span>
              <input
                v-model="keyword"
                class="form-control"
                placeholder="搜索用户、动作、备注…"
                @keyup.enter="search"
              />
            </div>
          </div>
          <select
            v-if="showTypeColumn"
            v-model="subTag"
            class="form-select form-select-sm cd-logs-select"
            @change="search"
          >
            <option v-for="o in subTagOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <select v-model="result" class="form-select form-select-sm cd-logs-select" @change="search">
            <option v-for="o in resultOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="cd-logs-toolbar-actions">
          <button type="button" class="btn btn-sm btn-primary" @click="search">查询</button>
          <button type="button" class="btn btn-sm btn-ghost-secondary" :disabled="loading" title="刷新" @click="load">
            <IconRefresh :size="16" />
          </button>
        </div>
      </div>

      <div class="cd-logs-scroll table-responsive">
        <table class="table cd-logs-table mb-0">
          <thead>
            <tr>
              <th class="cd-logs-col-time">时间</th>
              <th>用户</th>
              <th v-if="showTypeColumn">类型</th>
              <th>结果</th>
              <th>动作</th>
              <th>IP</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="showTypeColumn ? 7 : 6">
                <div class="cd-logs-empty">加载中…</div>
              </td>
            </tr>
            <tr v-else-if="!items.length">
              <td :colspan="showTypeColumn ? 7 : 6">
                <div class="cd-logs-empty">暂无匹配的日志记录</div>
              </td>
            </tr>
            <tr v-for="l in items" :key="l.id">
              <td class="cd-logs-col-time">
                <span class="cd-logs-time">{{ fmtDate(l.created_at) }}</span>
              </td>
              <td>
                <div class="cd-logs-user">
                  <span class="cd-logs-avatar">{{ userInitial(l.username) }}</span>
                  <span class="cd-logs-username">{{ l.username || '—' }}</span>
                </div>
              </td>
              <td v-if="showTypeColumn">
                <span class="cd-log-tag" :class="tagClass(l.tag)">{{ tagLabel(l.tag) }}</span>
              </td>
              <td>
                <span class="cd-log-result" :class="isResultOk(l.result) ? 'cd-log-result--ok' : 'cd-log-result--fail'">
                  <span class="cd-log-result-dot" />
                  {{ resultLabel(l.result) }}
                </span>
              </td>
              <td>
                <code class="cd-logs-action">{{ l.action }}</code>
              </td>
              <td>
                <span class="cd-logs-ip">{{ l.ip || '—' }}</span>
              </td>
              <td>
                <span class="cd-logs-remark" :title="l.remark">{{ l.remark || '—' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="cd-logs-footer">
        <CdPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
      </div>
    </main>
  </div>

  <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
</template>
