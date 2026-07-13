import type { OAuthProvider } from '@/api/settings'

export type LoginOAuthPresetKey = 'github'

export const LOGIN_OAUTH_PRESETS: Record<LoginOAuthPresetKey, OAuthProvider> = {
  github: {
    id: 'github',
    name: 'GitHub',
    type: 'github',
    client_id: '',
    client_secret: '',
    scopes: 'read:user user:email',
    enabled: false,
  },
}

export const LOGIN_OAUTH_PRESET_OPTIONS: { key: LoginOAuthPresetKey; label: string; hint: string }[] = [
  {
    key: 'github',
    label: 'GitHub',
    hint: 'GitHub OAuth App；回调 /api/auth/oauth/github/callback',
  },
]

export function cloneLoginOAuthPreset(key: LoginOAuthPresetKey): OAuthProvider {
  return { ...LOGIN_OAUTH_PRESETS[key] }
}

export function applyLoginOAuthPreset(provider: OAuthProvider) {
  const preset = LOGIN_OAUTH_PRESETS[provider.type as LoginOAuthPresetKey]
  if (!preset) return
  if (!provider.scopes) provider.scopes = preset.scopes
  if (!provider.name) provider.name = preset.name
}

export function mergeLoginOAuthProviders(providers: OAuthProvider[]): OAuthProvider[] {
  const existing = new Set(providers.map((p) => p.id))
  if (existing.has('github')) return providers
  return [...providers, { ...LOGIN_OAUTH_PRESETS.github }]
}
