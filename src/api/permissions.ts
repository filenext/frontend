import { request } from '@/api/client'
import type { PageResult } from '@/api/pagination'

export interface MountRow {
  id: string
  storage_id: string
  principal_type: string
  principal_id: string
  root_path: string
  perm_mask: number
  perm_names?: string[]
}

export interface AclRow {
  id: string
  storage_id: string
  path: string
  is_dir: boolean
  principal_type: string
  principal_id: string
  principal_name?: string
  perm_allow: number
  perm_deny: number
  inherit: boolean
  perm_allow_names?: string[]
  perm_deny_names?: string[]
}

export interface PermPreset {
  id: string
  label: string
  description: string
  perm_allow: number
}

export async function listMounts(params?: {
  principal_type?: string
  principal_id?: string
  storage_id?: string
  page?: number
  page_size?: number
  all?: boolean
}) {
  const q = new URLSearchParams()
  if (params?.principal_type) q.set('principal_type', params.principal_type)
  if (params?.principal_id) q.set('principal_id', params.principal_id)
  if (params?.storage_id) q.set('storage_id', params.storage_id)
  if (params?.all) q.set('all', '1')
  if (params?.page) q.set('page', String(params.page))
  if (params?.page_size) q.set('page_size', String(params.page_size))
  const data = await request<PageResult<MountRow>>(`/api/permissions/mounts?${q}`)
  return data
}

export async function putMount(payload: {
  storage_id: string
  principal_type: string
  principal_id: number
  root_path?: string
  perm_mask?: number
}) {
  return request<{ id: string }>('/api/permissions/mounts', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteMount(id: string) {
  return request<null>(`/api/permissions/mounts/${id}`, { method: 'DELETE' })
}

export async function effectivePerm(storageId: string, path: string) {
  return request<{ perm_mask: number; perm_names: string[] }>(
    `/api/permissions/effective?storage_id=${encodeURIComponent(storageId)}&path=${encodeURIComponent(path)}`,
  )
}

export async function listPresets() {
  return request<PermPreset[]>('/api/permissions/presets')
}

export async function listAcl(params: {
  storage_id?: string
  path?: string
  page?: number
  page_size?: number
}) {
  const q = new URLSearchParams()
  if (params.storage_id) q.set('storage_id', params.storage_id)
  if (params.path) q.set('path', params.path)
  if (params.page) q.set('page', String(params.page))
  if (params.page_size) q.set('page_size', String(params.page_size))
  return request<PageResult<AclRow>>(`/api/permissions/acl?${q}`)
}

export async function putAcl(payload: {
  storage_id: string
  path: string
  is_dir?: boolean
  principal_type: string
  principal_id: number
  perm_allow: number
  perm_deny?: number
  inherit?: boolean
}) {
  return request<{ id: string }>('/api/permissions/acl', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteAcl(id: string) {
  return request<null>(`/api/permissions/acl/${id}`, { method: 'DELETE' })
}
