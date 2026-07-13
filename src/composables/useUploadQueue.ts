import { computed, ref } from 'vue'
import * as filesApi from '@/api/files'
import type { UploadTask } from '@/types/upload'
import type { UploadEntry } from '@/utils/folderUpload'

let nextId = 1
const tasks = ref<UploadTask[]>([])
const collapsed = ref(false)
const activeTab = ref<'uploading' | 'done'>('uploading')
let processing = false
let onCompleteCallback: (() => void) | null = null

const visible = computed(() => tasks.value.length > 0)

const uploadingTasks = computed(() =>
  tasks.value.filter((t) => t.status === 'pending' || t.status === 'uploading' || t.status === 'error'),
)

const doneTasks = computed(() => tasks.value.filter((t) => t.status === 'done'))

const uploadingCount = computed(
  () => tasks.value.filter((t) => t.status === 'pending' || t.status === 'uploading').length,
)

const doneCount = computed(() => doneTasks.value.length)

function displayName(entry: UploadEntry) {
  return entry.relativePath || entry.file.name
}

function enqueue(entries: UploadEntry[], storageId: string, path: string, onComplete?: () => void) {
  if (!entries.length) return
  const batch = entries.map((entry) => ({
    id: `up-${nextId++}`,
    name: displayName(entry),
    size: entry.file.size,
    storageId,
    path,
    file: entry.file,
    relativePath: entry.relativePath,
    progress: 0,
    status: 'pending' as const,
  }))
  tasks.value.push(...batch)
  collapsed.value = false
  activeTab.value = 'uploading'
  if (onComplete) onCompleteCallback = onComplete
  void processQueue()
}

async function processQueue() {
  if (processing) return
  processing = true
  try {
    while (true) {
      const task = tasks.value.find((t) => t.status === 'pending')
      if (!task) break
      task.status = 'uploading'
      task.progress = 0
      try {
        await filesApi.uploadFileWithProgress(
          task.storageId,
          task.path,
          { file: task.file, relativePath: task.relativePath },
          (percent) => {
            task.progress = percent
          },
        )
        task.progress = 100
        task.status = 'done'
      } catch (e) {
        task.status = 'error'
        task.error = e instanceof Error ? e.message : '上传失败'
      }
    }
    onCompleteCallback?.()
    onCompleteCallback = null
    if (!tasks.value.some((t) => t.status === 'pending' || t.status === 'uploading')) {
      if (tasks.value.some((t) => t.status === 'done')) {
        activeTab.value = 'done'
      }
    }
  } finally {
    processing = false
    if (tasks.value.some((t) => t.status === 'pending')) {
      void processQueue()
    }
  }
}

function clearDone() {
  tasks.value = tasks.value.filter((t) => t.status !== 'done')
  if (!tasks.value.length) collapsed.value = false
}

function dismiss() {
  if (uploadingCount.value > 0) return
  tasks.value = []
  collapsed.value = false
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

export function useUploadQueue() {
  return {
    tasks,
    collapsed,
    activeTab,
    visible,
    uploadingTasks,
    doneTasks,
    uploadingCount,
    doneCount,
    enqueue,
    clearDone,
    dismiss,
    toggleCollapsed,
  }
}
