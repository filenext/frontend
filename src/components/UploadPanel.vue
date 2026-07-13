<script setup lang="ts">
import { computed } from 'vue'
import {
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconX,
} from '@tabler/icons-vue'
import { fmtSize } from '@/api/client'
import { useUploadQueue } from '@/composables/useUploadQueue'
import FileTypeIcon from '@/components/FileTypeIcon.vue'

const queue = useUploadQueue()

const listItems = computed(() =>
  queue.activeTab.value === 'uploading' ? queue.uploadingTasks.value : queue.doneTasks.value,
)

const headerHint = computed(() => {
  if (queue.uploadingCount.value > 0) {
    return `上传中 ${queue.uploadingCount.value} 个`
  }
  if (queue.doneCount.value > 0) {
    return `已完成 ${queue.doneCount.value} 个`
  }
  return '文件上传'
})
</script>

<template>
  <div
    v-if="queue.visible.value"
    class="cd-upload-panel"
    :class="{ 'cd-upload-panel--collapsed': queue.collapsed.value }"
  >
    <div class="cd-upload-panel-header">
      <div class="cd-upload-panel-title">
        <span class="fw-medium">{{ headerHint }}</span>
      </div>
      <div class="cd-upload-panel-actions">
        <button
          v-if="queue.activeTab.value === 'done' && queue.doneCount.value"
          type="button"
          class="btn btn-sm btn-ghost-secondary py-0 px-1"
          title="清空已完成"
          @click="queue.clearDone()"
        >
          清空
        </button>
        <button
          v-if="!queue.uploadingCount.value && queue.doneCount.value"
          type="button"
          class="btn btn-sm btn-ghost-secondary py-0 px-1"
          title="关闭"
          @click="queue.dismiss()"
        >
          <IconX :size="16" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost-secondary py-0 px-1"
          :title="queue.collapsed.value ? '展开' : '折叠'"
          @click="queue.toggleCollapsed()"
        >
          <IconChevronDown v-if="!queue.collapsed.value" :size="16" />
          <IconChevronUp v-else :size="16" />
        </button>
      </div>
    </div>

    <div v-show="!queue.collapsed.value" class="cd-upload-panel-body">
      <div class="cd-upload-panel-tabs">
        <button
          type="button"
          class="cd-upload-panel-tab"
          :class="{ active: queue.activeTab.value === 'uploading' }"
          @click="queue.activeTab.value = 'uploading'"
        >
          上传中
          <span v-if="queue.uploadingTasks.value.length" class="cd-upload-panel-badge">
            {{ queue.uploadingTasks.value.length }}
          </span>
        </button>
        <button
          type="button"
          class="cd-upload-panel-tab"
          :class="{ active: queue.activeTab.value === 'done' }"
          @click="queue.activeTab.value = 'done'"
        >
          已上传
          <span v-if="queue.doneCount.value" class="cd-upload-panel-badge">
            {{ queue.doneCount.value }}
          </span>
        </button>
      </div>

      <div class="cd-upload-panel-list">
        <div v-if="!listItems.length" class="cd-upload-panel-empty">
          {{ queue.activeTab.value === 'uploading' ? '暂无上传任务' : '暂无已完成文件' }}
        </div>
        <div v-for="item in listItems" :key="item.id" class="cd-upload-panel-item">
          <FileTypeIcon :name="item.name" :size="18" class="cd-upload-panel-icon" />
          <div class="cd-upload-panel-item-main">
            <div class="cd-upload-panel-item-name" :title="item.name">{{ item.name }}</div>
            <div class="cd-upload-panel-item-meta">
              <span>{{ fmtSize(item.size) }}</span>
              <span v-if="item.status === 'uploading'">{{ item.progress }}%</span>
              <span v-else-if="item.status === 'error'" class="text-danger">{{ item.error }}</span>
              <span v-else-if="item.status === 'done'" class="text-success">完成</span>
              <span v-else>等待中</span>
            </div>
            <div
              v-if="item.status === 'uploading' || item.status === 'pending'"
              class="progress progress-sm mt-1"
            >
              <div
                class="progress-bar"
                :class="{ 'progress-bar-indeterminate': item.status === 'pending' && !item.progress }"
                :style="item.progress ? { width: `${item.progress}%` } : undefined"
              />
            </div>
          </div>
          <IconCircleCheck v-if="item.status === 'done'" :size="18" class="text-success flex-shrink-0" />
          <IconCircleX v-else-if="item.status === 'error'" :size="18" class="text-danger flex-shrink-0" />
        </div>
      </div>
    </div>
  </div>
</template>
