<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconLayoutGrid,
  IconLayoutList,
  IconRefresh,
  IconUpload,
  IconFolderUp,
  IconFolderPlus,
  IconDotsVertical,
  IconLink,
  IconDownload,
  IconPencil,
  IconTrash,
  IconFolderSymlink,
  IconCopy,
  IconChevronUp,
  IconChevronLeft,
  IconChevronRight,
  IconAiAgent,
  IconShieldLock,
} from '@tabler/icons-vue'
import { fmtDate, fmtSize, ApiError } from '@/api/client'
import * as filesApi from '@/api/files'
import * as sharesApi from '@/api/shares'
import * as permsApi from '@/api/permissions'
import * as storagesApi from '@/api/storages'
import type { CloudAccountInfo } from '@/api/storages'
import * as aiApi from '@/api/ai'
import type { AIDirectoryStatus } from '@/api/ai'
import type { FileEntry, StorageRow } from '@/types/files'
import { joinPath, parentPath, pathWithin } from '@/utils/paths'
import { buildFileContextMenu, DEV_MENU_IDS } from '@/utils/fileContextMenu'
import { collectDirectoryInput, collectDropEntries, type UploadEntry } from '@/utils/folderUpload'
import { copyToClipboard } from '@/utils/clipboard'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useAgentsStore } from '@/stores/agents'
import FileTypeIcon from '@/components/FileTypeIcon.vue'
import FileContextMenu from '@/components/FileContextMenu.vue'
import FileRowToolbar from '@/components/FileRowToolbar.vue'
import type { FileRowAction } from '@/components/FileRowToolbar.vue'
import DirectoryAIPanel from '@/components/DirectoryAIPanel.vue'
import CdModal from '@/components/CdModal.vue'
import ShareModal from '@/components/ShareModal.vue'
import PathAclModal from '@/components/PathAclModal.vue'
import PickupCodePanel from '@/components/PickupCodePanel.vue'
import DestDirPicker from '@/components/DestDirPicker.vue'
import UploadPanel from '@/components/UploadPanel.vue'
import { useUploadQueue } from '@/composables/useUploadQueue'
import { useFileSidebar } from '@/composables/useFileSidebar'
import { useBrandingStore } from '@/stores/branding'
import { isPickupEnabled } from '@/types/branding'
import { useI18n } from 'vue-i18n'
import {
  canDelete,
  canMkdir,
  canRename,
  canShare,
  canUpload,
  canEditFiles,
  canRead,
  canPreview,
} from '@/utils/permissions'

const toast = useToast()
const { t } = useI18n()
const auth = useAuthStore()
const agentsStore = useAgentsStore()
const route = useRoute()
const router = useRouter()
const uploadQueue = useUploadQueue()
const branding = useBrandingStore()
const { collapsed: storageCollapsed, toggle: toggleStorageSidebar } = useFileSidebar()

const pickupEnabled = computed(() => isPickupEnabled(branding.settings))

const storages = ref<StorageRow[]>([])
const currentStorageId = ref('')
const currentPath = ref('/')
const files = ref<FileEntry[]>([])
const selected = ref<Set<string>>(new Set())
const lastIndex = ref(-1)
const keyword = ref('')
const loading = ref(false)
const viewMode = ref<'list' | 'grid'>('list')
const dragOver = ref(false)

const showMkdir = ref(false)
const showRename = ref(false)
const showShare = ref(false)
const shareTarget = ref<FileEntry | null>(null)
const showPathAcl = ref(false)
const aclTarget = ref<FileEntry | null>(null)
const currentPermMask = ref(0)
const mkdirName = ref('')
const renameName = ref('')
const renameTarget = ref<FileEntry | null>(null)

const ctxMenu = ref({ show: false, x: 0, y: 0 })
const showPreview = ref(false)
const previewTarget = ref<FileEntry | null>(null)
const showOfficeEditor = ref(false)
const officeTarget = ref<FileEntry | null>(null)
const officeLoading = ref(false)
const officeEditorHost = ref<HTMLDivElement | null>(null)
const showPathAction = ref(false)
const pathActionMode = ref<'move' | 'copy'>('move')
const destDir = ref('')

const aiStatus = ref<AIDirectoryStatus | null>(null)
const aiToggling = ref(false)
const cloudInfo = ref<CloudAccountInfo | null>(null)
const cloudInfoLoading = ref(false)

const aiEnabled = computed(() => aiStatus.value?.enabled && aiStatus.value?.can_use)

const previewUrl = computed(() => {
  if (!previewTarget.value) return ''
  return filesApi.previewUrl(currentStorageId.value, previewTarget.value.path)
})

const previewIsImage = computed(() => {
  const m = previewTarget.value?.mimeType || ''
  const n = previewTarget.value?.name.toLowerCase() || ''
  return m.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(n)
})

const previewIsPdf = computed(() => {
  const m = previewTarget.value?.mimeType || ''
  return m.includes('pdf') || previewTarget.value?.name.toLowerCase().endsWith('.pdf')
})

const previewIsVideo = computed(() => {
  const m = previewTarget.value?.mimeType || ''
  const n = previewTarget.value?.name.toLowerCase() || ''
  return m.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/.test(n)
})

const previewIsAudio = computed(() => {
  const m = previewTarget.value?.mimeType || ''
  const n = previewTarget.value?.name.toLowerCase() || ''
  return m.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/.test(n)
})

const previewIsText = computed(() => {
  const n = previewTarget.value?.name.toLowerCase() || ''
  return /\.(txt|md|json|xml|yml|yaml|log|csv|js|ts|vue|go|py|html|css)$/.test(n)
})

const fileOnlySelected = computed(() => selectedItems.value.filter((f) => !f.isDir))

const permCanUpload = computed(() => canUpload(currentPermMask.value))
const permCanMkdir = computed(() => canMkdir(currentPermMask.value))
const permCanDelete = computed(() => canDelete(currentPermMask.value))
const permCanShare = computed(() => canShare(currentPermMask.value))
const permCanRename = computed(() => canRename(currentPermMask.value))
const permCanMoveCopy = computed(() => canEditFiles(currentPermMask.value))
const permCanRead = computed(() => canRead(currentPermMask.value))
const permCanPreview = computed(() => canPreview(currentPermMask.value))
const permCanManageAcl = computed(() => auth.isAdmin)

const toolbarHasFileActions = computed(
  () =>
    permCanShare.value ||
    permCanMoveCopy.value ||
    permCanRename.value ||
    permCanDelete.value ||
    permCanManageAcl.value ||
    permCanRead.value,
)

const contextMenuItems = computed(() => {
  const n = selectedCount.value
  const single = selectedItems.value[0]
  const hasSingleFile = n === 1 && !!single && !single.isDir
  const hasDownloadableFiles = fileOnlySelected.value.length > 0
  const hasOfficeFile = hasSingleFile && filesApi.isOfficeEditable(single!.name)
  const isSingleDir = n === 1 && !!single?.isDir
  return buildFileContextMenu({
    selectedCount: n,
    hasSingleFile,
    hasDownloadableFiles,
    hasOfficeFile,
    isCloudDriver: isCloudDriver.value,
    supportsCloudShare: usesCloudShare.value && canBaiduShare.value,
    canShare: permCanShare.value,
    canDelete: permCanDelete.value,
    canRename: permCanRename.value,
    canMove: permCanMoveCopy.value,
    canCopy: permCanMoveCopy.value,
    canMkdir: permCanMkdir.value,
    canUpload: permCanUpload.value,
    canManageAcl: permCanManageAcl.value,
    isSingleDir,
    canRead: permCanRead.value,
    canPreview: permCanPreview.value,
  })
})

const currentStorage = computed(() => storages.value.find((s) => s.id === currentStorageId.value))
const accessRoot = computed(() => {
  const s = currentStorage.value
  return s?.access_root_path || s?.root_path || '/'
})
const usesCloudShare = computed(() => filesApi.isCloudShareDriver(currentStorage.value?.driver))
const canBaiduShare = computed(() => {
  if (!isBaiduPan.value) return false
  return cloudInfo.value?.share_capable === true
})
const isBaiduPan = computed(() => currentStorage.value?.driver === 'baidu_pan')
const isCloudDriver = computed(() =>
  ['baidu_pan', 'onedrive', 'google_drive'].includes(currentStorage.value?.driver || ''),
)
const showCloudPanel = computed(() => isBaiduPan.value && !storageCollapsed.value)
const cloudUsagePercent = computed(() => {
  if (!cloudInfo.value?.total_bytes) return 0
  return Math.min(100, Math.round((cloudInfo.value.used_bytes / cloudInfo.value.total_bytes) * 100))
})

const breadcrumbs = computed(() => {
  const root = accessRoot.value
  if (currentPath.value === root) return []
  const rel = currentPath.value.slice(root.length).replace(/^\//, '')
  if (!rel) return []
  const parts = rel.split('/')
  const crumbs: { label: string; path: string }[] = []
  let p = root
  for (const part of parts) {
    p = joinPath(p, part)
    crumbs.push({ label: part, path: p })
  }
  return crumbs
})

const filteredFiles = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return files.value
  return files.value.filter((f) => f.name.toLowerCase().includes(kw))
})

const selectedItems = computed(() => files.value.filter((f) => selected.value.has(f.id)))
const selectedCount = computed(() => selected.value.size)
const allSelected = computed(
  () => filteredFiles.value.length > 0 && filteredFiles.value.every((f) => selected.value.has(f.id)),
)

const canGoUp = computed(() => currentPath.value !== accessRoot.value)

const parentDir = computed(() => parentPath(currentPath.value))

const currentDirEntry = computed((): FileEntry => {
  const root = accessRoot.value
  const name =
    currentPath.value === root
      ? currentStorage.value?.name || '根目录'
      : currentPath.value.split('/').filter(Boolean).pop() || '目录'
  return {
    id: `dir:${currentPath.value}`,
    name,
    path: currentPath.value,
    isDir: true,
    size: 0,
    modified: '',
  }
})

function storageEntryPath(s: StorageRow) {
  return s.access_root_path || s.root_path || '/'
}

function applyRouteQuery() {
  const qStorage = route.query.tab || route.query.storage
  const qPath = route.query.path
  if (typeof qStorage === 'string' && storages.value.some((s) => s.id === qStorage)) {
    currentStorageId.value = qStorage
    const s = storages.value.find((x) => x.id === qStorage)
    if (typeof qPath === 'string' && qPath.startsWith('/')) {
      const root = s ? storageEntryPath(s) : '/'
      currentPath.value = pathWithin(root, qPath) ? qPath : root
    } else {
      currentPath.value = s ? storageEntryPath(s) : '/'
    }
    return true
  }
  return false
}

function syncRouteQuery() {
  if (!currentStorageId.value) return
  const query: Record<string, string> = { tab: currentStorageId.value }
  const root = accessRoot.value
  if (currentPath.value && currentPath.value !== root) {
    query.path = currentPath.value
  }
  const curPath = typeof route.query.path === 'string' ? route.query.path : ''
  const curTab = (route.query.tab || route.query.storage) as string
  if (curTab === query.tab && curPath === (query.path || '')) return
  router.replace({ path: '/files', query })
}

async function loadCloudInfo() {
  if (!isBaiduPan.value || !currentStorageId.value) {
    cloudInfo.value = null
    return
  }
  cloudInfoLoading.value = true
  try {
    cloudInfo.value = await storagesApi.getCloudInfo(currentStorageId.value)
  } catch {
    const name = currentStorage.value?.config?.account_name?.trim()
    cloudInfo.value = name
      ? { provider: 'baidu_pan', account_name: name, total_bytes: 0, used_bytes: 0, share_capable: false }
      : null
  } finally {
    cloudInfoLoading.value = false
  }
}

async function loadStorages() {
  try {
    const res = await storagesApi.listStorages({ all: true })
    storages.value = res.items.filter((s) => s.enabled)
    if (!storages.value.length) return
    if (!applyRouteQuery()) {
      if (!currentStorageId.value || !storages.value.some((s) => s.id === currentStorageId.value)) {
        currentStorageId.value = storages.value[0].id
        currentPath.value = storageEntryPath(storages.value[0])
      }
    }
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载存储源失败')
  }
}

async function loadCurrentPerm() {
  if (!currentStorageId.value) return
  try {
    const res = await permsApi.effectivePerm(currentStorageId.value, currentPath.value)
    currentPermMask.value = res.perm_mask
  } catch {
    currentPermMask.value = 0
  }
}

async function loadFiles() {
  loading.value = true
  try {
    files.value = await filesApi.listFiles(currentStorageId.value, currentPath.value)
    selected.value = new Set()
    lastIndex.value = -1
    await Promise.all([loadAIStatus(), loadCurrentPerm()])
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadAIStatus() {
  if (!currentStorageId.value) {
    aiStatus.value = null
    return
  }
  try {
    aiStatus.value = await aiApi.getAIDirectoryStatus(currentStorageId.value, currentPath.value)
  } catch {
    aiStatus.value = null
  }
}

async function toggleAIDirectory() {
  if (!auth.isAdmin || !currentStorageId.value) return
  await agentsStore.load()
  const agent = agentsStore.sidebarAgents[0]
  if (!agent) {
    toast.show('请先在管理后台创建并启用智能体')
    return
  }
  aiToggling.value = true
  try {
    const enabling = !aiStatus.value?.configured || !aiStatus.value?.enabled
    await aiApi.putAIDirectoryConfig({
      storage_id: currentStorageId.value,
      path: currentPath.value,
      agent_id: agent.id,
      enabled: enabling,
      inherit: true,
    })
    toast.show(enabling ? '已启用当前目录 AI 问答' : '已关闭当前目录 AI 问答')
    await loadAIStatus()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '操作失败')
  } finally {
    aiToggling.value = false
  }
}

function selectStorage(id: string, path?: string) {
  currentStorageId.value = id
  const s = storages.value.find((x) => x.id === id)
  currentPath.value = path || (s ? storageEntryPath(s) : '/')
  syncRouteQuery()
  loadFiles()
  loadCloudInfo()
}

function navigate(path: string) {
  currentPath.value = path
  syncRouteQuery()
  loadFiles()
}

function goUp() {
  if (canGoUp.value) navigate(parentDir.value)
}

function toggleRow(item: FileEntry, index: number, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (selected.value.has(item.id)) selected.value.delete(item.id)
    else selected.value.add(item.id)
    lastIndex.value = index
  } else if (e.shiftKey && lastIndex.value >= 0) {
    const [a, b] = [Math.min(lastIndex.value, index), Math.max(lastIndex.value, index)]
    filteredFiles.value.forEach((f, i) => {
      if (i >= a && i <= b) selected.value.add(f.id)
    })
  } else {
    selected.value = new Set([item.id])
    lastIndex.value = index
  }
}

function toggleCheck(item: FileEntry, e: Event) {
  e.stopPropagation()
  if (selected.value.has(item.id)) selected.value.delete(item.id)
  else selected.value.add(item.id)
}

function toggleSelectAll() {
  if (allSelected.value) selected.value = new Set()
  else filteredFiles.value.forEach((f) => selected.value.add(f.id))
}

function openItem(item: FileEntry) {
  if (item.isDir) navigate(item.path)
  else openPreview(item)
}

function clearSelection() {
  selected.value = new Set()
}

async function doMkdir() {
  try {
    await filesApi.mkdir(currentStorageId.value, currentPath.value, mkdirName.value)
    showMkdir.value = false
    mkdirName.value = ''
    toast.show('文件夹已创建')
    loadFiles()
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '创建失败')
  }
}

async function doRename() {
  if (!renameTarget.value) return
  try {
    await filesApi.renameFile(currentStorageId.value, renameTarget.value.path, renameName.value)
    showRename.value = false
    renameTarget.value = null
    toast.show('已重命名')
    loadFiles()
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '重命名失败')
  }
}

function openRename(item: FileEntry) {
  renameTarget.value = item
  renameName.value = item.name
  showRename.value = true
}

async function doDelete(items = selectedItems.value) {
  if (!items.length) return
  const label = items.length === 1 ? items[0].name : `${items.length} 项`
  if (!confirm(`确定删除 ${label}？`)) return
  try {
    await filesApi.deleteFiles(
      currentStorageId.value,
      items.map((i) => i.path),
    )
    toast.show('已删除')
    loadFiles()
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '删除失败')
  }
}

function openShare() {
  const item = selectedItems.value[0]
  if (!item) return toast.show(t('files.selectFile'))
  if (!permCanShare.value) return toast.show(t('files.noSharePerm'))
  shareTarget.value = item
  showShare.value = true
}

function openPathAcl(item?: FileEntry) {
  if (!auth.isAdmin) return
  const target = item || selectedItems.value[0]
  if (!target?.isDir) return toast.show(t('files.selectFolder'))
  aclTarget.value = target
  showPathAcl.value = true
}

async function createDirectLink() {
  const item = selectedItems.value[0]
  if (!item || item.isDir) return
  try {
    const res = await filesApi.createDirectLink(currentStorageId.value, item.path)
    await copyText(res.absolute_url, '直链已复制（1小时有效）')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '生成直链失败')
  }
}

function createShortLink() {
  openShare()
}

async function createBothLinks() {
  const item = selectedItems.value[0]
  if (!item || item.isDir) return
  try {
    const direct = await filesApi.createDirectLink(currentStorageId.value, item.path)
    const share = await sharesApi.createShare({
      storage_id: currentStorageId.value,
      path: item.path,
      is_public: true,
      expires_days: 7,
    })
    const shareURL = sharesApi.publicSharePageUrl(share.token, undefined, true)
    await copyText(`直链: ${direct.absolute_url}\n分享: ${shareURL}`, '链接已复制')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '生成链接失败')
  }
}

async function packDownloadSelected() {
  const paths = fileOnlySelected.value.map((f) => f.path)
  if (!paths.length) return toast.show('请选择要打包的文件')
  try {
    await filesApi.packDownload(currentStorageId.value, paths)
    toast.show('已开始下载 ZIP')
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '打包失败')
  }
}

async function copyText(text: string, msg = '已复制') {
  if (await copyToClipboard(text)) {
    toast.show(msg)
  } else {
    toast.show('复制失败，请手动选择复制')
  }
}

function onDownload(items = fileOnlySelected.value) {
  if (!permCanRead.value) return toast.show(t('files.noDownloadPerm'))
  if (!items.length) return toast.show('请选择要下载的文件')
  items.forEach((i) => window.open(filesApi.downloadUrl(currentStorageId.value, i.path), '_blank'))
}

function selectSingleItem(item: FileEntry) {
  selected.value = new Set([item.id])
  lastIndex.value = filteredFiles.value.findIndex((f) => f.id === item.id)
}

function onRowAction(action: FileRowAction, item: FileEntry) {
  selectSingleItem(item)
  switch (action) {
    case 'share':
      if (!permCanShare.value) return toast.show(t('files.noSharePerm'))
      shareTarget.value = item
      showShare.value = true
      break
    case 'download':
      if (item.isDir) return toast.show('请选择要下载的文件')
      onDownload([item])
      break
    case 'delete':
      if (!permCanDelete.value) return toast.show(t('files.noDeletePerm'))
      void doDelete([item])
      break
    case 'rename':
      if (!permCanRename.value) return toast.show(t('files.noRenamePerm'))
      openRename(item)
      break
    case 'copy':
      if (!permCanMoveCopy.value) return toast.show(t('files.noCopyPerm'))
      openPathAction('copy')
      break
    case 'move':
      if (!permCanMoveCopy.value) return toast.show(t('files.noMovePerm'))
      openPathAction('move')
      break
    case 'manageAcl':
      openPathAcl(item)
      break
  }
}

const rowShareLabel = computed(() =>
  usesCloudShare.value && canBaiduShare.value ? '百度网盘分享' : '分享',
)

function openPreview(item?: FileEntry) {
  if (!permCanPreview.value && !permCanRead.value) return toast.show(t('files.noPreviewPerm'))
  const target = item || selectedItems.value[0]
  if (!target || target.isDir) return
  previewTarget.value = target
  showPreview.value = true
}

declare global {
  interface Window {
    DocsAPI?: { DocEditor: new (id: string, cfg: Record<string, unknown>) => { destroyEditor?: () => void } }
  }
}

let officeEditorInstance: { destroyEditor?: () => void } | null = null

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
    script.onerror = () => reject(new Error('无法加载 ONLYOFFICE 脚本'))
    document.head.appendChild(script)
  })
}

async function openOfficeEditor(item?: FileEntry) {
  if (!permCanMoveCopy.value) return toast.show(t('files.noEditPerm'))
  const target = item || selectedItems.value[0]
  if (!target || target.isDir || !filesApi.isOfficeEditable(target.name)) return
  officeTarget.value = target
  showOfficeEditor.value = true
  officeLoading.value = true
  try {
    const res = await filesApi.onlyOfficeConfig(currentStorageId.value, target.path)
    await loadOnlyOfficeScript(res.server_url)
    await new Promise((r) => setTimeout(r, 50))
    if (officeEditorInstance?.destroyEditor) officeEditorInstance.destroyEditor()
    if (officeEditorHost.value) officeEditorHost.value.innerHTML = ''
    officeEditorInstance = new window.DocsAPI!.DocEditor('cd-onlyoffice-editor', res.config)
  } catch (e) {
    showOfficeEditor.value = false
    toast.show(e instanceof ApiError ? e.message : '打开编辑器失败')
  } finally {
    officeLoading.value = false
  }
}

function closeOfficeEditor() {
  if (officeEditorInstance?.destroyEditor) officeEditorInstance.destroyEditor()
  officeEditorInstance = null
  if (officeEditorHost.value) officeEditorHost.value.innerHTML = ''
  showOfficeEditor.value = false
  officeTarget.value = null
  loadFiles()
}

const pathActionBlocked = computed(() => {
  if (pathActionMode.value !== 'move') return []
  return selectedItems.value.filter((i) => i.isDir).map((i) => i.path)
})

function openPathAction(mode: 'move' | 'copy') {
  if (!selectedCount.value) return
  pathActionMode.value = mode
  destDir.value = currentPath.value
  showPathAction.value = true
}

async function submitPathAction() {
  const paths = selectedItems.value.map((i) => i.path)
  const dest = destDir.value.trim() || '/'
  try {
    if (pathActionMode.value === 'move') {
      await filesApi.moveFiles(currentStorageId.value, paths, dest)
      toast.show('已移动')
    } else {
      await filesApi.copyFiles(currentStorageId.value, paths, dest)
      toast.show('已复制')
    }
    showPathAction.value = false
    loadFiles()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '操作失败')
  }
}

function openContextMenu(e: MouseEvent, item?: FileEntry) {
  e.preventDefault()
  const x = Math.min(e.clientX, window.innerWidth - 220)
  const y = Math.min(e.clientY, window.innerHeight - 480)
  if (item && !selected.value.has(item.id)) {
    selected.value = new Set([item.id])
    lastIndex.value = filteredFiles.value.findIndex((f) => f.id === item.id)
  }
  ctxMenu.value = { show: true, x, y }
}

function closeContextMenu() {
  ctxMenu.value.show = false
}

function onContextMenuSelect(id: string) {
  closeContextMenu()
  if (DEV_MENU_IDS.has(id)) {
    toast.show('该功能开发中，敬请期待')
    return
  }
  const single = selectedItems.value[0]
  switch (id) {
    case 'preview': openPreview(); break
    case 'editOffice': openOfficeEditor(); break
    case 'download': onDownload(); break
    case 'copyDlLink':
      if (single && !single.isDir) copyText(filesApi.absoluteDownloadUrl(currentStorageId.value, single.path), '下载链接已复制')
      break
    case 'packDownload': packDownloadSelected(); break
    case 'directLink': createDirectLink(); break
    case 'shortLink': createShortLink(); break
    case 'bothLinks': createBothLinks(); break
    case 'share': openShare(); break
    case 'rename': if (single) openRename(single); break
    case 'move': openPathAction('move'); break
    case 'copy': openPathAction('copy'); break
    case 'delete': doDelete(); break
    case 'manageAcl': openPathAcl(single); break
    case 'mkdir': showMkdir.value = true; break
    case 'upload': pickUpload(); break
    case 'uploadDir': pickUploadDir(); break
    case 'refresh': loadFiles(); break
  }
}

const fileInput = ref<HTMLInputElement | null>(null)
const dirInput = ref<HTMLInputElement | null>(null)

function pickUpload() {
  if (!permCanUpload.value) return toast.show(t('files.noUploadPerm'))
  fileInput.value?.click()
}

function pickUploadDir() {
  if (!permCanUpload.value) return toast.show(t('files.noUploadPerm'))
  dirInput.value?.click()
}

async function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const list = input.files
  if (!list?.length) return
  await uploadFileList(Array.from(list).map((file) => ({ file })))
  input.value = ''
}

async function onDirPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const list = input.files
  if (!list?.length) return
  await uploadFileList(collectDirectoryInput(list))
  input.value = ''
}

async function uploadFileList(list: UploadEntry[]) {
  if (!list.length) return
  uploadQueue.enqueue(list, currentStorageId.value, currentPath.value, () => {
    loadFiles()
  })
}

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) dragOver.value = true
}

function onDragLeave(e: DragEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dragOver.value = false
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  if (!permCanUpload.value) {
    toast.show(t('files.noUploadPerm'))
    return
  }
  const dt = e.dataTransfer
  if (!dt) return
  const list = await collectDropEntries(dt)
  if (!list.length) return
  await uploadFileList(list)
}

function onKeydown(e: KeyboardEvent) {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    filteredFiles.value.forEach((f) => selected.value.add(f.id))
  }
  if (e.key === 'Escape') {
    clearSelection()
    closeContextMenu()
  }
  if (e.key === 'Delete' && selectedCount.value && permCanDelete.value) doDelete()
  if (e.key === 'F2' && selectedCount.value === 1 && permCanRename.value) openRename(selectedItems.value[0])
}

onMounted(async () => {
  await loadStorages()
  if (currentStorageId.value) {
    if (!route.query.tab && !route.query.storage) syncRouteQuery()
    await Promise.all([loadFiles(), loadCloudInfo()])
  }
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(
  () => [route.query.tab, route.query.storage, route.query.path],
  async () => {
    if (!storages.value.length) return
    const changed = applyRouteQuery()
    if (changed && currentStorageId.value) {
      await Promise.all([loadFiles(), loadCloudInfo()])
    }
  },
)
</script>

<template>
  <div
    class="cd-file-shell"
    @dragenter="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <aside class="cd-file-sidebar" :class="{ 'cd-file-sidebar--collapsed': storageCollapsed }">
      <div class="cd-file-sidebar-head">
        <span v-if="!storageCollapsed" class="cd-file-sidebar-title">存储</span>
      </div>
      <nav class="cd-file-storage-list">
        <button
          v-for="s in storages"
          :key="s.id"
          type="button"
          class="cd-file-storage-item"
          :class="{ active: currentStorageId === s.id }"
          :title="s.name"
          @click="selectStorage(s.id)"
        >
          <FileTypeIcon name="" is-dir :size="20" />
          <span v-if="!storageCollapsed" class="cd-file-storage-name">{{ s.name }}</span>
        </button>
      </nav>
      <div v-if="showCloudPanel" class="cd-file-cloud-panel">
        <div v-if="cloudInfoLoading" class="cd-file-cloud-loading text-secondary small">加载账号信息…</div>
        <template v-else-if="cloudInfo">
          <div class="cd-file-cloud-user">
            <div class="cd-file-cloud-meta">
              <div class="cd-file-cloud-name" :title="cloudInfo.account_name">{{ cloudInfo.account_name }}</div>
              <div class="cd-file-cloud-label">百度网盘</div>
            </div>
          </div>
          <div v-if="cloudInfo.total_bytes > 0" class="cd-file-cloud-quota">
            <div class="cd-file-cloud-quota-text">
              <span>{{ fmtSize(cloudInfo.used_bytes) }}</span>
              <span class="text-secondary"> / {{ fmtSize(cloudInfo.total_bytes) }}</span>
            </div>
            <div class="progress progress-sm cd-file-cloud-progress">
              <div
                class="progress-bar bg-primary"
                role="progressbar"
                :style="{ width: `${cloudUsagePercent}%` }"
                :aria-valuenow="cloudUsagePercent"
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>
          </div>
          <div v-else class="cd-file-cloud-quota text-secondary small">容量信息暂不可用</div>
        </template>
      </div>
      <button
        type="button"
        class="cd-sidebar-fold"
        :title="storageCollapsed ? '展开' : '收起'"
        @click="toggleStorageSidebar"
      >
        <IconChevronLeft v-if="!storageCollapsed" :size="14" :stroke="2" />
        <IconChevronRight v-else :size="14" :stroke="2" />
      </button>
    </aside>

    <div class="cd-file-workspace">
    <div class="cd-file-main">
      <div class="cd-file-toolbar">
        <button
          v-if="auth.isAdmin"
          type="button"
          class="btn btn-sm d-inline-flex align-items-center gap-1"
          :class="aiStatus?.enabled ? 'btn-success' : 'btn-outline-secondary'"
          :disabled="aiToggling"
          @click="toggleAIDirectory"
        >
          <IconAiAgent :size="16" />
          {{ aiStatus?.enabled ? t('files.aiOn') : t('files.enableAi') }}
        </button>
        <div v-if="permCanUpload" class="cd-upload-trigger">
          <button
            type="button"
            class="btn btn-primary btn-sm cd-upload-trigger__btn d-inline-flex align-items-center gap-1"
            @click="pickUpload"
          >
            <IconUpload :size="16" /> {{ t('files.upload') }}
          </button>
          <div class="cd-upload-trigger__menu" role="menu">
            <button type="button" class="cd-upload-trigger__item" role="menuitem" @click="pickUpload">
              <IconUpload :size="16" />
              <span>{{ t('files.upload') }}</span>
            </button>
            <button type="button" class="cd-upload-trigger__item" role="menuitem" @click="pickUploadDir">
              <IconFolderUp :size="16" />
              <span>{{ t('files.uploadFolder') }}</span>
            </button>
          </div>
        </div>
        <button
          v-if="permCanMkdir"
          type="button"
          class="btn btn-sm d-inline-flex align-items-center gap-1"
          @click="showMkdir = true"
        >
          <IconFolderPlus :size="16" /> {{ t('files.mkdir') }}
        </button>
        <button
          v-if="permCanManageAcl"
          type="button"
          class="btn btn-sm d-inline-flex align-items-center gap-1"
          :title="t('files.dirPermissions')"
          @click="openPathAcl(currentDirEntry)"
        >
          <IconShieldLock :size="16" /> {{ t('files.dirPermissions') }}
        </button>
        <button type="button" class="btn btn-sm d-inline-flex align-items-center gap-1" :disabled="loading" @click="loadFiles">
          <IconRefresh :size="16" :class="{ 'cd-spin': loading }" /> {{ t('common.refresh') }}
        </button>
        <div v-if="toolbarHasFileActions" class="dropdown">
          <button type="button" class="btn btn-sm dropdown-toggle d-inline-flex align-items-center gap-1" data-bs-toggle="dropdown">
            <IconDotsVertical :size="16" /> {{ t('common.more') }}
          </button>
          <ul class="dropdown-menu">
            <li v-if="permCanShare">
              <button type="button" class="dropdown-item d-flex align-items-center gap-2" :disabled="selectedCount !== 1" @click="openShare">
                <IconLink :size="16" /> {{ t('files.shareLink') }}
              </button>
            </li>
            <li v-if="permCanRead">
              <button type="button" class="dropdown-item d-flex align-items-center gap-2" :disabled="!selectedCount" @click="onDownload">
                <IconDownload :size="16" /> {{ t('common.download') }}
              </button>
            </li>
            <li v-if="permCanMoveCopy"><hr class="dropdown-divider" /></li>
            <li v-if="permCanMoveCopy">
              <button type="button" class="dropdown-item d-flex align-items-center gap-2" :disabled="!selectedCount" @click="openPathAction('move')">
                <IconFolderSymlink :size="16" /> {{ t('common.move') }}
              </button>
            </li>
            <li v-if="permCanMoveCopy">
              <button type="button" class="dropdown-item d-flex align-items-center gap-2" :disabled="!selectedCount" @click="openPathAction('copy')">
                <IconCopy :size="16" /> {{ t('common.copy') }}
              </button>
            </li>
            <li v-if="permCanRename || permCanDelete"><hr class="dropdown-divider" /></li>
            <li v-if="permCanRename">
              <button type="button" class="dropdown-item d-flex align-items-center gap-2" :disabled="selectedCount !== 1" @click="openRename(selectedItems[0])">
                <IconPencil :size="16" /> {{ t('common.rename') }}
              </button>
            </li>
            <li v-if="permCanDelete">
              <button type="button" class="dropdown-item text-danger d-flex align-items-center gap-2" :disabled="!selectedCount" @click="doDelete()">
                <IconTrash :size="16" /> {{ t('common.delete') }}
              </button>
            </li>
            <li v-if="permCanManageAcl">
              <button
                type="button"
                class="dropdown-item d-flex align-items-center gap-2"
                :disabled="selectedCount !== 1 || !selectedItems[0]?.isDir"
                @click="openPathAcl(selectedItems[0])"
              >
                <IconShieldLock :size="16" /> {{ t('files.permSettings') }}
              </button>
            </li>
          </ul>
        </div>

        <div class="btn-group btn-group-sm ms-1">
          <button type="button" class="btn" :class="{ active: viewMode === 'list' }" :title="t('files.listView')" @click="viewMode = 'list'">
            <IconLayoutList :size="16" />
          </button>
          <button type="button" class="btn" :class="{ active: viewMode === 'grid' }" :title="t('files.gridView')" @click="viewMode = 'grid'">
            <IconLayoutGrid :size="16" />
          </button>
        </div>

        <input
          v-model="keyword"
          type="search"
          class="form-control form-control-sm"
          :placeholder="t('files.filterPlaceholder')"
          style="max-width: 12rem"
        />
      </div>

      <nav class="px-3 py-2 border-bottom small d-flex align-items-center gap-2">
        <button v-if="canGoUp" type="button" class="btn btn-sm btn-ghost-secondary px-1" title="上级目录" @click="goUp">
          <IconChevronUp :size="18" />
        </button>
        <ol class="breadcrumb breadcrumb-arrows mb-0 flex-fill">
          <li class="breadcrumb-item">
            <a href="#" @click.prevent="navigate(accessRoot)">{{ currentStorage?.name }}</a>
          </li>
          <li
            v-for="(c, i) in breadcrumbs"
            :key="c.path"
            class="breadcrumb-item"
            :class="{ active: i === breadcrumbs.length - 1 }"
          >
            <a v-if="i < breadcrumbs.length - 1" href="#" @click.prevent="navigate(c.path)">{{ c.label }}</a>
            <span v-else>{{ c.label }}</span>
          </li>
        </ol>
      </nav>

      <div class="cd-file-body flex-fill position-relative" @contextmenu="openContextMenu($event)">
        <div v-if="loading" class="cd-loading">加载中…</div>

        <template v-else-if="filteredFiles.length">
          <div v-if="viewMode === 'list'" class="table-responsive h-100">
            <table class="table table-vcenter table-hover cd-file-table mb-0">
              <thead>
                <tr>
                  <th class="w-1">
                    <input class="form-check-input m-0" type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
                  </th>
                  <th class="cd-file-name-col">名称</th>
                  <th class="cd-file-actions-col d-none d-sm-table-cell" aria-label="操作"></th>
                  <th class="d-none d-sm-table-cell">大小</th>
                  <th class="cd-file-modified-col d-none d-md-table-cell">修改时间</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in filteredFiles"
                  :key="item.id"
                  :class="{ selected: selected.has(item.id) }"
                  @click="toggleRow(item, idx, $event)"
                  @dblclick="openItem(item)"
                  @contextmenu="openContextMenu($event, item)"
                >
                  <td @click.stop>
                    <input
                      class="form-check-input m-0"
                      type="checkbox"
                      :checked="selected.has(item.id)"
                      @change="toggleCheck(item, $event)"
                    />
                  </td>
                  <td class="cd-file-name-col">
                    <span class="d-inline-flex align-items-center gap-2 cd-file-name-cell">
                      <FileTypeIcon :name="item.name" :is-dir="item.isDir" :mime-type="item.mimeType" />
                      <span class="text-truncate">{{ item.name }}</span>
                    </span>
                  </td>
                  <td class="cd-file-actions-col d-none d-sm-table-cell" @click.stop>
                    <FileRowToolbar
                      :item="item"
                      :share-label="rowShareLabel"
                      :can-share="permCanShare"
                      :can-download="permCanRead"
                      :can-delete="permCanDelete"
                      :can-rename="permCanRename"
                      :can-copy="permCanMoveCopy"
                      :can-move="permCanMoveCopy"
                      :can-manage-acl="auth.isAdmin"
                      @action="onRowAction"
                    />
                  </td>
                  <td class="text-secondary d-none d-sm-table-cell cd-file-size-cell">
                    {{ item.isDir ? '—' : fmtSize(item.size) }}
                  </td>
                  <td class="text-secondary cd-file-modified-col d-none d-md-table-cell">{{ fmtDate(item.modified) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="cd-file-grid p-3">
            <button
              v-for="(item, idx) in filteredFiles"
              :key="item.id"
              type="button"
              class="cd-grid-item"
              :class="{ selected: selected.has(item.id) }"
              @click="toggleRow(item, idx, $event)"
              @dblclick="openItem(item)"
              @contextmenu="openContextMenu($event, item)"
            >
              <FileTypeIcon :name="item.name" :is-dir="item.isDir" :mime-type="item.mimeType" :size="38" />
              <span class="cd-grid-name">{{ item.name }}</span>
              <span v-if="!item.isDir" class="cd-grid-meta">{{ fmtSize(item.size) }}</span>
            </button>
          </div>
        </template>

        <div v-else class="cd-empty">
          <p class="mb-2">此目录为空</p>
          <div class="cd-upload-trigger cd-upload-trigger--center" v-if="permCanUpload">
            <button
              type="button"
              class="btn btn-sm btn-primary cd-upload-trigger__btn d-inline-flex align-items-center gap-1"
              @click="pickUpload"
            >
              <IconUpload :size="16" /> 上传
            </button>
            <div class="cd-upload-trigger__menu" role="menu">
              <button type="button" class="cd-upload-trigger__item" role="menuitem" @click="pickUpload">
                <IconUpload :size="16" />
                <span>上传</span>
              </button>
              <button type="button" class="cd-upload-trigger__item" role="menuitem" @click="pickUploadDir">
                <IconFolderUp :size="16" />
                <span>上传文件夹</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="dragOver" class="cd-drop-overlay">
          <IconUpload :size="40" />
          <span>松开以上传到此目录</span>
        </div>
      </div>

      <div v-if="selectedCount" class="cd-selection-bar">
        <span class="text-secondary">已选 {{ selectedCount }} 项</span>
        <button v-if="permCanRead" type="button" class="btn btn-sm" @click="onDownload">下载</button>
        <button v-if="permCanRename" type="button" class="btn btn-sm" :disabled="selectedCount !== 1" @click="openRename(selectedItems[0])">重命名</button>
        <button v-if="permCanDelete" type="button" class="btn btn-sm btn-outline-danger" @click="doDelete()">删除</button>
      </div>

      <div class="cd-status-bar">
        共 {{ filteredFiles.length }} 项
        <template v-if="aiEnabled"> · AI 问答已开启（{{ aiStatus?.doc_count ?? 0 }} 份索引）</template>
        · 右键菜单 · 拖拽上传 · Ctrl+A 全选
      </div>
    </div>

    <DirectoryAIPanel
      :storage-id="currentStorageId"
      :path="currentPath"
      :status="aiStatus"
    />
    </div>

    <input ref="fileInput" type="file" multiple hidden @change="onFilesPicked" />
    <input ref="dirInput" type="file" webkitdirectory multiple hidden @change="onDirPicked" />

    <!-- 新建文件夹 -->
    <CdModal :show="showMkdir" title="新建文件夹" size="sm" @close="showMkdir = false">
      <form @submit.prevent="doMkdir">
        <div class="modal-body">
          <label class="form-label">文件夹名称</label>
          <input v-model="mkdirName" class="form-control" autofocus required />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showMkdir = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">创建</button>
        </div>
      </form>
    </CdModal>

    <!-- 重命名 -->
    <CdModal :show="showRename" title="重命名" size="sm" @close="showRename = false">
      <form @submit.prevent="doRename">
        <div class="modal-body">
          <label class="form-label">新名称</label>
          <input v-model="renameName" class="form-control" autofocus required />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showRename = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">确定</button>
        </div>
      </form>
    </CdModal>

    <!-- 分享 -->
    <ShareModal
      :show="showShare"
      :item="shareTarget"
      :storage-id="currentStorageId"
      :uses-cloud-share="usesCloudShare"
      :can-baidu-share="canBaiduShare"
      @close="showShare = false"
    />

    <PathAclModal
      v-if="auth.isAdmin"
      :show="showPathAcl"
      :item="aclTarget"
      :storage-id="currentStorageId"
      @close="showPathAcl = false"
    />

    <!-- 移动 / 复制 -->
    <CdModal :show="showPathAction" :title="pathActionMode === 'move' ? '移动到' : '复制到'" size="md" @close="showPathAction = false">
      <form @submit.prevent="submitPathAction">
        <div class="modal-body">
          <p class="text-secondary small mb-3">已选 {{ selectedCount }} 项，请选择目标文件夹</p>
          <DestDirPicker
            v-if="showPathAction"
            v-model="destDir"
            :storage-id="currentStorageId"
            :root-path="accessRoot"
            :blocked-paths="pathActionBlocked"
          />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showPathAction = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary" :disabled="pathActionBlocked.includes(destDir)">
            {{ pathActionMode === 'move' ? '移动' : '复制' }}到此处
          </button>
        </div>
      </form>
    </CdModal>

    <!-- 预览 -->
    <CdModal :show="showPreview" :title="previewTarget?.name || '预览'" size="lg" @close="showPreview = false">
      <div class="modal-body cd-preview-body">
        <img v-if="previewIsImage" :src="previewUrl" :alt="previewTarget?.name" class="cd-preview-img" />
        <iframe v-else-if="previewIsPdf" :src="previewUrl" class="cd-preview-frame" title="preview" />
        <video v-else-if="previewIsVideo" :src="previewUrl" class="cd-preview-frame" controls />
        <audio v-else-if="previewIsAudio" :src="previewUrl" class="w-100" controls />
        <iframe v-else-if="previewIsText" :src="previewUrl" class="cd-preview-frame" title="preview" />
        <div v-else class="text-center text-secondary py-4">
          <p>此文件类型暂不支持在线预览</p>
          <button
            v-if="previewTarget && filesApi.isOfficeEditable(previewTarget.name)"
            type="button"
            class="btn btn-sm btn-primary me-2"
            @click="openOfficeEditor(previewTarget)"
          >
            在线编辑
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click="onDownload(previewTarget ? [previewTarget] : [])">下载</button>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-sm" @click="showPreview = false">关闭</button>
      </div>
    </CdModal>

    <CdModal :show="showOfficeEditor" :title="officeTarget?.name || '在线编辑'" size="lg" @close="closeOfficeEditor">
      <div class="modal-body p-0 cd-onlyoffice-wrap">
        <div v-if="officeLoading" class="text-center text-secondary py-5">加载编辑器…</div>
        <div id="cd-onlyoffice-editor" ref="officeEditorHost" class="cd-onlyoffice-editor" />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-sm" @click="closeOfficeEditor">关闭</button>
      </div>
    </CdModal>

    <FileContextMenu
      :show="ctxMenu.show"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="contextMenuItems"
      @select="onContextMenuSelect"
      @close="closeContextMenu"
    />

    <UploadPanel />

    <PickupCodePanel v-if="pickupEnabled" />

    <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
  </div>
</template>
