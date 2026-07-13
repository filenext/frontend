export interface BrandingSettings {
  site_name: string
  tagline: string
  primary_color: string
  logo_url: string
  favicon_url: string
  logo_text: string
  login_description?: string
  footer_powered_by_name?: string
  footer_icp?: string
  share_ad_image_url?: string
  share_ad_url?: string
  pickup_enabled?: string
}

/** 登录页页脚固定项，不可后台配置 */
export const LOGIN_FOOTER_POWERED_BY_URL = 'https://github.com/filenext/nextfile'
export const LOGIN_FOOTER_WECHAT = 'amwahaha'

export function isPickupEnabled(settings: PickupEnabledSource): boolean {
  const v = settings.pickup_enabled
  if (v === false || v === 'false' || v === '0' || v === '') return false
  if (v === true || v === 'true' || v === '1') return true
  return true
}

type PickupEnabledSource = { pickup_enabled?: string | boolean }

export const DEFAULT_BRANDING: BrandingSettings = {
  site_name: 'NextFile',
  tagline: '统一文件管理 · 智能体',
  primary_color: '#2563eb',
  logo_url: '',
  favicon_url: '',
  logo_text: '',
  login_description: '安全、简洁的多存储源文件管理，内置 AI 对话与智能体扩展。支持本地存储，可扩展 S3 / FTP / SFTP。',
  footer_powered_by_name: 'NextFile',
  footer_icp: '',
  share_ad_image_url: '',
  share_ad_url: '',
  pickup_enabled: 'true',
}

export const COLOR_PRESETS = [
  { name: '天蓝', value: '#2563eb' },
  { name: '靛青', value: '#4f46e5' },
  { name: '紫罗兰', value: '#7c3aed' },
  { name: '樱粉', value: '#db2777' },
  { name: '玫红', value: '#e11d48' },
  { name: '珊瑚', value: '#f97316' },
  { name: '琥珀', value: '#d97706' },
  { name: '青绿', value: '#0d9488' },
  { name: '翡翠', value: '#10b981' },
  { name: '湖蓝', value: '#0891b2' },
  { name: '藏青', value: '#1e3a8a' },
  { name: '石墨', value: '#475569' },
]
