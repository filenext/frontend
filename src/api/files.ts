import { getToken, request, ApiError } from '@/api/client'
import type { UploadEntry } from '@/utils/folderUpload'
import type { FileEntry } from '@/types/files'
import { joinPath, parentPath } from '@/utils/paths'

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

export function uploadFileWithProgress(
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

export async function onlyOfficeConfig(storageId: string, path: string) {
  return request<{ server_url: string; config: Record<string, unknown> }>(
    `/api/files/onlyoffice/config?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path)}`,
  )
}

export async function onlyOfficeRevisions(storageId: string, path: string) {
  return request<{ items: { id: number; version: number; size: number; created_at: string }[] }>(
    `/api/files/onlyoffice/revisions?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path)}`,
  )
}

export { joinPath, parentPath }
