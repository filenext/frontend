import { request } from './client'

export interface OverviewStats {
  active_users: number
  storages: number
  agents: number
  sync_tasks: number
}

export interface OverviewActivity {
  id: number
  title: string
  created_at: string
}

export interface OverviewChartPoint {
  label: string
  count: number
  height: number
}

export interface OverviewDiskStat {
  path: string
  total: number
  used: number
  free: number
  percent: number
}

export interface OverviewServer {
  hostname: string
  os: string
  platform: string
  arch: string
  uptime_sec: number
  cpu_cores: number
  cpu_percent: number
  mem_total: number
  mem_used: number
  mem_percent: number
  disks: OverviewDiskStat[]
}

export interface AdminOverview {
  stats: OverviewStats
  activity: OverviewActivity[]
  chart: OverviewChartPoint[]
  server?: OverviewServer
}

export function getAdminOverview() {
  return request<AdminOverview>('/api/admin/overview')
}
