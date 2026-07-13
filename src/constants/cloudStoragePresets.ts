import type { CloudStorageApp, CloudStorageSettings } from '@/api/settings'

export type CloudPlatform = 'microsoft' | 'google' | 'baidu'

export const CLOUD_STORAGE_APP_PRESETS: Record<CloudPlatform, CloudStorageApp> = {
  microsoft: {
    platform: 'microsoft',
    name: 'Microsoft OneDrive',
    client_id: '',
    client_secret: '',
    auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: 'offline_access Files.ReadWrite.All User.Read',
    enabled: false,
  },
  google: {
    platform: 'google',
    name: 'Google Drive',
    client_id: '',
    client_secret: '',
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/drive offline_access',
    enabled: false,
  },
  baidu: {
    platform: 'baidu',
    name: '百度网盘',
    client_id: '',
    client_secret: '',
    auth_url: 'https://openapi.baidu.com/oauth/2.0/authorize',
    token_url: 'https://openapi.baidu.com/oauth/2.0/token',
    scopes: 'basic,netdisk',
    enabled: false,
  },
}

export const CLOUD_PLATFORM_TABS: { id: CloudPlatform; label: string }[] = [
  { id: 'baidu', label: '百度网盘' },
  { id: 'microsoft', label: 'OneDrive' },
  { id: 'google', label: 'Google Drive' },
]

export const BAIDU_OPEN_CONSOLE_URL = 'https://pan.baidu.com/union/console/applist'

/** Azure 应用注册（OneDrive / Microsoft Graph） */
export const MICROSOFT_OPEN_CONSOLE_URL =
  'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'

/** Google Cloud Console：启用 Drive API 并创建 OAuth 客户端 */
export const GOOGLE_OPEN_CONSOLE_URL =
  'https://console.cloud.google.com/apis/library/drive.googleapis.com'

export const CLOUD_OPEN_CONSOLE_URLS: Record<CloudPlatform, string> = {
  baidu: BAIDU_OPEN_CONSOLE_URL,
  microsoft: MICROSOFT_OPEN_CONSOLE_URL,
  google: GOOGLE_OPEN_CONSOLE_URL,
}

export const CLOUD_DRIVER_OPTIONS = [
  { value: 'baidu_pan', label: '百度网盘', platform: 'baidu' as CloudPlatform },
  { value: 'onedrive', label: 'OneDrive', platform: 'microsoft' as CloudPlatform },
  { value: 'google_drive', label: 'Google Drive', platform: 'google' as CloudPlatform },
]

export function mergeCloudStorageApps(apps: CloudStorageApp[]): CloudStorageApp[] {
  const existing = new Set(apps.map((a) => a.platform))
  const missing = Object.values(CLOUD_STORAGE_APP_PRESETS).filter((a) => !existing.has(a.platform))
  const merged = missing.length ? [...apps, ...missing.map((a) => ({ ...a }))] : [...apps]
  return merged.map((a) =>
    a.platform === 'baidu' ? { ...a, scopes: sanitizeBaiduCloudScopes(a.scopes) } : a,
  )
}

/** 百度个人开发者通常无法申请 share，授权时仅保留 basic/netdisk。 */
export function sanitizeBaiduCloudScopes(raw?: string) {
  const parts = String(raw || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== 'share')
  return parts.length ? parts.join(',') : 'basic,netdisk'
}

export function defaultCloudStorageSettings(): CloudStorageSettings {
  return {
    enabled: false,
    apps: Object.values(CLOUD_STORAGE_APP_PRESETS).map((a) => ({ ...a })),
  }
}

/** 对外可访问的站点根 URL（与 OAuth redirect_uri 一致） */
export function publicSiteOrigin() {
  if (typeof window !== 'undefined') return window.location.origin
  return 'https://your-domain'
}

export function cloudOAuthCallbackUrl(platform: string) {
  return `${publicSiteOrigin()}/api/storages/cloud-oauth/${encodeURIComponent(platform)}/callback`
}

export function isCloudStorageDriver(driver: string) {
  return CLOUD_DRIVER_OPTIONS.some((d) => d.value === driver)
}

export function platformForCloudDriver(driver: string): CloudPlatform | undefined {
  return CLOUD_DRIVER_OPTIONS.find((d) => d.value === driver)?.platform
}
