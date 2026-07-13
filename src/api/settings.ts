import { request } from './client'

export interface GeneralSettings {
  page_size: number
}

export interface OAuthProvider {
  id: string
  name: string
  type: string
  client_id: string
  client_secret: string
  auth_url?: string
  token_url?: string
  user_info_url?: string
  scopes?: string
  icon_url?: string
  enabled: boolean
}

export interface OAuthSettings {
  enabled: boolean
  providers: OAuthProvider[]
}

export interface CaptchaConfig {
  type: string
  length: number
  noise_level: string
  width: number
  height: number
  expiry_seconds: number
  case_sensitive: boolean
  obfuscate_image: boolean
}

export interface SecuritySettings {
  captcha_enabled: boolean
  captcha: CaptchaConfig
  login_fail_window_sec: number
  login_fail_max: number
  login_ban_sec: number
  password_min_len: number
  password_require_upper: boolean
  password_require_lower: boolean
  password_require_digit: boolean
  password_require_special: boolean
  admin_2fa_enabled: boolean
}

export interface AccessSettings {
  ip_blacklist: string[]
  ua_blacklist: string[]
}

export interface EmailTemplates {
  reset_password: string
  register: string
  test: string
}

export interface EmailSettings {
  enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_pass: string
  from: string
  use_tls: boolean
  templates: EmailTemplates
}

export interface LDAPSettings {
  enabled: boolean
  host: string
  port: number
  use_tls: boolean
  bind_dn: string
  bind_pass: string
  base_dn: string
  user_filter: string
  username_attr: string
  email_attr: string
}

export interface OnlyOfficeSettings {
  enabled: boolean
  server_url: string
  jwt_secret: string
  version_keep: number
  /** Document Server 访问本系统的根地址，如 http://192.168.x.x:8080 */
  callback_base_url?: string
}

export interface CloudStorageApp {
  platform: string
  name: string
  client_id: string
  client_secret: string
  auth_url?: string
  token_url?: string
  scopes?: string
  enabled: boolean
}

export interface CloudStorageSettings {
  enabled: boolean
  apps: CloudStorageApp[]
}

export type SettingsSection =
  | 'general'
  | 'oauth'
  | 'cloud_storage'
  | 'security'
  | 'access'
  | 'email'
  | 'ldap'
  | 'onlyoffice'

export function getSettings<T>(section: SettingsSection) {
  return request<T>(`/api/admin/settings/${section}`)
}

export function saveSettings<T>(section: SettingsSection, data: T) {
  return request<T>(`/api/admin/settings/${section}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function testEmail(to: string) {
  return request<null>('/api/admin/settings/email/test', {
    method: 'POST',
    body: JSON.stringify({ to }),
  })
}

export function testLDAP() {
  return request<null>('/api/admin/settings/ldap/test', { method: 'POST' })
}

export function captchaPreview(cfg: CaptchaConfig) {
  return request<{ image_base64: string }>('/api/admin/settings/security/captcha/preview', {
    method: 'POST',
    body: JSON.stringify(cfg),
  })
}

export function totpStatus() {
  return request<{ enabled: boolean; admin_2fa_required: boolean }>(
    '/api/admin/settings/security/totp/status',
  )
}

export function totpSetup() {
  return request<{ secret: string; otp_url: string; qr_url: string }>(
    '/api/admin/settings/security/totp/setup',
    { method: 'POST' },
  )
}

export function totpConfirm(code: string) {
  return request<null>('/api/admin/settings/security/totp/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function totpDisable(code: string) {
  return request<null>('/api/admin/settings/security/totp/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function fetchPageSize(): Promise<number> {
  try {
    const data = await request<{ page_size: number }>('/api/admin/settings/general')
    const n = data.page_size
    if (n >= 1 && n <= 200) return n
  } catch {
    /* fallback */
  }
  try {
    const res = await request<{ value: string }>(
      '/api/sys-configs/value?category=system&code=page_size',
    )
    const n = parseInt(res.value, 10)
    if (n >= 1 && n <= 200) return n
  } catch {
    /* ignore */
  }
  return 20
}
