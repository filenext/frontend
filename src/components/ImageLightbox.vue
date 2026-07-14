<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { IconChevronLeft, IconChevronRight, IconDownload, IconX } from '@tabler/icons-vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/api/client'
import * as filesApi from '@/api/files'
import type { FileEntry } from '@/types/files'

const props = defineProps<{
  show: boolean
  storageId: string
  images: FileEntry[]
  /** Path of the image to open initially */
  initialPath: string
}>()

const emit = defineEmits<{
  close: []
  download: [item: FileEntry]
}>()

const { t } = useI18n()

const index = ref(0)
const loading = ref(false)
const error = ref('')
const objectUrl = ref('')
const cache = new Map<string, string>()

const current = computed(() => props.images[index.value] || null)
const counter = computed(() =>
  props.images.length ? `${index.value + 1} / ${props.images.length}` : '',
)
const canPrev = computed(() => props.images.length > 1)
const canNext = computed(() => props.images.length > 1)

function revokeUrl(url: string) {
  if (url && !Array.from(cache.values()).includes(url)) {
    URL.revokeObjectURL(url)
  }
}

function clearCache() {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url)
  }
  cache.clear()
  objectUrl.value = ''
}

function syncIndexFromInitial() {
  const i = props.images.findIndex((f) => f.path === props.initialPath)
  index.value = i >= 0 ? i : 0
}

async function loadAt(i: number) {
  const item = props.images[i]
  if (!item || !props.storageId) return
  const cached = cache.get(item.path)
  if (cached) {
    if (i === index.value) {
      objectUrl.value = cached
      loading.value = false
      error.value = ''
    }
    return
  }
  if (i === index.value) {
    loading.value = true
    error.value = ''
  }
  try {
    const blob = await filesApi.fetchPreviewBlob(props.storageId, item.path)
    const url = URL.createObjectURL(blob)
    const prev = cache.get(item.path)
    if (prev) URL.revokeObjectURL(prev)
    cache.set(item.path, url)
    // keep cache small
    if (cache.size > 12) {
      const first = cache.keys().next().value
      if (first && first !== item.path && first !== current.value?.path) {
        const old = cache.get(first)
        if (old) URL.revokeObjectURL(old)
        cache.delete(first)
      }
    }
    if (i === index.value) {
      objectUrl.value = url
      error.value = ''
    }
  } catch (e) {
    if (i === index.value) {
      error.value = e instanceof ApiError ? e.message : t('files.previewFailed')
      objectUrl.value = ''
    }
  } finally {
    if (i === index.value) loading.value = false
  }
}

async function showCurrent() {
  const item = current.value
  if (!item) {
    objectUrl.value = ''
    return
  }
  await loadAt(index.value)
  // preload neighbors
  const n = props.images.length
  if (n > 1) {
    void loadAt((index.value + 1) % n)
    void loadAt((index.value - 1 + n) % n)
  }
}

function goPrev() {
  if (!canPrev.value) return
  index.value = (index.value - 1 + props.images.length) % props.images.length
}

function goNext() {
  if (!canNext.value) return
  index.value = (index.value + 1) % props.images.length
}

function onDownload() {
  if (current.value) emit('download', current.value)
}

function onKey(e: KeyboardEvent) {
  if (!props.show) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goPrev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    goNext()
  }
}

watch(
  () => props.show,
  (v) => {
    if (v) {
      syncIndexFromInitial()
      void showCurrent()
    } else {
      clearCache()
      loading.value = false
      error.value = ''
    }
  },
)

watch(
  () => [props.initialPath, props.images.map((i) => i.path).join('\0')],
  () => {
    if (!props.show) return
    syncIndexFromInitial()
    void showCurrent()
  },
)

watch(index, () => {
  if (props.show) void showCurrent()
})

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  clearCache()
  revokeUrl(objectUrl.value)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="cd-image-lightbox"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <header class="cd-image-lightbox__bar">
        <div class="cd-image-lightbox__title text-truncate" :title="current?.name">
          {{ current?.name || t('files.preview') }}
          <span v-if="counter" class="cd-image-lightbox__counter">{{ counter }}</span>
        </div>
        <div class="cd-image-lightbox__actions">
          <button
            type="button"
            class="cd-image-lightbox__btn"
            :title="t('files.download')"
            :disabled="!current"
            @click="onDownload"
          >
            <IconDownload :size="20" />
          </button>
          <button
            type="button"
            class="cd-image-lightbox__btn"
            :title="t('common.close')"
            @click="emit('close')"
          >
            <IconX :size="20" />
          </button>
        </div>
      </header>

      <button
        v-if="canPrev"
        type="button"
        class="cd-image-lightbox__nav cd-image-lightbox__nav--prev"
        :title="t('files.prevImage')"
        @click="goPrev"
      >
        <IconChevronLeft :size="28" />
      </button>
      <button
        v-if="canNext"
        type="button"
        class="cd-image-lightbox__nav cd-image-lightbox__nav--next"
        :title="t('files.nextImage')"
        @click="goNext"
      >
        <IconChevronRight :size="28" />
      </button>

      <div class="cd-image-lightbox__stage">
        <div v-if="loading" class="cd-image-lightbox__status">{{ t('common.loading') }}</div>
        <div v-else-if="error" class="cd-image-lightbox__status">{{ error }}</div>
        <img
          v-else-if="objectUrl"
          :src="objectUrl"
          :alt="current?.name || ''"
          class="cd-image-lightbox__img"
          @click.stop
        />
      </div>
    </div>
  </Teleport>
</template>
