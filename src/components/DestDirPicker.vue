<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FileTypeIcon from '@/components/FileTypeIcon.vue'
import { IconChevronRight } from '@tabler/icons-vue'
import * as filesApi from '@/api/files'
import type { FileEntry } from '@/types/files'
import { joinPath } from '@/utils/paths'

const props = defineProps<{
  storageId: string
  rootPath?: string
  modelValue: string
  /** 不可选为目标的目录（如正在移动的源目录） */
  blockedPaths?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [path: string]
}>()

const browsePath = ref(props.modelValue || props.rootPath || '/')
const folders = ref<FileEntry[]>([])
const loading = ref(false)

const root = computed(() => props.rootPath || '/')
const blocked = computed(() => new Set((props.blockedPaths || []).map((p) => p.replace(/\/+$/, '') || '/')))

const breadcrumbs = computed(() => {
  if (browsePath.value === root.value) return []
  const rel = browsePath.value.slice(root.value.length).replace(/^\//, '')
  if (!rel) return []
  const parts = rel.split('/')
  const crumbs: { label: string; path: string }[] = []
  let cur = root.value
  for (const part of parts) {
    cur = joinPath(cur, part)
    crumbs.push({ label: part, path: cur })
  }
  return crumbs
})

const canSelectCurrent = computed(() => !blocked.value.has(browsePath.value.replace(/\/+$/, '') || '/'))

async function loadFolders() {
  if (!props.storageId) return
  loading.value = true
  try {
    const items = await filesApi.listFiles(props.storageId, browsePath.value)
    folders.value = items.filter((i) => i.isDir).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  } catch {
    folders.value = []
  } finally {
    loading.value = false
  }
}

function navigate(path: string) {
  browsePath.value = path || root.value
  emit('update:modelValue', browsePath.value)
}

function enterFolder(folder: FileEntry) {
  navigate(folder.path)
}

watch(
  () => [props.storageId, props.modelValue] as const,
  ([sid, path]) => {
    if (!sid) return
    browsePath.value = path || root.value
    loadFolders()
  },
  { immediate: true },
)

watch(browsePath, () => {
  loadFolders()
})
</script>

<template>
  <div class="cd-dest-dir-picker">
    <nav class="cd-dest-dir-picker__crumbs small mb-2">
      <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" @click="navigate(root)">
        根目录
      </button>
      <template v-for="(c, i) in breadcrumbs" :key="c.path">
        <IconChevronRight :size="14" class="text-secondary mx-1" />
        <button
          v-if="i < breadcrumbs.length - 1"
          type="button"
          class="btn btn-link btn-sm p-0 text-decoration-none"
          @click="navigate(c.path)"
        >
          {{ c.label }}
        </button>
        <span v-else class="text-body">{{ c.label }}</span>
      </template>
    </nav>

    <div class="cd-dest-dir-picker__current mb-2">
      <span class="text-secondary small">目标：</span>
      <code class="small">{{ browsePath }}</code>
      <button
        v-if="canSelectCurrent"
        type="button"
        class="btn btn-sm btn-outline-primary ms-2"
        @click="emit('update:modelValue', browsePath)"
      >
        选择此目录
      </button>
      <span v-else class="text-warning small ms-2">不能移动到源目录自身</span>
    </div>

    <div v-if="loading" class="text-secondary small py-3 text-center">加载中…</div>
    <div v-else-if="!folders.length" class="text-secondary small py-3 text-center">此目录下没有子文件夹</div>
    <ul v-else class="list-group list-group-flush cd-dest-dir-picker__list">
      <li
        v-for="folder in folders"
        :key="folder.id"
        class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2"
        :class="{ 'text-secondary': blocked.has(folder.path.replace(/\/+$/, '') || '/') }"
        @click="enterFolder(folder)"
      >
        <FileTypeIcon name="" is-dir :size="22" />
        <span class="text-truncate flex-fill">{{ folder.name }}</span>
        <IconChevronRight :size="16" class="text-secondary flex-shrink-0" />
      </li>
    </ul>
  </div>
</template>
