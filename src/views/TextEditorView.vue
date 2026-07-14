<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconDeviceFloppy, IconX } from '@tabler/icons-vue'
import { marked } from 'marked'
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/api/client'
import * as filesApi from '@/api/files'
import { parentPath } from '@/utils/paths'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const content = ref('')
const dirty = ref(false)

const storageId = computed(() => String(route.query.storage_id || route.query.storage || ''))
const filePath = computed(() => String(route.query.path || ''))
const fileName = computed(() => {
  const p = filePath.value
  if (!p || p === '/') return t('files.textEditor')
  return p.split('/').filter(Boolean).pop() || t('files.textEditor')
})
const isMarkdown = computed(() => filesApi.isMarkdownFile(fileName.value))

const previewHtml = computed(() => {
  if (!isMarkdown.value) return ''
  try {
    return marked.parse(content.value, { async: false }) as string
  } catch {
    return ''
  }
})

async function load() {
  loading.value = true
  error.value = ''
  if (!storageId.value || !filePath.value || filePath.value === '/') {
    error.value = t('files.officeMissingParams')
    loading.value = false
    return
  }
  if (!filesApi.isTextEditable(fileName.value)) {
    error.value = t('files.textUnsupported')
    loading.value = false
    return
  }
  try {
    content.value = await filesApi.fetchFileText(storageId.value, filePath.value)
    dirty.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('files.textOpenFailed')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!storageId.value || !filePath.value || saving.value) return
  saving.value = true
  try {
    await filesApi.saveFileText(storageId.value, filePath.value, content.value)
    dirty.value = false
    toast.show(t('files.textSaved'))
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : t('files.textSaveFailed'))
  } finally {
    saving.value = false
  }
}

function onInput(e: Event) {
  content.value = (e.target as HTMLTextAreaElement).value
  dirty.value = true
}

function goBack() {
  const query: Record<string, string> = {}
  if (storageId.value) query.storage = storageId.value
  const parent = parentPath(filePath.value)
  if (parent && parent !== '/') query.path = parent
  router.push({ path: '/files', query })
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    void save()
  }
}

watch(
  () => [String(route.query.storage_id || ''), String(route.query.storage || ''), String(route.query.path || '')],
  () => {
    void load()
  },
)

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="cd-text-editor-page">
    <header class="cd-text-editor-bar">
      <div class="cd-text-editor-bar__title text-truncate" :title="fileName">
        {{ fileName }}
        <span v-if="dirty" class="text-secondary small ms-1">*</span>
      </div>
      <div class="cd-text-editor-bar__actions">
        <button
          type="button"
          class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
          :disabled="saving || loading || !!error"
          @click="save"
        >
          <IconDeviceFloppy :size="16" />
          {{ saving ? t('files.textSaving') : t('files.textSave') }}
        </button>
        <button type="button" class="btn btn-sm d-inline-flex align-items-center gap-1" @click="goBack">
          <IconX :size="16" />
          {{ t('files.officeBackToFiles') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="cd-text-editor-status">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="cd-text-editor-status text-danger">{{ error }}</div>
    <div v-else class="cd-text-editor-body" :class="{ 'cd-text-editor-body--split': isMarkdown }">
      <textarea
        class="cd-text-editor-textarea"
        :value="content"
        spellcheck="false"
        @input="onInput"
      />
      <div
        v-if="isMarkdown"
        class="cd-text-editor-preview markdown-body"
        v-html="previewHtml"
      />
    </div>
  </div>
</template>
