import { request } from './client'

export interface SyncStats {
  uploaded: number
  skipped: number
  deleted: number
  failed: number
}

export interface StorageSyncRow {
  id: string
  name: string
  enabled: boolean
  source_storage_id: string
  dest_storage_id: string
  source_path: string
  dest_path: string
  mode: string
  schedule_interval_minutes: number
  running?: boolean
  remark?: string
  last_run_at?: string
  last_status?: string
  last_error?: string
  last_stats?: SyncStats
}

export interface StorageSyncPayload {
  name: string
  source_storage_id: string
  dest_storage_id: string
  source_path?: string
  dest_path?: string
  mode?: string
  schedule_interval_minutes?: number
  remark?: string
  enabled?: boolean
}

export async function listStorageSyncs() {
  return request<StorageSyncRow[]>('/api/admin/storage-syncs')
}

export async function createStorageSync(payload: StorageSyncPayload) {
  return request<StorageSyncRow>('/api/admin/storage-syncs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateStorageSync(id: string, payload: Partial<StorageSyncPayload>) {
  return request<StorageSyncRow>(`/api/admin/storage-syncs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteStorageSync(id: string) {
  return request<null>(`/api/admin/storage-syncs/${id}`, { method: 'DELETE' })
}

export async function runStorageSync(id: string) {
  return request<StorageSyncRow>(`/api/admin/storage-syncs/${id}/run`, { method: 'POST' })
}
