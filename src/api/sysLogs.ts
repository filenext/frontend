import { request } from './client'
import type { PageResult } from './pagination'

export type { PageResult } from './pagination'

export interface SysLogRow {
  id: number
  created_at: string
  ip: string
  user_id: number | null
  username: string
  tag: string
  result: string
  action: string
  request_id: string
  remark: string
}

export type LogCategory = 'log' | 'login' | 'audit' | 'sync'

export function listSysLogs(params: {
  page?: number
  page_size?: number
  keyword?: string
  tag?: string
  category?: LogCategory
  result?: string
}) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.page_size) q.set('page_size', String(params.page_size))
  if (params.keyword) q.set('keyword', params.keyword)
  if (params.tag) q.set('tag', params.tag)
  if (params.category) q.set('category', params.category)
  if (params.result) q.set('result', params.result)
  return request<PageResult<SysLogRow>>(`/api/sys-logs?${q}`)
}
