import { request } from './client'
import type { PageResult } from './pagination'
import type { StorageConfig, StorageRow } from '@/types/files'

export interface StoragePayload {
  name: string
  driver: string
  root_path?: string
  enabled?: boolean
  remark?: string
  config?: StorageConfig
}

export async function listStorages(params?: { page?: number; page_size?: number; all?: boolean }) {
  const q = new URLSearchParams()
  if (params?.all) q.set('all', '1')
  if (params?.page) q.set('page', String(params.page))
  if (params?.page_size) q.set('page_size', String(params.page_size))
  const data = await request<PageResult<StorageRow>>(`/api/storages?${q}`)
  return data
}

export async function createStorage(payload: StoragePayload) {
  return request<StorageRow>('/api/storages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateStorage(id: string, payload: Partial<StoragePayload>) {
  return request<StorageRow>(`/api/storages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteStorage(id: string) {
  return request<null>(`/api/storages/${id}`, { method: 'DELETE' })
}

export async function testStorage(id: string) {
  return request<{ ok: boolean }>(`/api/storages/${id}/test`, { method: 'POST' })
}

export async function testStorageConfig(driver: string, config: StorageConfig) {
  return request<{ ok: boolean }>('/api/storages/test', {
    method: 'POST',
    body: JSON.stringify({ driver, config }),
  })
}

export async function getCloudInfo(storageId: string) {
  return request<CloudAccountInfo>(`/api/storages/${encodeURIComponent(storageId)}/cloud-info`)
}

export interface CloudAccountInfo {
  provider: string
  account_name: string
  avatar_url?: string
  vip_type?: number
  total_bytes: number
  used_bytes: number
  free_bytes?: number
  oauth_scope?: string
  share_capable?: boolean
}

export interface CloudOAuthCallbackInfo {
  redirect_uri: string
  public_base_url?: string
  base_url_source?: 'public_base_url' | 'x_forwarded_host' | 'request_host'
  request_host?: string
  forwarded_host?: string
}

/** 获取后端实际使用的 OAuth 回调地址（与发起授权时 redirect_uri 一致） */
export async function getCloudOAuthCallbackUrl(platform: string) {
  return request<CloudOAuthCallbackInfo>(
    `/api/storages/cloud-oauth/callback-url?platform=${encodeURIComponent(platform)}`,
  )
}

/** 获取云盘 OAuth 授权页 URL（需已登录管理员），再 window.location 跳转 */
export async function getCloudOAuthUrl(storageId: string) {
  const data = await request<{ url: string; redirect_uri?: string }>(
    `/api/storages/${encodeURIComponent(storageId)}/cloud-oauth/url`,
  )
  return data
}
