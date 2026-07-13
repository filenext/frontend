<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  IconUsers,
  IconDatabase,
  IconAiAgent,
  IconRepeat,
  IconRefresh,
  IconCpu,
  IconDeviceDesktop,
} from '@tabler/icons-vue'
import { ApiError, fmtSize } from '@/api/client'
import * as overviewApi from '@/api/adminOverview'
import type { AdminOverview } from '@/api/adminOverview'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()

const loading = ref(false)
const data = ref<AdminOverview | null>(null)

const statCards = computed(() => {
  const s = data.value?.stats
  return [
    { key: 'users', label: t('overview.stats.activeUsers'), value: s?.active_users ?? 0, icon: IconUsers, to: '/admin/users' },
    { key: 'storages', label: t('overview.stats.storages'), value: s?.storages ?? 0, icon: IconDatabase, to: '/admin/storages?tab=storages' },
    { key: 'agents', label: t('overview.stats.agents'), value: s?.agents ?? 0, icon: IconAiAgent, to: '/admin/agents' },
    { key: 'sync', label: t('overview.stats.syncTasks'), value: s?.sync_tasks ?? 0, icon: IconRepeat, to: '/admin/storages?tab=sync' },
  ]
})

const server = computed(() => data.value?.server)

function formatUptime(sec: number) {
  if (!sec) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return t('overview.server.uptimeDays', { d, h })
  if (h > 0) return t('overview.server.uptimeHours', { h, m })
  return t('overview.server.uptimeMinutes', { m })
}

function diskLabel(path: string) {
  if (path === '/') return t('overview.server.diskRoot')
  return path
}

function metricBarClass(percent: number, warn = 65, danger = 85) {
  if (percent >= danger) return 'bg-danger'
  if (percent >= warn) return 'bg-warning'
  return 'bg-primary'
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.max(0, Math.floor(diff / 1000))
  if (sec < 60) return t('overview.time.justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('overview.time.minutesAgo', { n: min })
  const hour = Math.floor(min / 60)
  if (hour < 24) return t('overview.time.hoursAgo', { n: hour })
  const day = Math.floor(hour / 24)
  if (day === 1) return t('overview.time.yesterday')
  if (day < 7) return t('overview.time.daysAgo', { n: day })
  return new Date(iso).toLocaleDateString()
}

async function load() {
  loading.value = true
  try {
    data.value = await overviewApi.getAdminOverview()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : t('overview.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="cd-overview">
    <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
      <h1 class="cd-overview__title mb-0">{{ t('overview.title') }}</h1>
      <button type="button" class="btn btn-sm d-inline-flex align-items-center gap-1" :disabled="loading" @click="load">
        <IconRefresh :size="16" :class="{ 'cd-spin': loading }" />
        {{ t('common.refresh') }}
      </button>
    </div>

    <div v-if="loading && !data" class="text-center text-secondary py-5">{{ t('common.loading') }}</div>
    <template v-else>
      <div class="cd-overview__body">
        <aside v-if="server" class="cd-overview__server-col">
          <div class="cd-overview__server-card card">
            <div class="card-body">
              <div class="cd-overview__server-card-head">
                <IconDeviceDesktop :size="18" class="text-primary" />
                <span class="cd-overview__server-card-title">{{ t('overview.server.title') }}</span>
              </div>
              <div class="cd-overview__server-card-host">{{ server.hostname || '—' }}</div>
              <div class="cd-overview__server-card-meta text-secondary small">
                {{ server.platform || server.os }} ({{ server.arch }})
              </div>
              <div class="cd-overview__server-card-meta text-secondary small">
                {{ t('overview.server.uptime') }} {{ formatUptime(server.uptime_sec) }}
              </div>
            </div>
          </div>

          <div class="cd-overview__server-card card">
            <div class="card-body">
              <div class="cd-overview__server-card-head">
                <IconCpu :size="18" class="text-primary" />
                <span class="cd-overview__server-card-title">{{ t('overview.server.cpu') }}</span>
                <span class="cd-overview__server-card-value">{{ server.cpu_percent }}%</span>
              </div>
              <div class="progress progress-sm">
                <div
                  class="progress-bar"
                  :class="metricBarClass(server.cpu_percent)"
                  role="progressbar"
                  :style="{ width: `${Math.min(100, server.cpu_percent)}%` }"
                />
              </div>
              <div class="cd-overview__server-card-sub text-secondary small">
                {{ t('overview.server.cpuCores', { n: server.cpu_cores }) }}
              </div>
            </div>
          </div>

          <div class="cd-overview__server-card card">
            <div class="card-body">
              <div class="cd-overview__server-card-head">
                <span class="cd-overview__server-card-title">{{ t('overview.server.memory') }}</span>
                <span class="cd-overview__server-card-value">{{ server.mem_percent }}%</span>
              </div>
              <div class="progress progress-sm">
                <div
                  class="progress-bar"
                  :class="metricBarClass(server.mem_percent)"
                  role="progressbar"
                  :style="{ width: `${Math.min(100, server.mem_percent)}%` }"
                />
              </div>
              <div class="cd-overview__server-card-sub text-secondary small">
                {{ fmtSize(server.mem_used) }} / {{ fmtSize(server.mem_total) }}
              </div>
            </div>
          </div>

          <div v-for="disk in server.disks" :key="disk.path" class="cd-overview__server-card card">
            <div class="card-body">
              <div class="cd-overview__server-card-head">
                <span class="cd-overview__server-card-title">{{ t('overview.server.disk') }} · {{ diskLabel(disk.path) }}</span>
                <span class="cd-overview__server-card-value">{{ disk.percent }}%</span>
              </div>
              <div class="progress progress-sm">
                <div
                  class="progress-bar"
                  :class="metricBarClass(disk.percent, 75, 90)"
                  role="progressbar"
                  :style="{ width: `${Math.min(100, disk.percent)}%` }"
                />
              </div>
              <div class="cd-overview__server-card-sub text-secondary small">
                {{ fmtSize(disk.used) }} / {{ fmtSize(disk.total) }}
                <span class="d-block">({{ t('overview.server.diskFree', { size: fmtSize(disk.free) }) }})</span>
              </div>
            </div>
          </div>
        </aside>

        <div class="cd-overview__main-col">
          <div class="cd-overview__cards">
            <RouterLink
              v-for="card in statCards"
              :key="card.key"
              :to="card.to"
              class="cd-overview__card"
            >
              <component :is="card.icon" :size="18" class="cd-overview__card-icon" />
              <span class="cd-overview__card-value">{{ card.value }}</span>
              <span class="cd-overview__card-label">{{ card.label }}</span>
            </RouterLink>
          </div>

          <div class="cd-overview__split">
            <div class="cd-overview__chart card">
              <div class="card-header py-2">
                <h3 class="card-title mb-0">{{ t('overview.chartTitle') }}</h3>
              </div>
              <div class="card-body">
                <div class="cd-overview__bars">
                  <div
                    v-for="point in data?.chart || []"
                    :key="point.label"
                    class="cd-overview__bar-wrap"
                    :title="`${point.label}: ${point.count}`"
                  >
                    <div class="cd-overview__bar" :style="{ height: `${point.height}%` }" />
                    <span class="cd-overview__bar-label">{{ point.label }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="cd-overview__activity card">
              <div class="card-header py-2 d-flex align-items-center justify-content-between">
                <h3 class="card-title mb-0">{{ t('overview.activityTitle') }}</h3>
                <RouterLink to="/admin/logs?tab=log" class="small">{{ t('overview.viewAllLogs') }}</RouterLink>
              </div>
              <div class="card-body cd-overview__activity-list">
                <div v-if="!data?.activity.length" class="text-secondary small text-center py-3">
                  {{ t('overview.noActivity') }}
                </div>
                <div v-for="item in data?.activity || []" :key="item.id" class="cd-overview__activity-item">
                  <span class="cd-overview__activity-title">{{ item.title }}</span>
                  <span class="cd-overview__activity-time">{{ relativeTime(item.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
