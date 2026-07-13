/** 与 nextfile/internal/services/permission.go 保持一致 */
export const Perm = {
  List: 1 << 0,
  Read: 1 << 1,
  Preview: 1 << 2,
  Create: 1 << 3,
  Mkdir: 1 << 4,
  Write: 1 << 5,
  Rename: 1 << 6,
  Delete: 1 << 7,
  Share: 1 << 8,
  ManageACL: 1 << 9,
  UseAI: 1 << 10,
  Manage: 1 << 11,
  Editor: 1151,
  Viewer: 1031,
} as const

/** 全部权限位（不含保留位） */
export const PermAllBits =
  Perm.List |
  Perm.Read |
  Perm.Preview |
  Perm.Create |
  Perm.Mkdir |
  Perm.Write |
  Perm.Rename |
  Perm.Delete |
  Perm.Share |
  Perm.ManageACL |
  Perm.UseAI |
  Perm.Manage

export type PermBitItem = { bit: number; label: string; hint?: string }

/** 与 server PermNames 顺序一致，供掩码勾选 UI 使用 */
export const PERM_BIT_ITEMS: PermBitItem[] = [
  { bit: Perm.List, label: '列出目录', hint: '1' },
  { bit: Perm.Read, label: '读取/下载', hint: '2' },
  { bit: Perm.Preview, label: '预览', hint: '4' },
  { bit: Perm.Create, label: '上传', hint: '8' },
  { bit: Perm.Mkdir, label: '新建文件夹', hint: '16' },
  { bit: Perm.Write, label: '写入', hint: '32' },
  { bit: Perm.Rename, label: '重命名', hint: '64' },
  { bit: Perm.Delete, label: '删除', hint: '128' },
  { bit: Perm.Share, label: '分享', hint: '256' },
  { bit: Perm.ManageACL, label: '管理 ACL', hint: '512' },
  { bit: Perm.UseAI, label: 'AI 问答', hint: '1024' },
  { bit: Perm.Manage, label: '管理', hint: '2048' },
]

export const PERM_MASK_PRESETS = [
  { id: 'viewer', label: '查看者', mask: Perm.Viewer },
  { id: 'editor', label: '编辑者', mask: Perm.Editor },
  {
    id: 'full',
    label: '完整',
    mask: Perm.Editor | Perm.Delete | Perm.Share | Perm.ManageACL,
  },
  { id: 'all', label: '全部', mask: PermAllBits },
] as const

export function togglePermBit(mask: number, bit: number, checked: boolean) {
  if (checked) return mask | bit
  return mask & ~bit
}

export function permNamesFromMask(mask: number) {
  return PERM_BIT_ITEMS.filter((item) => hasPerm(mask, item.bit)).map((item) => item.label)
}

export function hasPerm(mask: number, bit: number) {
  return (mask & bit) === bit
}

export function canList(mask: number) {
  return hasPerm(mask, Perm.List)
}

export function canRead(mask: number) {
  return hasPerm(mask, Perm.Read)
}

export function canPreview(mask: number) {
  return hasPerm(mask, Perm.Preview)
}

export function canUpload(mask: number) {
  return hasPerm(mask, Perm.Create)
}

export function canMkdir(mask: number) {
  return hasPerm(mask, Perm.Mkdir)
}

export function canRename(mask: number) {
  return hasPerm(mask, Perm.Rename)
}

export function canDelete(mask: number) {
  return hasPerm(mask, Perm.Delete)
}

export function canShare(mask: number) {
  return hasPerm(mask, Perm.Share)
}

export function canManageACL(mask: number) {
  return hasPerm(mask, Perm.ManageACL)
}

export function canEditFiles(mask: number) {
  return hasPerm(mask, Perm.Create | Perm.Write | Perm.Rename)
}

export function canUseAI(mask: number) {
  return hasPerm(mask, Perm.UseAI)
}

export type PresetId = 'view_only' | 'edit' | 'custom'

export function detectPreset(permAllow: number): PresetId {
  if (permAllow === Perm.Viewer) return 'view_only'
  if (permAllow === Perm.Editor) return 'edit'
  return 'custom'
}

export function customFlagsFromMask(permAllow: number) {
  return {
    view: hasPerm(permAllow, Perm.Viewer),
    edit: hasPerm(permAllow, Perm.Create | Perm.Mkdir | Perm.Write | Perm.Rename),
    delete: hasPerm(permAllow, Perm.Delete),
    share: hasPerm(permAllow, Perm.Share),
  }
}

export function customMaskFromFlags(flags: { view: boolean; edit: boolean; delete: boolean; share: boolean }) {
  let mask = 0
  if (flags.view) mask |= Perm.Viewer
  if (flags.edit) mask |= Perm.Create | Perm.Mkdir | Perm.Write | Perm.Rename
  if (flags.delete) mask |= Perm.Delete
  if (flags.share) mask |= Perm.Share
  return mask
}

/** 与挂载权限合并时，用 deny 去掉未授予的位 */
export function denyMaskForGrant(permAllow: number, preset: PresetId) {
  const allGrantable =
    Perm.Viewer | Perm.Create | Perm.Mkdir | Perm.Write | Perm.Rename | Perm.Delete | Perm.Share | Perm.ManageACL
  if (preset === 'view_only') {
    return Perm.Create | Perm.Mkdir | Perm.Write | Perm.Rename | Perm.Delete | Perm.Share | Perm.ManageACL
  }
  if (preset === 'edit') {
    return Perm.Delete | Perm.Share | Perm.ManageACL
  }
  return allGrantable & ~permAllow
}

export function presetLabel(id: PresetId) {
  if (id === 'view_only') return '仅查看'
  if (id === 'edit') return '允许编辑'
  return '自定义'
}
