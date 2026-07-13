<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconDownload, IconHistory, IconRestore } from '@tabler/icons-vue'
import { ApiError, fmtDate, fmtSize, getToken } from '@/api/client'
import * as filesApi from '@/api/files'
import type { FileRevisionItem } from '@/api/files'
import CdModal from '@/components/CdModal.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  show: boolean
  storageId: string
  path: string
  fileName: string
  canRestore?: boolean
}>()

const emit = defineEmits<{ close: []; restored: [] }>()

const { t } = useI18n()
const toast = useToast()
const loading = ref(false)
const restoring = ref<number | null>(null)
const items = ref<FileRevisionItem[]>([])

async function load() {
  if (!props.show || !props.storageId || !props.path) return
  loading.value = true
  try {
    const res = await filesApi.onlyOfficeRevisions(props.storageId, props.path)
    items.value = res.items || []
  } catch (e) {
    items.value = []
    toast.show(e instanceof ApiError ? e.message : t('files.revisionsLoadFailed'))
  } finally {
    loading.value = false
  }
}

async function downloadVersion(row: FileRevisionItem) {
  const url = filesApi.onlyOfficeRevisionDownloadUrl(props.storageId, props.path, row.version)
  const token = getToken()
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(t('files.revisionsDownloadFailed'))
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `v${row.version}_${props.fileName}`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (e) {
    toast.show(e instanceof Error ? e.message : t('files.revisionsDownloadFailed'))
  }
}

async function restoreVersion(row: FileRevisionItem) {
  if (!props.canRestore) return
  if (!confirm(t('files.revisionsRestoreConfirm', { version: row.version }))) return
  restoring.value = row.version
  try {
    await filesApi.onlyOfficeRestoreRevision(props.storageId, props.path, row.version)
    toast.show(t('files.revisionsRestored'))
    emit('restored')
    emit('close')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : t('files.revisionsRestoreFailed'))
  } finally {
    restoring.value = null
  }
}

watch(
  () => [props.show, props.storageId, props.path] as const,
  ([show]) => {
    if (show) void load()
  },
)
</script>

<template>
  <CdModal :show="show" :title="t('files.revisionsTitle', { name: fileName })" size="lg" @close="emit('close')">
    <div class="modal-body">
      <p class="text-secondary small mb-3">{{ t('files.revisionsHint') }}</p>
      <div v-if="loading" class="text-center text-secondary py-4">{{ t('common.loading') }}</div>
      <div v-else-if="!items.length" class="text-center text-secondary py-4">{{ t('files.revisionsEmpty') }}</div>
      <div v-else class="table-responsive">
        <table class="table table-vcenter table-sm mb-0">
          <thead>
            <tr>
              <th>{{ t('files.revisionsVersion') }}</th>
              <th>{{ t('files.revisionsSize') }}</th>
              <th>{{ t('files.revisionsTime') }}</th>
              <th class="w-1"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.id">
              <td>
                <span class="d-inline-flex align-items-center gap-1">
                  <IconHistory :size="16" class="text-primary" />
                  v{{ row.version }}
                </span>
              </td>
              <td class="text-secondary">{{ fmtSize(row.size) }}</td>
              <td class="text-secondary">{{ fmtDate(row.created_at) }}</td>
              <td>
                <div class="btn-list flex-nowrap">
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost-secondary"
                    :title="t('files.download')"
                    @click="downloadVersion(row)"
                  >
                    <IconDownload :size="16" />
                  </button>
                  <button
                    v-if="canRestore !== false"
                    type="button"
                    class="btn btn-sm btn-ghost-primary"
                    :disabled="restoring === row.version"
                    :title="t('files.revisionsRestore')"
                    @click="restoreVersion(row)"
                  >
                    <IconRestore :size="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-sm" @click="emit('close')">{{ t('common.close') }}</button>
    </div>
  </CdModal>
</template>
