const STORAGE_KEY = 'cd_login_remember'

export interface SavedLogin {
  username: string
  password: string
  remember: boolean
}

export function loadSavedLogin(): SavedLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SavedLogin
    if (!data.remember || !data.username) return null
    return data
  } catch {
    return null
  }
}

export function saveLogin(username: string, password: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username, password, remember: true } satisfies SavedLogin),
    )
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function clearSavedLogin() {
  localStorage.removeItem(STORAGE_KEY)
}
