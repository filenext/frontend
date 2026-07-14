import { getToken, request, ApiError } from '@/api/client'
import type { UploadEntry } from '@/utils/folderUpload'
import type { FileEntry } from '@/types/files'
import { joinPath, parentPath } from '@/utils/paths'
import {
  clearStoredUploadId,
  fileFingerprint,
  setStoredUploadId,
} from '@/utils/uploadSession'

export interface ListFilesResult {
  path: string
  items: {
    name: string
    path: string
    size: number
    is_dir: boolean
    modified: string
    mime_type?: string
  }[]
}

export interface FileInfoResult {
  name: string
  path: string
  size: number
  is_dir: boolean
  modified: string
  mime_type?: string
}

function toEntry(storageId: string, item: ListFilesResult['items'][0]): FileEntry {
  return {
    id: `${storageId}:${item.path}`,
    name: item.name,
    path: item.path,
    isDir: item.is_dir,
    size: item.size,
    modified: item.modified,
    mimeType: item.mime_type,
  }
}

export async function listFiles(storageId: string, path: string): Promise<FileEntry[]> {
  const data = await request<ListFilesResult>(
    `/api/files?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path || '/')}`,
  )
  return data.items.map((item) => toEntry(storageId, item))
}

export async function getFileInfo(storageId: string, path: string): Promise<FileEntry> {
  const item = await request<FileInfoResult>(
    `/api/files/info?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path)}`,
  )
  return toEntry(storageId, item)
}

export async function mkdir(storageId: string, parentPath: string, name: string) {
  await request('/api/files/mkdir', {
    method: 'POST',
    body: JSON.stringify({ storage_id: storageId, path: joinPath(parentPath, name) }),
  })
}

export async function uploadFiles(storageId: string, path: string, files: UploadEntry[]) {
  for (const entry of files) {
    await uploadFileWithProgress(storageId, path, entry)
  }
}

const CHUNK_THRESHOLD = 8 << 20 // 8 MiB
const DEFAULT_CHUNK_SIZE = 4 << 20
const CHUNK_CONCURRENCY = 3
const CHUNK_RETRIES = 2

function uploadSimpleWithProgress(
  storageId: string,
  path: string,
  entry: UploadEntry,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const fd = new FormData()
    fd.append('storage_id', storageId)
    fd.append('path', path || '/')
    fd.append('file', entry.file)
    if (entry.relativePath) {
      fd.append('relative_path', entry.relativePath)
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}') as {
          success?: number
          msg?: string
          code?: number
        }
        if (xhr.status >= 200 && xhr.status < 300 && json.success === 1) {
          resolve()
          return
        }
        reject(new ApiError(json.msg || '上传失败', json.code || xhr.status))
      } catch {
        reject(new ApiError('上传失败', xhr.status || 500))
      }
    })

    xhr.addEventListener('error', () => reject(new ApiError('网络错误', 0)))
    xhr.addEventListener('abort', () => reject(new ApiError('上传已取消', 0)))

    xhr.open('POST', '/api/files/upload')
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(fd)
  })
}

interface InitResult {
  upload_id: string
  chunk_size: number
  total_chunks: number
  uploaded: number[]
  file_size: number
  target_path: string
}

async function initChunkedUpload(
  storageId: string,
  path: string,
  entry: UploadEntry,
  fingerprint: string,
): Promise<InitResult> {
  return request<InitResult>('/api/files/upload/init', {
    method: 'POST',
    body: JSON.stringify({
      storage_id: storageId,
      path: path || '/',
      relative_path: entry.relativePath || '',
      file_name: entry.file.name,
      file_size: entry.file.size,
      chunk_size: DEFAULT_CHUNK_SIZE,
      fingerprint,
    }),
  })
}

function putChunk(
  uploadId: string,
  index: number,
  blob: Blob,
  onChunkProgress?: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onChunkProgress) onChunkProgress(e.loaded)
    })
    xhr.addEventListener('load', () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}') as {
          success?: number
          msg?: string
          code?: number
        }
        if (xhr.status >= 200 && xhr.status < 300 && json.success === 1) {
          resolve()
          return
        }
        reject(new ApiError(json.msg || '分片上传失败', json.code || xhr.status))
      } catch {
        reject(new ApiError('分片上传失败', xhr.status || 500))
      }
    })
    xhr.addEventListener('error', () => reject(new ApiError('网络错误', 0)))
    xhr.addEventListener('abort', () => reject(new ApiError('上传已取消', 0)))
    xhr.open('PUT', `/api/files/upload/${encodeURIComponent(uploadId)}/chunks/${index}`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.send(blob)
  })
}

async function putChunkWithRetry(
  uploadId: string,
  index: number,
  blob: Blob,
  onChunkProgress?: (loaded: number) => void,
) {
  let lastErr: unknown
  for (let i = 0; i <= CHUNK_RETRIES; i++) {
    try {
      await putChunk(uploadId, index, blob, onChunkProgress)
      return
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

async function uploadChunkedWithProgress(
  storageId: string,
  path: string,
  entry: UploadEntry,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const targetKey = entry.relativePath || entry.file.name
  const fingerprint = fileFingerprint(storageId, `${path || '/'}:${targetKey}`, entry.file)
  const init = await initChunkedUpload(storageId, path, entry, fingerprint)
  setStoredUploadId(fingerprint, init.upload_id)

  const uploadedSet = new Set(init.uploaded || [])
  const chunkSize = init.chunk_size
  const total = init.total_chunks
  const fileSize = entry.file.size
  const chunkProgress = new Map<number, number>()

  const report = () => {
    if (!onProgress) return
    let done = 0
    for (let i = 0; i < total; i++) {
      if (uploadedSet.has(i)) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, fileSize)
        done += end - start
      } else {
        done += chunkProgress.get(i) || 0
      }
    }
    onProgress(Math.min(99, Math.round((done / Math.max(fileSize, 1)) * 100)))
  }
  report()

  const pending: number[] = []
  for (let i = 0; i < total; i++) {
    if (!uploadedSet.has(i)) pending.push(i)
  }

  let cursor = 0
  async function worker() {
    while (cursor < pending.length) {
      const index = pending[cursor++]
      const start = index * chunkSize
      const end = Math.min(start + chunkSize, fileSize)
      const blob = entry.file.slice(start, end)
      await putChunkWithRetry(init.upload_id, index, blob, (loaded) => {
        chunkProgress.set(index, loaded)
        report()
      })
      uploadedSet.add(index)
      chunkProgress.delete(index)
      report()
    }
  }

  const workers = Array.from({ length: Math.min(CHUNK_CONCURRENCY, Math.max(pending.length, 1)) }, () =>
    worker(),
  )
  await Promise.all(workers)

  await request(`/api/files/upload/${encodeURIComponent(init.upload_id)}/complete`, {
    method: 'POST',
    body: '{}',
  })
  clearStoredUploadId(fingerprint)
  onProgress?.(100)
}

export async function uploadFileWithProgress(
  storageId: string,
  path: string,
  entry: UploadEntry,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (entry.file.size >= CHUNK_THRESHOLD) {
    await uploadChunkedWithProgress(storageId, path, entry, onProgress)
    return
  }
  await uploadSimpleWithProgress(storageId, path, entry, onProgress)
}

export async function deleteFiles(storageId: string, paths: string[]) {
  await request('/api/files', {
    method: 'DELETE',
    body: JSON.stringify({ storage_id: storageId, paths }),
  })
}

export async function renameFile(storageId: string, oldPath: string, newName: string) {
  await request('/api/files/rename', {
    method: 'POST',
    body: JSON.stringify({
      storage_id: storageId,
      old_path: oldPath,
      new_path: joinPath(parentPath(oldPath), newName),
    }),
  })
}

export function downloadUrl(storageId: string, path: string) {
  const token = getToken()
  const q = new URLSearchParams({
    storage_id: storageId,
    path,
  })
  if (token) q.set('token', token)
  return `/api/files/download?${q.toString()}`
}

export function absoluteDownloadUrl(storageId: string, path: string) {
  return `${window.location.origin}${downloadUrl(storageId, path)}`
}

export async function copyFiles(storageId: string, srcPaths: string[], destDir: string) {
  await request('/api/files/copy', {
    method: 'POST',
    body: JSON.stringify({ storage_id: storageId, src_paths: srcPaths, dest_dir: destDir }),
  })
}

export async function moveFiles(storageId: string, srcPaths: string[], destDir: string) {
  await request('/api/files/move', {
    method: 'POST',
    body: JSON.stringify({ storage_id: storageId, src_paths: srcPaths, dest_dir: destDir }),
  })
}

export function previewUrl(storageId: string, path: string) {
  const token = getToken()
  const q = new URLSearchParams({ storage_id: storageId, path })
  if (token) q.set('token', token)
  return `/api/files/preview?${q.toString()}`
}

export function absolutePreviewUrl(storageId: string, path: string) {
  return `${window.location.origin}${previewUrl(storageId, path)}`
}

/** 用 Authorization 拉取预览内容，避免 iframe 直链因代理/鉴权落到错误主机 */
export async function fetchPreviewBlob(storageId: string, path: string): Promise<Blob> {
  const token = getToken()
  const q = new URLSearchParams({ storage_id: storageId, path })
  const res = await fetch(`/api/files/preview?${q.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let msg = '预览失败'
    try {
      const json = await res.json()
      if (json?.msg) msg = json.msg
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status)
  }
  return res.blob()
}

export async function createDirectLink(storageId: string, path: string, expiresIn = 3600) {
  const data = await request<{ url: string; expires_at: string }>('/api/files/direct-link', {
    method: 'POST',
    body: JSON.stringify({ storage_id: storageId, path, expires_in: expiresIn }),
  })
  return {
    ...data,
    absolute_url: `${window.location.origin}${data.url}`,
  }
}

export async function packDownload(storageId: string, paths: string[]) {
  const token = getToken()
  const res = await fetch('/api/files/pack', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ storage_id: storageId, paths }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.msg || '打包下载失败')
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'download.zip'
  a.click()
  URL.revokeObjectURL(a.href)
}

export function shareUrl(_storageId: string, _path: string) {
  return ''
}

export interface CloudShareResult {
  link: string
  short_url?: string
  password?: string
  period_days: number
  provider: string
}

export function isCloudShareDriver(driver?: string) {
  return driver === 'baidu_pan'
}

export async function createCloudShare(
  storageId: string,
  path: string,
  opts?: { periodDays?: number; password?: string },
) {
  return request<CloudShareResult>('/api/files/cloud-share', {
    method: 'POST',
    body: JSON.stringify({
      storage_id: storageId,
      path,
      period_days: opts?.periodDays ?? 7,
      password: opts?.password ?? '',
    }),
  })
}

const OFFICE_EXT = /\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf|csv)$/i

export function isOfficeEditable(name: string) {
  return OFFICE_EXT.test(name.toLowerCase())
}

export async function onlyOfficeStatus() {
  return request<{ enabled: boolean }>('/api/files/onlyoffice/status')
}

export async function onlyOfficeConfig(storageId: string, path: string) {
  return request<{ server_url: string; config: Record<string, unknown> }>(
    `/api/files/onlyoffice/config?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path)}`,
  )
}

export interface FileRevisionItem {
  id: number
  storage_id: number
  path: string
  version: number
  size: number
  created_by: number
  created_at: string
}

export async function onlyOfficeRevisions(storageId: string, path: string) {
  return request<{ items: FileRevisionItem[] }>(
    `/api/files/onlyoffice/revisions?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path)}`,
  )
}

export function onlyOfficeRevisionDownloadUrl(storageId: string, path: string, version: number) {
  const token = getToken()
  const q = new URLSearchParams({
    storage_id: storageId,
    path,
    version: String(version),
  })
  if (token) q.set('token', token)
  return `/api/files/onlyoffice/revisions/download?${q.toString()}`
}

export async function onlyOfficeRestoreRevision(storageId: string, path: string, version: number) {
  return request<{ restored_version: number }>('/api/files/onlyoffice/revisions/restore', {
    method: 'POST',
    body: JSON.stringify({ storage_id: storageId, path, version }),
  })
}

export interface OfficeEditorPresence {
  user_id: number
  username: string
  real_name?: string
  color: string
  cursor?: string
  updated_at: string
}

export async function onlyOfficePresenceGet(storageId: string, path: string) {
  return request<{ editors: OfficeEditorPresence[] }>(
    `/api/files/onlyoffice/presence?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path)}`,
  )
}

export async function onlyOfficePresenceBatch(storageId: string, paths: string[]) {
  const q = new URLSearchParams({
    storage_id: storageId,
    path: '/',
    paths: paths.join(','),
  })
  return request<{ by_path: Record<string, OfficeEditorPresence[]> }>(
    `/api/files/onlyoffice/presence?${q.toString()}`,
  )
}

export async function onlyOfficePresenceTouch(
  storageId: string,
  path: string,
  action: 'join' | 'heartbeat' | 'leave',
  cursor?: string,
) {
  return request<{ editors: OfficeEditorPresence[] }>('/api/files/onlyoffice/presence', {
    method: 'POST',
    body: JSON.stringify({ storage_id: storageId, path, action, cursor: cursor || '' }),
  })
}

export { joinPath, parentPath }
