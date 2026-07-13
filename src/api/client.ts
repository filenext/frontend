export interface ApiEnvelope<T = unknown> {
  success: number
  msg: string
  code?: number
  data: T
}

export class ApiError extends Error {
  code: number
  constructor(msg: string, code = 400) {
    super(msg)
    this.code = code
  }
}

const TOKEN_KEY = 'cd_token'

/** 无需登录的 API，401 时不跳转登录页 */
function isPublicApiPath(path: string) {
  return (
    path.includes('/api/public/') ||
    path.includes('/api/site/branding') ||
    path.includes('/api/auth/config') ||
    path.includes('/api/auth/captcha') ||
    path.includes('/api/auth/login') ||
    path.includes('/api/auth/totp') ||
    path.includes('/api/auth/register') ||
    path.includes('/api/auth/forgot-password') ||
    path.includes('/api/auth/reset-password') ||
    path.includes('/api/auth/oauth/') ||
    path.includes('/api/health')
  )
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return rawRequest<T>(path, options, true)
}

/** 公开接口：未登录或 token 失效时不跳转登录页 */
export async function publicRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return rawRequest<T>(path, options, false)
}

async function rawRequest<T>(
  path: string,
  options: RequestInit,
  redirectOn401: boolean,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token && redirectOn401) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(path, { ...options, headers })
  } catch {
    throw new ApiError('无法连接服务器，请稍后重试', 503)
  }

  const text = await res.text()
  let json: ApiEnvelope<T> | null = null
  if (text) {
    try {
      json = JSON.parse(text) as ApiEnvelope<T>
    } catch {
      const msg =
        res.status >= 500
          ? '服务器异常，请稍后重试'
          : res.status === 404
            ? '接口不存在'
            : '请求失败'
      throw new ApiError(msg, res.status)
    }
  }

  if (res.status >= 500) {
    throw new ApiError(json?.msg || '服务器异常，请稍后重试', res.status)
  }

  if (res.status === 401 || json?.code === 401) {
    clearToken()
    if (redirectOn401 && !isPublicApiPath(path)) {
      window.location.href = '/login'
    }
    throw new ApiError(json?.msg || '未登录', 401)
  }
  if (!json || json.success !== 1) {
    throw new ApiError(json?.msg || '请求失败', json?.code || res.status || 400)
  }
  return json.data
}

export function fmtDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtSize(bytes: number) {
  if (bytes <= 0) return '—'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`
}
