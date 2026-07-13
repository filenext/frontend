<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconHistory, IconX } from '@tabler/icons-vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/api/client'
import * as filesApi from '@/api/files'
import type { OfficeEditorPresence } from '@/api/files'
import FileRevisionsModal from '@/components/FileRevisionsModal.vue'
import { parentPath } from '@/utils/paths'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

declare global {
  interface Window {
    DocsAPI?: { DocEditor: new (id: string, cfg: Record<string, unknown>) => { destroyEditor?: () => void } }
  }
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const editorHost = ref<HTMLDivElement | null>(null)
const editors = ref<OfficeEditorPresence[]>([])
const showRevisions = ref(false)
const cursorHint = ref('')
let editorInstance: { destroyEditor?: () => void } | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | undefined
let presencePollTimer: ReturnType<typeof setInterval> | undefined

const storageId = computed(() => String(route.query.storage_id || route.query.storage || ''))
const filePath = computed(() => String(route.query.path || ''))
const fileName = computed(() => {
  const p = filePath.value
  if (!p || p === '/') return t('files.officeEditor')
  return p.split('/').filter(Boolean).pop() || t('files.officeEditor')
})

const otherEditors = computed(() =>
  editors.value.filter((e) => e.user_id !== auth.user?.id),
)

function loadOnlyOfficeScript(serverUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const src = `${serverUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(t('files.officeScriptFailed')))
    document.head.appendChild(script)
  })
}

async function touchPresence(action: 'join' | 'heartbeat' | 'leave', cursor?: string) {
  if (!storageId.value || !filePath.value) return
  try {
    const res = await filesApi.onlyOfficePresenceTouch(
      storageId.value,
      filePath.value,
      action,
      cursor || cursorHint.value,
    )
    if (action !== 'leave') editors.value = res.editors || []
  } catch {
    /* ignore */
  }
}

async function pollPresence() {
  if (!storageId.value || !filePath.value) return
  try {
    const res = await filesApi.onlyOfficePresenceGet(storageId.value, filePath.value)
    editors.value = res.editors || []
  } catch {
    /* ignore */
  }
}

function stopPresence() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (presencePollTimer) clearInterval(presencePollTimer)
  heartbeatTimer = undefined
  presencePollTimer = undefined
  void touchPresence('leave')
}

function startPresence() {
  stopPresence()
  void touchPresence('join')
  heartbeatTimer = setInterval(() => void touchPresence('heartbeat'), 20000)
  presencePollTimer = setInterval(() => void pollPresence(), 8000)
}

function destroyEditor() {
  stopPresence()
  if (editorInstance?.destroyEditor) editorInstance.destroyEditor()
  editorInstance = null
  if (editorHost.value) editorHost.value.innerHTML = ''
}

async function mountEditor() {
  destroyEditor()
  error.value = ''
  loading.value = true
  editors.value = []
  cursorHint.value = ''
  if (!storageId.value || !filePath.value || filePath.value === '/') {
    error.value = t('files.officeMissingParams')
    loading.value = false
    return
  }
  if (!filesApi.isOfficeEditable(fileName.value)) {
    error.value = t('files.officeUnsupported')
    loading.value = false
    return
  }
  try {
    const res = await filesApi.onlyOfficeConfig(storageId.value, filePath.value)
    await loadOnlyOfficeScript(res.server_url)
    await new Promise((r) => setTimeout(r, 50))
    if (!document.getElementById('cd-office-editor-host')) {
      throw new Error(t('files.officeMountFailed'))
    }
    const cfg = {
      ...res.config,
      width: '100%',
      height: '100%',
      events: {
        onDocumentReady() {
          startPresence()
        },
        onMetaChange(event: { data?: { title?: string } }) {
          if (event?.data?.title) {
            cursorHint.value = String(event.data.title)
            void touchPresence('heartbeat', cursorHint.value)
          }
        },
        onInfo(event: { data?: { mode?: string } }) {
          if (event?.data?.mode) {
            cursorHint.value = String(event.data.mode)
          }
        },
        onCollaborativeChanges() {
          void pollPresence()
        },
      },
    }
    editorInstance = new window.DocsAPI!.DocEditor('cd-office-editor-host', cfg)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('files.officeOpenFailed')
    toast.show(error.value)
  } finally {
    loading.value = false
  }
}

function exitEditor() {
  destroyEditor()
  const query: Record<string, string> = {}
  if (storageId.value) query.tab = storageId.value
  const dir = parentPath(filePath.value)
  if (dir && dir !== '/') query.path = dir
  router.push({ path: '/files', query })
}

watch(
  () => [storageId.value, filePath.value] as const,
  () => {
    mountEditor()
  },
  { immediate: true },
)

onUnmounted(destroyEditor)
</script>

<template>
  <div class="cd-office-page">
    <header class="cd-office-page__bar">
      <div class="cd-office-page__title" :title="filePath">{{ fileName }}</div>
      <div v-if="editors.length" class="cd-office-page__editors" :title="t('files.editorsOnline')">
        <div
          v-for="ed in editors"
          :key="ed.user_id"
          class="cd-office-page__avatar"
          :style="{ background: ed.color }"
          :title="`${ed.real_name || ed.username}${ed.cursor ? ' · ' + ed.cursor : ''}`"
        >
          {{ (ed.real_name || ed.username || '?').slice(0, 1).toUpperCase() }}
        </div>
        <div v-if="otherEditors.length" class="cd-office-page__editors-meta text-secondary small">
          <span>{{ t('files.editingWith', { n: editors.length }) }}</span>
          <span
            v-for="ed in otherEditors"
            :key="`c-${ed.user_id}`"
            class="cd-office-page__cursor-tag"
          >
            {{ ed.real_name || ed.username }}
            <template v-if="ed.cursor"> · {{ ed.cursor }}</template>
          </span>
        </div>
      </div>
      <button
        type="button"
        class="cd-office-page__close"
        :aria-label="t('files.revisions')"
        :title="t('files.revisions')"
        @click="showRevisions = true"
      >
        <IconHistory :size="20" />
      </button>
      <button
        type="button"
        class="cd-office-page__close"
        :aria-label="t('files.officeExit')"
        :title="t('files.officeExit')"
        @click="exitEditor"
      >
        <IconX :size="22" />
      </button>
    </header>
    <div class="cd-office-page__body">
      <div v-if="loading" class="cd-office-page__status">{{ t('files.officeLoading') }}</div>
      <div v-else-if="error" class="cd-office-page__status cd-office-page__status--error">
        <p>{{ error }}</p>
        <button type="button" class="btn btn-sm btn-primary" @click="exitEditor">
          {{ t('files.officeBackToFiles') }}
        </button>
      </div>
      <div
        id="cd-office-editor-host"
        ref="editorHost"
        class="cd-office-page__editor"
        :class="{ 'd-none': loading || !!error }"
      />
    </div>

    <FileRevisionsModal
      :show="showRevisions"
      :storage-id="storageId"
      :path="filePath"
      :file-name="fileName"
      :can-restore="true"
      @close="showRevisions = false"
    />
  </div>
</template>
