/**
 * 文件区域右键菜单
 */
import type { ContextMenuItem } from '@/types/contextMenu'
import {
  IconEye,
  IconDownload,
  IconLinkPlus,
  IconPackage,
  IconShare,
  IconPencil,
  IconFolderSymlink,
  IconCopy,
  IconTrash,
  IconFolderPlus,
  IconUpload,
  IconFolderUp,
  IconRefresh,
  IconShieldLock,
} from '@tabler/icons-vue'
import { t } from '@/i18n/translate'

export function buildFileContextMenu(opts: {
  selectedCount: number
  hasSingleFile: boolean
  hasDownloadableFiles: boolean
  hasOfficeFile?: boolean
  isCloudDriver?: boolean
  supportsCloudShare?: boolean
  canShare?: boolean
  canDelete?: boolean
  canRename?: boolean
  canMove?: boolean
  canCopy?: boolean
  canMkdir?: boolean
  canUpload?: boolean
  canManageAcl?: boolean
  canRead?: boolean
  canPreview?: boolean
  isSingleDir?: boolean
}): ContextMenuItem[] {
  const {
    selectedCount: n,
    hasSingleFile,
    hasDownloadableFiles,
    hasOfficeFile,
    isCloudDriver,
    supportsCloudShare,
    canShare = true,
    canDelete = true,
    canRename = true,
    canMove = true,
    canCopy = true,
    canMkdir = true,
    canUpload = true,
    canManageAcl = false,
    canRead = true,
    canPreview = true,
    isSingleDir = false,
  } = opts
  const hideLocalOnly = !!isCloudDriver
  const items: ContextMenuItem[] = []

  if (canPreview) {
    items.push({ id: 'preview', label: t('files.preview'), icon: IconEye, disabled: !hasSingleFile })
  }
  if (!hideLocalOnly && canPreview) {
    items.push({
      id: 'editOffice',
      label: t('files.editOnline'),
      icon: IconPencil,
      disabled: !hasSingleFile || !hasOfficeFile,
    })
  }
  if (canRead) {
    items.push({ id: 'download', label: t('files.download'), icon: IconDownload, disabled: !hasDownloadableFiles })
  }
  if (!hideLocalOnly && canRead) {
    items.push({
      id: 'copyDlLink',
      label: t('files.copyDlLink'),
      icon: IconLinkPlus,
      disabled: !hasSingleFile,
    })
    items.push({ id: 'packDownload', label: t('files.packDownload'), icon: IconPackage, disabled: n === 0, dividerAfter: true })
  } else if (items.length) {
    items[items.length - 1].dividerAfter = true
  }

  if (canShare) {
    items.push({
      id: 'share',
      label: supportsCloudShare ? t('files.baiduShare') : t('files.createShare'),
      icon: IconShare,
      disabled: n !== 1,
      dividerAfter: true,
    })
  }

  if (canRename) {
    items.push({ id: 'rename', label: t('common.rename'), icon: IconPencil, disabled: n !== 1 })
  }
  if (canMove) {
    items.push({ id: 'move', label: t('common.move'), icon: IconFolderSymlink, disabled: n === 0 })
  }
  if (canCopy) {
    items.push({ id: 'copy', label: t('common.copy'), icon: IconCopy, disabled: n === 0 })
  }
  if (canDelete) {
    items.push({
      id: 'delete',
      label: n > 0 ? `${t('common.delete')} (${n})` : t('common.delete'),
      icon: IconTrash,
      danger: true,
      disabled: n === 0,
      dividerAfter: true,
    })
  }

  if (canManageAcl) {
    items.push({
      id: 'manageAcl',
      label: t('files.permSettings'),
      icon: IconShieldLock,
      disabled: !isSingleDir,
      dividerAfter: true,
    })
  }

  if (canMkdir) {
    items.push({ id: 'mkdir', label: t('files.mkdir'), icon: IconFolderPlus })
  }
  if (canUpload) {
    items.push({ id: 'upload', label: t('files.upload'), icon: IconUpload })
    items.push({ id: 'uploadDir', label: t('files.uploadFolder'), icon: IconFolderUp, dividerAfter: true })
  }

  items.push({ id: 'refresh', label: t('common.refresh'), icon: IconRefresh })

  return items.filter((item) => !item.disabled)
}

export const DEV_MENU_IDS = new Set<string>()
