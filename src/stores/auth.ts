import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import { ApiError, clearToken, getToken, setToken } from '@/api/client'

let fetchMePromise: Promise<void> | null = null

export const useAuthStore = defineStore('auth', () => {
  const user = ref<authApi.UserInfo | null>(null)
  const loading = ref(false)
  /** fetchMe 失败后置 true，避免路由守卫反复请求 */
  const sessionInvalid = ref(false)
  /** 会话校验失败提示是否已展示 */
  const sessionErrorShown = ref(false)

  const isLoggedIn = computed(() => !!getToken() && !!user.value)
  const isAdmin = computed(() => user.value?.is_admin ?? false)
  const isSuperAdmin = computed(() => user.value?.is_superadmin ?? false)
  const displayName = computed(
    () => user.value?.real_name || user.value?.username || '',
  )

  async function login(
    username: string,
    password: string,
    extras?: { captcha_id?: string; captcha_answer?: string },
  ): Promise<authApi.LoginResult | authApi.LoginPendingTOTP> {
    loading.value = true
    try {
      const res = await authApi.login({ username, password, ...extras })
      if ('need_totp' in res && res.need_totp) {
        return res
      }
      const ok = res as authApi.LoginResult
      setToken(ok.token)
      user.value = ok.user
      sessionInvalid.value = false
      sessionErrorShown.value = false
      return ok
    } finally {
      loading.value = false
    }
  }

  async function verifyTOTP(temp_token: string, code: string) {
    loading.value = true
    try {
      const res = await authApi.verifyTOTP(temp_token, code)
      setToken(res.token)
      user.value = res.user
      sessionInvalid.value = false
      sessionErrorShown.value = false
      return res
    } finally {
      loading.value = false
    }
  }

  async function loginWithToken(token: string) {
    setToken(token)
    sessionInvalid.value = false
    sessionErrorShown.value = false
    await fetchMe()
  }

  async function fetchMe() {
    if (!getToken()) {
      user.value = null
      return
    }
    if (sessionInvalid.value) return
    if (fetchMePromise) return fetchMePromise

    fetchMePromise = (async () => {
      try {
        user.value = await authApi.fetchMe()
        sessionInvalid.value = false
        sessionErrorShown.value = false
      } catch (e) {
        // 仅认证失败时清除 token；后端重启/网络抖动不应强制重新登录
        if (e instanceof ApiError && e.code === 401) {
          clearToken()
          user.value = null
          sessionInvalid.value = true
        }
        throw e
      } finally {
        fetchMePromise = null
      }
    })()
    return fetchMePromise
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      clearToken()
      user.value = null
      sessionInvalid.value = false
    }
  }

  return {
    user,
    loading,
    sessionInvalid,
    sessionErrorShown,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    displayName,
    login,
    verifyTOTP,
    loginWithToken,
    fetchMe,
    logout,
  }
})
