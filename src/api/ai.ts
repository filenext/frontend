import { request } from '@/api/client'

export interface AIDirectoryStatus {
  enabled: boolean
  configured?: boolean
  can_use?: boolean
  storage_id: string
  path: string
  ai_path?: string
  agent_id?: string
  doc_count?: number
  inherit?: boolean
}

export interface AIDirectoryConfig {
  id: string
  storage_id: string
  path: string
  agent_id: string
  enabled: boolean
  inherit: boolean
}

export interface DocTextMatch {
  filename: string
  path: string
  snippet: string
  score: number
}

export async function getAIDirectoryStatus(storageId: string, path: string) {
  const q = new URLSearchParams({ storage_id: storageId, path })
  return request<AIDirectoryStatus>(`/api/ai/directories/status?${q}`)
}

export async function listAIDirectoryConfigs() {
  return request<AIDirectoryConfig[]>('/api/ai/directories')
}

export async function putAIDirectoryConfig(payload: {
  storage_id: string
  path: string
  agent_id: string
  enabled?: boolean
  inherit?: boolean
}) {
  return request<AIDirectoryConfig>('/api/ai/directories', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listDirectoryDocuments(storageId: string, path: string) {
  const q = new URLSearchParams({ storage_id: storageId, path })
  return request<Array<{ id: string; filename: string; status: string; char_count: number }>>(
    `/api/ai/directories/documents?${q}`,
  )
}
