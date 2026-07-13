<script setup lang="ts">
import { computed } from 'vue'
import {
  IconFile,
  IconFileCode,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypePpt,
  IconFileTypeXls,
  IconFileTypeZip,
  IconFolderFilled,
  IconMusic,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-vue'

const props = defineProps<{
  name: string
  isDir?: boolean
  mimeType?: string
  size?: number
}>()

type FileKind =
  | 'dir'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'archive'
  | 'doc'
  | 'sheet'
  | 'slides'
  | 'code'
  | 'text'
  | 'file'

const FILE_KIND_CONFIG: Record<
  FileKind,
  { icon: typeof IconFile; stroke?: number }
> = {
  dir: { icon: IconFolderFilled, stroke: 1.25 },
  image: { icon: IconPhoto },
  video: { icon: IconVideo },
  audio: { icon: IconMusic },
  pdf: { icon: IconFileTypePdf, stroke: 1.5 },
  archive: { icon: IconFileTypeZip, stroke: 1.5 },
  doc: { icon: IconFileTypeDoc, stroke: 1.5 },
  sheet: { icon: IconFileTypeXls, stroke: 1.5 },
  slides: { icon: IconFileTypePpt, stroke: 1.5 },
  code: { icon: IconFileCode },
  text: { icon: IconFileText },
  file: { icon: IconFile },
}

function detectKind(): FileKind {
  if (props.isDir) return 'dir'
  const mime = props.mimeType || ''
  const ext = props.name.split('.').pop()?.toLowerCase() || ''

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'].includes(ext)) {
    return 'image'
  }
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) {
    return 'video'
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return 'audio'
  }
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed')
  ) {
    return 'archive'
  }
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || mime.includes('wordprocessing')) return 'doc'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('spreadsheet')) return 'sheet'
  if (['ppt', 'pptx', 'odp'].includes(ext) || mime.includes('presentation')) return 'slides'
  if (
    [
      'js',
      'jsx',
      'ts',
      'tsx',
      'vue',
      'py',
      'go',
      'java',
      'c',
      'cpp',
      'h',
      'rs',
      'php',
      'rb',
      'swift',
      'kt',
      'sql',
      'sh',
      'bash',
      'html',
      'css',
      'scss',
      'less',
      'json',
      'xml',
      'yaml',
      'yml',
    ].includes(ext) ||
    mime.includes('javascript') ||
    mime.includes('typescript')
  ) {
    return 'code'
  }
  if (['txt', 'md', 'log', 'ini', 'conf', 'env'].includes(ext) || mime.startsWith('text/')) return 'text'
  return 'file'
}

const kind = computed(() => detectKind())
const config = computed(() => FILE_KIND_CONFIG[kind.value])

const displaySize = computed(() => props.size ?? 22)
const iconSize = computed(() => Math.max(14, Math.round(displaySize.value * 0.72)))
const badgeSize = computed(() => {
  const s = displaySize.value
  if (s >= 40) return s + 14
  if (s >= 28) return s + 12
  return s + 10
})
</script>

<template>
  <span
    class="cd-file-type-icon"
    :class="[`cd-file-type-icon--${kind}`, { 'cd-file-type-icon--lg': displaySize >= 28 }]"
    :style="{ width: `${badgeSize}px`, height: `${badgeSize}px` }"
  >
    <component
      :is="config.icon"
      :size="iconSize"
      :stroke="config.stroke ?? 1.65"
    />
  </span>
</template>
