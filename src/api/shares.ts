import { publicRequest, request } from '@/api/client'

export interface ShareCreateResult {
  token: string
  url: string
  password?: string
  is_public?: boolean
  need_password?: boolean
  expires_at?: string
}

export interface PickupCreateResult {
  code: string
  share_token?: string
  expires_at: string
  expires_in: number
  pickup_url: string
}

export interface PickupActiveResult {
  active: boolean
  code?: string
  share_token?: string
  expires_at?: string
  expires_in?: number
  pickup_url?: string
}

export interface PublicShareChild {
  name: string
  rel_path: string
  size: number
  is_dir: boolean
  modified: string
  mime_type?: string
}

export interface PublicShareInfo {
  token: string
  name: string
  path: string
  rel_path?: string
  share_name?: string
  size: number
  is_dir: boolean
  modified: string
  mime_type?: string
  storage_name: string
  need_password?: boolean
  expires_at?: string
  sharer_name?: string
  sharer_avatar_url?: string
  children?: PublicShareChild[]
}

export interface PublicPickupInfo {
  code: string
  share_token?: string
  name: string
  path: string
  size: number
  is_dir: boolean
  modified: string
  mime_type?: string
  storage_name: string
  expires_at: string
}

/** 分享密码允许输入的字符（含 0/1） */
export const SHARE_PASSWORD_CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/** 自动生成分享密码时使用的字符（排除易混的 0/1/I/O/L） */
export const SHARE_PASSWORD_RANDOM_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export const SHARE_EXPIRY_OPTIONS = [
  { label: '1 天', shortLabel: '1', days: 1 },
  { label: '7 天', shortLabel: '7', days: 7 },
  { label: '30 天', shortLabel: '30', days: 30 },
  { label: '90 天', shortLabel: '90', days: 90 },
  { label: '365 天', shortLabel: '365', days: 365 },
  { label: '永久', shortLabel: '永久', days: 0 },
] as const

export const PICKUP_EXPIRY_OPTIONS = [
  { label: '5 分钟', shortLabel: '5分', minutes: 5 },
  { label: '15 分钟', shortLabel: '15分', minutes: 15 },
  { label: '30 分钟', shortLabel: '30分', minutes: 30 },
  { label: '1 小时', shortLabel: '1时', minutes: 60 },
  { label: '24 小时', shortLabel: '24时', minutes: 1440 },
] as const

export async function createShare(payload: {
  storage_id: string
  path: string
  password?: string
  is_public?: boolean
  expires_hours?: number
  expires_days?: number
  max_downloads?: number
}) {
  return request<ShareCreateResult>('/api/shares', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createPickup(payload: {
  storage_id: string
  path: string
  expires_minutes?: number
}) {
  return request<PickupCreateResult>('/api/shares/pickup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getActivePickup(payload: { storage_id: string; path: string }) {
  const q = new URLSearchParams({
    storage_id: payload.storage_id,
    path: payload.path,
  })
  return request<PickupActiveResult>(`/api/shares/pickup/active?${q}`)
}

export async function getPublicShare(token: string, password?: string, relPath?: string) {
  const params = new URLSearchParams()
  const pwd = password ? normalizeSharePassword(password) : ''
  if (pwd) params.set('pwd', pwd)
  if (relPath) params.set('path', relPath)
  const q = params.toString()
  return publicRequest<PublicShareInfo>(`/api/public/shares/${token}${q ? `?${q}` : ''}`)
}

export async function getPublicPickup(code: string) {
  return publicRequest<PublicPickupInfo>(`/api/public/pickup/${encodeURIComponent(code.toUpperCase())}`)
}

/** 校验取件码并返回对应分享 token */
export async function resolvePickupShareToken(code: string) {
  const normalized = code.trim().toUpperCase()
  const info = await getPublicPickup(normalized)
  if (!info.share_token) throw new Error('取件码暂不可用，请联系分享者重新生成')
  return info.share_token
}

export function pickupSharePagePath(shareToken: string) {
  return `/s/${shareToken}?`
}

function shareQuery(password?: string, relPath?: string) {
  const params = new URLSearchParams()
  const pwd = password ? normalizeSharePassword(password) : ''
  if (pwd) params.set('pwd', pwd)
  if (relPath) params.set('path', relPath)
  const q = params.toString()
  return q ? `?${q}` : ''
}

export function publicDownloadUrl(token: string, password?: string, relPath?: string) {
  return `/api/public/shares/${token}/download${shareQuery(password, relPath)}`
}

export function publicPackUrl(token: string, password?: string, relPath?: string) {
  return `/api/public/shares/${token}/pack${shareQuery(password, relPath)}`
}

async function downloadFromUrl(url: string, filename?: string) {
  const res = await fetch(url)
  if (!res.ok) {
    let msg = '下载失败'
    try {
      const json = (await res.json()) as { msg?: string }
      if (json.msg) msg = json.msg
    } catch {
      /* 非 JSON 响应 */
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename || 'download'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

/** 触发分享文件下载（兼容异步回调，避免 window.open 被拦截） */
export async function downloadPublicShare(
  token: string,
  password?: string,
  filename?: string,
  relPath?: string,
) {
  await downloadFromUrl(publicDownloadUrl(token, password, relPath), filename)
}

/** 打包下载分享目录 */
export async function packPublicShare(
  token: string,
  password?: string,
  filename?: string,
  relPath?: string,
) {
  await downloadFromUrl(publicPackUrl(token, password, relPath), filename || 'download.zip')
}

export function publicPickupDownloadUrl(code: string) {
  return `/api/public/pickup/${encodeURIComponent(code.toUpperCase())}/download`
}

export function publicSharePageUrl(token: string, password?: string, isPublic = false) {
  const base = `${window.location.origin}/s/${token}`
  const pwd = password ? normalizeSharePassword(password) : ''
  if (pwd) return `${base}?pwd=${encodeURIComponent(pwd)}`
  if (isPublic) return `${base}?`
  return base
}

export function normalizeSharePassword(raw: string): string {
  let s = raw
  try {
    s = decodeURIComponent(raw)
  } catch {
    s = raw
  }
  s = s.trim().toUpperCase()
  const stop = s.search(/[\s\u4e00-\u9fff]/)
  if (stop >= 0) s = s.slice(0, stop)
  const chars = SHARE_PASSWORD_CHARS
  let out = ''
  for (const ch of s) {
    if (chars.includes(ch)) {
      out += ch
      if (out.length >= 4) break
    }
  }
  return out
}

export function parseSharePasswordFromQuery(
  query: Record<string, string | string[] | undefined | null>,
): string {
  const raw = query.pwd ?? query.password
  if (typeof raw === 'string') return normalizeSharePassword(raw)
  if (Array.isArray(raw) && raw[0]) return normalizeSharePassword(raw[0])
  return ''
}

export function publicPickupPageUrl(code?: string) {
  const base = `${window.location.origin}/pickup`
  return code ? `${base}?code=${encodeURIComponent(code.toUpperCase())}` : base
}

/** 从粘贴内容中提取取件码（兼容纯码、URL、分享文案） */
export function extractPickupCode(raw: string): string {
  const text = raw.trim().toUpperCase()
  if (!text) return ''
  try {
    const url = new URL(text)
    const fromQuery = url.searchParams.get('code')
    if (fromQuery) return fromQuery.toUpperCase().replace(/[^0-9A-Z]/g, '')
  } catch {
    /* 非完整 URL */
  }
  const queryMatch = text.match(/[?&]CODE=([0-9A-Z]+)/)
  if (queryMatch) return queryMatch[1].replace(/[^0-9A-Z]/g, '')
  const plain = text.replace(/[^0-9A-Z]/g, '')
  if (plain.length <= 8) return plain
  const tokens = text.match(/[0-9A-Z]{5}/g)
  if (tokens?.length) return tokens[tokens.length - 1]
  return plain
}

export function buildShareCopyText(opts: {
  token?: string
  link?: string
  password?: string
  isPublic?: boolean
  fileName: string
  siteName?: string
  tagline?: string
}) {
  const site = opts.siteName?.trim() || 'NextFile'
  const footer = opts.tagline?.trim() || `${site} AI + 智能体 · 企业级文件安全`
  const link =
    opts.link ||
    (opts.token ? publicSharePageUrl(opts.token, opts.password, opts.isPublic) : '')

  const lines: string[] = []
  if (link) lines.push(link)
  if (opts.password) {
    lines.push(`分享密码: ${normalizeSharePassword(opts.password)}`)
  }
  lines.push(`通过网盘分享的文件：${opts.fileName}`)
  lines.push(`复制这段内容后打开 ${site} App，操作更方便哦`)
  lines.push(`--${footer}`)
  return lines.join('\n')
}

export function randomAccessCode(len = 4) {
  const chars = SHARE_PASSWORD_RANDOM_CHARS
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}
