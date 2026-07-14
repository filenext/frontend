import { request } from './client'

export interface TokenScope {
  storage_id: number
  path: string
}

export interface AccessToken {
  id: number
  name: string
  token_prefix: string
  perm_mask: number
  perm_names: string[]
  scopes: TokenScope[]
  enabled: boolean
  expires_at?: string | null
  last_used_at?: string | null
  created_at?: string
  token?: string
}

export interface PermissionCeiling {
  max_mask: number
  perm_names: string[]
  presets: { id: string; label: string; description: string; perm_allow: number }[]
  mounts: { storage_id: number; name: string; root_path: string; perm_mask: number }[]
}

export function listTokens() {
  return request<{ items: AccessToken[] }>('/api/me/tokens')
}

export function permissionCeiling() {
  return request<PermissionCeiling>('/api/me/tokens/permission-ceiling')
}

export function createToken(body: {
  name: string
  perm_mask: number
  scopes?: TokenScope[]
  expires_at?: string | null
}) {
  return request<AccessToken>('/api/me/tokens', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchToken(
  id: number,
  body: {
    name?: string
    enabled?: boolean
    perm_mask?: number
    scopes?: TokenScope[]
    expires_at?: string | null
    clear_expires_at?: boolean
  },
) {
  return request<AccessToken>(`/api/me/tokens/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteToken(id: number) {
  return request<null>(`/api/me/tokens/${id}`, { method: 'DELETE' })
}

export function adminListTokens(uid: number) {
  return request<{ items: AccessToken[] }>(`/api/users/${uid}/tokens`)
}

export function adminCreateToken(
  uid: number,
  body: {
    name: string
    perm_mask: number
    scopes?: TokenScope[]
    expires_at?: string | null
  },
) {
  return request<AccessToken>(`/api/users/${uid}/tokens`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function adminDeleteToken(uid: number, id: number) {
  return request<null>(`/api/users/${uid}/tokens/${id}`, { method: 'DELETE' })
}
