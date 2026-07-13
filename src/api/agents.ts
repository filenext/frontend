import { getToken } from '@/api/client'
import { request } from '@/api/client'
import type { PageResult } from '@/api/pagination'
import type {
  AgentPayload,
  AgentDocument,
  AgentRow,
  ChatMessage,
  ChatRequest,
  ChatStreamEvent,
  ContextFileRef,
} from '@/types/agents'

export async function listAgents(params?: { page?: number; page_size?: number; all?: boolean }) {
  const q = new URLSearchParams()
  if (params?.all) q.set('all', '1')
  if (params?.page) q.set('page', String(params.page))
  if (params?.page_size) q.set('page_size', String(params.page_size))
  const data = await request<PageResult<AgentRow>>(`/api/agents?${q}`)
  return data
}

export async function listAllAgents() {
  const data = await listAgents({ all: true })
  return data.items
}

export async function getAgent(id: string) {
  return request<AgentRow>(`/api/agents/${id}`)
}

export async function createAgent(payload: AgentPayload) {
  return request<AgentRow>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAgent(id: string, payload: Partial<AgentPayload>) {
  return request<AgentRow>(`/api/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteAgent(id: string) {
  return request<null>(`/api/agents/${id}`, { method: 'DELETE' })
}

export async function testAgent(id: string) {
  return request<{ ok: boolean }>(`/api/agents/${id}/test`, { method: 'POST' })
}

export async function chatAgent(id: string, body: ChatRequest) {
  return request<{ content: string; model: string; role: string; files_used?: string[] }>(
    `/api/agents/${id}/chat`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

export async function uploadAgentFile(agentId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<AgentDocument>(`/api/agents/${agentId}/files`, {
    method: 'POST',
    body: form,
  })
}

export async function chatAgentStream(
  id: string,
  body: ChatRequest,
  onEvent: (evt: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api/agents/${id}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  })

  if (res.status === 401) {
    throw new Error('未登录')
  }
  if (!res.ok && !res.headers.get('content-type')?.includes('text/event-stream')) {
    const json = await res.json().catch(() => null)
    throw new Error(json?.msg || `请求失败 (${res.status})`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取流式响应')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      for (const line of part.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload) continue
        try {
          onEvent(JSON.parse(payload) as ChatStreamEvent)
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  }
}

export function findAgentBySlug(agents: AgentRow[], slug: string) {
  return agents.find((a) => a.slug === slug)
}

export type { ContextFileRef }
