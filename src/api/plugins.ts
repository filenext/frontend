import { request } from '@/api/client'
import type { PageResult } from '@/api/pagination'

export interface PluginRow {
  id: string
  plugin_id: string
  name: string
  type: string
  base_url?: string
  webhook_url?: string
  hooks?: string[]
  enabled: boolean
}

export async function listPlugins(params?: { page?: number; page_size?: number }) {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.page_size) q.set('page_size', String(params.page_size))
  const data = await request<PageResult<PluginRow>>(`/api/plugins?${q}`)
  return data
}

export async function registerPlugin(payload: {
  plugin_id: string
  name: string
  type?: string
  base_url?: string
  webhook_url?: string
  hooks?: string[]
  enabled?: boolean
}) {
  return request<PluginRow>('/api/plugins', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePlugin(
  id: string,
  payload: {
    name?: string
    type?: string
    base_url?: string
    webhook_url?: string
    hooks?: string[]
    enabled?: boolean
  },
) {
  return request<PluginRow>(`/api/plugins/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deletePlugin(id: string) {
  return request<null>(`/api/plugins/${id}`, { method: 'DELETE' })
}
