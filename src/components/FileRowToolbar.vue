<script setup lang="ts">
import {
  IconShare,
  IconDownload,
  IconTrash,
  IconDotsVertical,
  IconPencil,
  IconCopy,
  IconFolderSymlink,
  IconShieldLock,
} from '@tabler/icons-vue'
import type { FileEntry } from '@/types/files'

export type FileRowAction = 'share' | 'download' | 'delete' | 'rename' | 'copy' | 'move' | 'manageAcl'

const props = defineProps<{
  item: FileEntry
  shareLabel?: string
  canShare?: boolean
  canDownload?: boolean
  canDelete?: boolean
  canRename?: boolean
  canCopy?: boolean
  canMove?: boolean
  canManageAcl?: boolean
}>()

const emit = defineEmits<{
  action: [id: FileRowAction, item: FileEntry]
}>()

const iconProps = { size: 17, stroke: 1.75 }

function run(id: FileRowAction) {
  emit('action', id, props.item)
}
</script>

<template>
  <div class="cd-file-row-actions" @click.stop>
    <button
      v-if="canShare !== false"
      type="button"
      class="cd-file-row-actions__btn"
      :title="shareLabel || '分享'"
      @click="run('share')"
    >
      <IconShare v-bind="iconProps" />
    </button>
    <button
      v-if="canDownload !== false"
      type="button"
      class="cd-file-row-actions__btn"
      title="下载"
      :disabled="item.isDir"
      @click="run('download')"
    >
      <IconDownload v-bind="iconProps" />
    </button>
    <button
      v-if="canDelete !== false"
      type="button"
      class="cd-file-row-actions__btn cd-file-row-actions__btn--danger"
      title="删除"
      @click="run('delete')"
    >
      <IconTrash v-bind="iconProps" />
    </button>
    <div
      v-if="canRename !== false || canCopy !== false || canMove !== false || canManageAcl"
      class="cd-file-row-actions__more"
    >
      <button
        type="button"
        class="cd-file-row-actions__btn"
        title="更多"
      >
        <IconDotsVertical v-bind="iconProps" />
      </button>
      <div class="cd-file-row-actions__menu" role="menu">
        <button
          v-if="canManageAcl && item.isDir"
          type="button"
          class="cd-file-row-actions__menu-item"
          role="menuitem"
          @click="run('manageAcl')"
        >
          <IconShieldLock :size="16" :stroke="1.75" />
          <span>权限设置</span>
        </button>
        <button
          v-if="canRename !== false"
          type="button"
          class="cd-file-row-actions__menu-item"
          role="menuitem"
          @click="run('rename')"
        >
          <IconPencil :size="16" :stroke="1.75" />
          <span>重命名</span>
        </button>
        <button
          v-if="canCopy !== false"
          type="button"
          class="cd-file-row-actions__menu-item"
          role="menuitem"
          @click="run('copy')"
        >
          <IconCopy :size="16" :stroke="1.75" />
          <span>复制</span>
        </button>
        <button
          v-if="canMove !== false"
          type="button"
          class="cd-file-row-actions__menu-item"
          role="menuitem"
          @click="run('move')"
        >
          <IconFolderSymlink :size="16" :stroke="1.75" />
          <span>移动</span>
        </button>
      </div>
    </div>
  </div>
</template>
