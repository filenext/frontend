import { request } from './client'
import type { UserInfo } from './auth'
import type { UserRow } from './users'
import type { AgentRow } from '@/types/agents'
import type { AvatarKind } from '@/utils/avatar'

export interface AvatarPreset {
  name: string
  url: string
}

export function listAvatarPresets(kind: AvatarKind) {
  const q = kind === 'agent' ? 'agent' : 'user'
  return request<{ items: AvatarPreset[] }>(`/api/avatars/presets?kind=${q}`)
}

export function uploadUserAvatar(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return request<UserInfo>('/api/auth/avatar', { method: 'POST', body: fd })
}

export function setUserAvatarPreset(preset: string) {
  return request<UserInfo>('/api/auth/avatar', {
    method: 'PUT',
    body: JSON.stringify({ preset }),
  })
}

export function deleteUserAvatar() {
  return request<UserInfo>('/api/auth/avatar', { method: 'DELETE' })
}

export function uploadUserAvatarAdmin(uid: number, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return request<UserRow>(`/api/users/${uid}/avatar`, { method: 'POST', body: fd })
}

export function setUserAvatarPresetAdmin(uid: number, preset: string) {
  return request<UserRow>(`/api/users/${uid}/avatar`, {
    method: 'PUT',
    body: JSON.stringify({ preset }),
  })
}

export function deleteUserAvatarAdmin(uid: number) {
  return request<UserRow>(`/api/users/${uid}/avatar`, { method: 'DELETE' })
}

export function uploadAgentAvatar(id: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return request<AgentRow>(`/api/agents/${id}/avatar`, { method: 'POST', body: fd })
}

export function setAgentAvatarPreset(id: string, preset: string) {
  return request<AgentRow>(`/api/agents/${id}/avatar`, {
    method: 'PUT',
    body: JSON.stringify({ preset }),
  })
}

export function deleteAgentAvatar(id: string) {
  return request<AgentRow>(`/api/agents/${id}/avatar`, { method: 'DELETE' })
}
