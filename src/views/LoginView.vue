<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconCloudUpload,
  IconLock,
  IconShieldCheck,
  IconSparkles,
  IconAiAgent,
  IconEye,
  IconEyeOff,
  IconUser,
  IconMail,
  IconLogin2,
  IconUserPlus,
  IconKey,
  IconArrowLeft,
} from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as authApi from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useBrandingStore } from '@/stores/branding'
import AppBrand from '@/components/AppBrand.vue'
import PickupCodePanel from '@/components/PickupCodePanel.vue'
import LoginLanguageSwitcher from '@/components/LoginLanguageSwitcher.vue'
import { loadSavedLogin, saveLogin } from '@/composables/useLoginRemember'
import { useI18n } from 'vue-i18n'
import { LOGIN_FOOTER_POWERED_BY_URL, LOGIN_FOOTER_WECHAT, isPickupEnabled } from '@/types/branding'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

const auth = useAuthStore()
const branding = useBrandingStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

const allowRegister = ref(true)
const captchaEnabled = ref(false)
const oauthEnabled = ref(false)
const oauthProviders = ref<authApi.OAuthProviderPublic[]>([])
const passwordRules = ref<string[]>([])
const mode = ref<AuthMode>('login')
const loginStep = ref<'credentials' | 'totp'>('credentials')
const tempToken = ref('')
const totpCode = ref('')
const captchaId = ref('')
const captchaImage = ref('')
const captchaAnswer = ref('')
const captchaTouched = ref(false)
const error = ref('')
const success = ref('')
const showPwd = ref(false)
const showPwd2 = ref(false)
const remember = ref(false)
const submitting = ref(false)

const username = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const resetToken = ref('')
const usernameTouched = ref(false)
const emailTouched = ref(false)
const passwordTouched = ref(false)

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const usernameError = computed(() => {
  if (!usernameTouched.value) return ''
  const value = username.value.trim()
  if (!value) {
    return mode.value === 'login'
      ? t('login.errors.usernameRequiredLogin')
      : t('login.errors.usernameRequired')
  }
  if (mode.value === 'register' && value.length < 3) return t('login.errors.usernameMin')
  return ''
})

const emailError = computed(() => {
  if (mode.value !== 'register' || !emailTouched.value) return ''
  const value = email.value.trim()
  if (!value) return t('login.errors.emailRequired')
  if (!isValidEmail(value)) return t('login.errors.emailInvalid')
  return ''
})

const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return t('login.errors.passwordRequired')
  if (mode.value === 'register' && password.value.length < 5) return t('login.errors.passwordMin')
  return ''
})

const captchaError = computed(() => {
  if (!captchaEnabled.value || !captchaTouched.value) return ''
  if (!captchaAnswer.value.trim()) return t('login.errors.captchaRequired')
  return ''
})

const captchaImageSrc = computed(() => {
  const raw = captchaImage.value.trim()
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  return `data:image/png;base64,${raw}`
})

const brandAccent = computed(() => branding.settings.primary_color || '#2563eb')

const heroDescription = computed(
  () => branding.settings.login_description || t('login.heroDefault'),
)

const features = computed(() => [
  { icon: IconCloudUpload, text: t('login.features.multiStorage') },
  { icon: IconSparkles, text: t('login.features.aiChat') },
  { icon: IconAiAgent, text: t('login.features.agents') },
  { icon: IconShieldCheck, text: t('login.features.security') },
])

const modeDividerLabel = computed(() => {
  if (mode.value === 'register') return t('login.modes.register')
  if (mode.value === 'forgot') return t('login.modes.forgot')
  if (mode.value === 'reset') return t('login.modes.reset')
  return t('login.modes.login')
})

const passwordRulesText = computed(() => {
  if (!passwordRules.value.length) return ''
  const sep = locale.value === 'en' ? ', ' : '、'
  return t('login.passwordRules', { rules: passwordRules.value.join(sep) })
})

const loginFooterPoweredByName = computed(
  () => branding.settings.footer_powered_by_name?.trim() || 'NextFile',
)
const loginFooterIcp = computed(() => branding.settings.footer_icp?.trim() || '')

const pickupEnabled = computed(() => isPickupEnabled(branding.settings))
const pickupInitialCode = computed(() => {
  const code = route.query.code ?? route.query.pickup_code
  return typeof code === 'string' ? code.trim().toUpperCase() : ''
})

const loginFieldIcon = { size: 17, stroke: 1.5 }

const submitLabel = computed(() => {
  if (submitting.value || auth.loading) return t('login.submit.processing')
  if (mode.value === 'login') {
    if (loginStep.value === 'totp') return t('login.submit.verifyLogin')
    return t('login.submit.login')
  }
  if (mode.value === 'register') return t('login.submit.register')
  if (mode.value === 'forgot') return t('login.submit.forgot')
  return t('login.submit.reset')
})

const SubmitIcon = computed(() => {
  if (mode.value === 'login') return IconLogin2
  if (mode.value === 'register') return IconUserPlus
  if (mode.value === 'forgot') return IconKey
  return IconKey
})

function resetLoginFieldHints() {
  usernameTouched.value = false
  emailTouched.value = false
  passwordTouched.value = false
  captchaTouched.value = false
}

function setMode(next: AuthMode) {
  mode.value = next
  loginStep.value = 'credentials'
  tempToken.value = ''
  totpCode.value = ''
  error.value = ''
  success.value = ''
  email.value = ''
  password.value = ''
  password2.value = ''
  resetLoginFieldHints()
  if (next === 'login') {
    router.replace({ path: '/login' })
  } else {
    router.replace({ path: '/login', query: { mode: next } })
  }
}

function syncModeFromRoute() {
  const m = route.query.mode as string
  const token = route.query.token as string
  if (m === 'register') mode.value = 'register'
  else if (m === 'forgot') mode.value = 'forgot'
  else if (m === 'reset') {
    mode.value = 'reset'
    resetToken.value = token || resetToken.value
  } else mode.value = 'login'
}

async function refreshCaptcha() {
  if (!captchaEnabled.value) return
  try {
    const c = await authApi.fetchCaptcha()
    captchaId.value = c.captcha_id
    captchaImage.value = c.image_base64
    captchaAnswer.value = ''
    captchaTouched.value = false
  } catch {
    /* ignore */
  }
}

async function submitLogin() {
  error.value = ''
  usernameTouched.value = true
  passwordTouched.value = true
  if (captchaEnabled.value) captchaTouched.value = true
  if (usernameError.value || passwordError.value || captchaError.value) return
  submitting.value = true
  try {
    const res = await auth.login(username.value.trim(), password.value, {
      captcha_id: captchaEnabled.value ? captchaId.value : undefined,
      captcha_answer: captchaEnabled.value ? captchaAnswer.value.trim() : undefined,
    })
    if (res && 'need_totp' in res && res.need_totp) {
      loginStep.value = 'totp'
      tempToken.value = res.temp_token
      success.value = t('login.totpRequired')
      return
    }
    saveLogin(username.value.trim(), password.value, remember.value)
    router.push('/files')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('login.errors.loginFailed')
    await refreshCaptcha()
  } finally {
    submitting.value = false
  }
}

async function submitTOTP() {
  error.value = ''
  if (!totpCode.value.trim()) {
    error.value = t('login.totpRequired')
    return
  }
  submitting.value = true
  try {
    await auth.verifyTOTP(tempToken.value, totpCode.value.trim())
    saveLogin(username.value.trim(), password.value, remember.value)
    router.push('/files')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('login.errors.verifyFailed')
  } finally {
    submitting.value = false
  }
}

async function submitRegister() {
  error.value = ''
  usernameTouched.value = true
  emailTouched.value = true
  passwordTouched.value = true
  if (password.value !== password2.value) {
    error.value = t('login.errors.passwordMismatch')
    return
  }
  if (usernameError.value || emailError.value || passwordError.value) return
  submitting.value = true
  try {
    await authApi.register({
      username: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    success.value = t('login.success.register')
    username.value = username.value.trim()
    password.value = ''
    password2.value = ''
    setMode('login')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('login.errors.registerFailed')
  } finally {
    submitting.value = false
  }
}

async function submitForgot() {
  error.value = ''
  success.value = ''
  submitting.value = true
  try {
    const res = await authApi.forgotPassword(username.value.trim())
    if (res.reset_token) {
      resetToken.value = res.reset_token
      success.value = t('login.success.forgotVerified')
      router.replace({ path: '/login', query: { mode: 'reset', token: res.reset_token } })
      mode.value = 'reset'
    } else {
      success.value = res.message || t('login.success.forgotDefault')
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('login.errors.requestFailed')
  } finally {
    submitting.value = false
  }
}

async function submitReset() {
  error.value = ''
  if (password.value !== password2.value) {
    error.value = t('login.errors.passwordMismatch')
    return
  }
  if (!resetToken.value) {
    error.value = t('login.errors.resetTokenMissing')
    return
  }
  submitting.value = true
  try {
    await authApi.resetPassword(resetToken.value, password.value)
    success.value = t('login.success.reset')
    password.value = ''
    password2.value = ''
    resetToken.value = ''
    setMode('login')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('login.errors.resetFailed')
  } finally {
    submitting.value = false
  }
}

function onSubmit() {
  if (mode.value === 'login') {
    if (loginStep.value === 'totp') submitTOTP()
    else submitLogin()
    return
  }
  if (mode.value === 'register') submitRegister()
  else if (mode.value === 'forgot') submitForgot()
  else submitReset()
}

function oauthLogin(providerId: string) {
  window.location.href = authApi.oauthStartUrl(providerId)
}

watch(() => route.query, syncModeFromRoute)

onMounted(async () => {
  syncModeFromRoute()
  const saved = loadSavedLogin()
  if (saved) {
    username.value = saved.username
    password.value = saved.password
    remember.value = true
  }
  try {
    const cfg = await authApi.fetchAuthConfig()
    allowRegister.value = cfg.allow_register
    captchaEnabled.value = cfg.captcha_enabled
    oauthEnabled.value = cfg.oauth_enabled
    oauthProviders.value = cfg.oauth_providers || []
    passwordRules.value = cfg.password_rules || []
    if (captchaEnabled.value) await refreshCaptcha()
  } catch {
    allowRegister.value = true
  }
  const oauthToken = route.query.oauth_token as string
  if (oauthToken) {
    try {
      await auth.loginWithToken(oauthToken)
      router.replace('/files')
    } catch {
      error.value = t('login.errors.oauthFailed')
    }
  }
  if (route.query.error) {
    error.value = t('login.errors.oauthRetry')
  }
  if (route.query.token && route.query.mode === 'reset') {
    resetToken.value = String(route.query.token)
  }
})
</script>

<template>
  <div class="cd-login-page">
    <PickupCodePanel
      v-if="pickupEnabled"
      :initial-code="pickupInitialCode"
      :auto-submit="!!pickupInitialCode"
    />

    <div class="cd-login-hero" :style="{ '--cd-login-accent': brandAccent }">
      <div class="cd-login-hero-inner">
        <AppBrand size="lg" show-tagline />
        <p class="cd-login-hero-desc">{{ heroDescription }}</p>
        <ul class="cd-login-features">
          <li v-for="(f, i) in features" :key="i">
            <span class="cd-login-feature-icon">
              <component :is="f.icon" :size="18" :stroke="1.75" />
            </span>
            <span>{{ f.text }}</span>
          </li>
        </ul>
        <div class="cd-login-hero-badge">
          <IconSparkles :size="14" />
          <span>{{ t('login.heroBadge') }}</span>
        </div>
      </div>
    </div>

    <div class="cd-login-panel">
      <div class="cd-login-panel-inner">
        <form class="cd-login-card" novalidate @submit.prevent="onSubmit">
          <div class="cd-login-card-brand">
            <AppBrand size="lg" show-tagline />
          </div>

          <div class="cd-login-card-divider">
            <span>{{ modeDividerLabel }}</span>
          </div>

          <div v-if="error" class="alert alert-danger py-2 mb-3">{{ error }}</div>
          <div v-if="success" class="alert alert-success py-2 mb-3">{{ success }}</div>

          <!-- 登录 -->
          <template v-if="mode === 'login'">
            <template v-if="loginStep === 'totp'">
              <div class="mb-3">
                <label class="form-label">{{ t('login.totpCode') }}</label>
                <input v-model="totpCode" class="form-control" :placeholder="t('login.totpPlaceholder')" maxlength="8" autocomplete="one-time-code" />
              </div>
              <button type="button" class="cd-login-link cd-login-back mb-3" @click="loginStep = 'credentials'">
                <IconArrowLeft :size="16" />
                {{ t('login.backToCredentials') }}
              </button>
            </template>
            <template v-else>
            <div class="cd-login-field-group">
              <div class="input-group cd-login-field" :class="{ 'is-invalid': usernameError }">
                <span class="cd-login-field-icon" aria-hidden="true"><IconUser v-bind="loginFieldIcon" /></span>
                <input
                  v-model="username"
                  class="form-control"
                  :placeholder="t('login.account')"
                  autocomplete="username"
                  @blur="usernameTouched = true"
                />
              </div>
              <p class="cd-login-field-hint">{{ usernameError }}</p>
            </div>
            <div class="cd-login-field-group">
              <div class="input-group cd-login-field" :class="{ 'is-invalid': passwordError }">
                <span class="cd-login-field-icon" aria-hidden="true"><IconLock v-bind="loginFieldIcon" /></span>
                <input
                  v-model="password"
                  :type="showPwd ? 'text' : 'password'"
                  class="form-control"
                  :placeholder="t('login.password')"
                  autocomplete="current-password"
                  @blur="passwordTouched = true"
                />
                <button
                  v-if="password"
                  type="button"
                  class="cd-login-eye"
                  tabindex="-1"
                  @click="showPwd = !showPwd"
                >
                  <IconEye v-if="!showPwd" v-bind="loginFieldIcon" />
                  <IconEyeOff v-else v-bind="loginFieldIcon" />
                </button>
              </div>
              <p class="cd-login-field-hint">{{ passwordError }}</p>
            </div>
            <div v-if="captchaEnabled" class="cd-login-field-group">
              <div class="input-group cd-login-field cd-login-field--captcha" :class="{ 'is-invalid': captchaError }">
                <span class="cd-login-field-icon" aria-hidden="true"><IconShieldCheck v-bind="loginFieldIcon" /></span>
                <input
                  v-model="captchaAnswer"
                  class="form-control"
                  :placeholder="t('login.captcha')"
                  maxlength="6"
                  autocomplete="off"
                  inputmode="numeric"
                  @blur="captchaTouched = true"
                />
                <button
                  type="button"
                  class="cd-login-captcha-img"
                  tabindex="-1"
                  :title="t('login.captchaRefresh')"
                  @click="refreshCaptcha"
                >
                  <img
                    v-if="captchaImageSrc"
                    :src="captchaImageSrc"
                    :alt="t('login.captcha')"
                    class="cd-login-captcha-img__pic"
                  />
                  <span v-else class="cd-login-captcha-img__placeholder">{{ t('login.captchaLoading') }}</span>
                </button>
              </div>
              <p class="cd-login-field-hint">{{ captchaError }}</p>
            </div>
            <div class="d-flex align-items-center justify-content-between mb-3">
              <label class="form-check mb-0">
                <input v-model="remember" class="form-check-input" type="checkbox" />
                <span class="form-check-label">{{ t('login.rememberPassword') }}</span>
              </label>
              <button type="button" class="cd-login-link cd-login-link--inline" @click="setMode('forgot')">
                <IconKey :size="15" />
                {{ t('login.forgotPassword') }}
              </button>
            </div>
            </template>
          </template>

          <!-- 注册 -->
          <template v-else-if="mode === 'register'">
            <div class="cd-login-field-group">
              <div class="input-group cd-login-field" :class="{ 'is-invalid': usernameError }">
                <span class="cd-login-field-icon" aria-hidden="true"><IconUser v-bind="loginFieldIcon" /></span>
                <input
                  v-model="username"
                  class="form-control"
                  :placeholder="t('login.username')"
                  autocomplete="username"
                  @blur="usernameTouched = true"
                />
              </div>
              <p class="cd-login-field-hint">{{ usernameError }}</p>
            </div>
            <div class="cd-login-field-group">
              <div class="input-group cd-login-field" :class="{ 'is-invalid': emailError }">
                <span class="cd-login-field-icon" aria-hidden="true"><IconMail v-bind="loginFieldIcon" /></span>
                <input
                  v-model="email"
                  type="email"
                  class="form-control"
                  :placeholder="t('login.email')"
                  autocomplete="email"
                  @blur="emailTouched = true"
                />
              </div>
              <p class="cd-login-field-hint">{{ emailError }}</p>
            </div>
            <div class="cd-login-field-group">
              <div class="input-group cd-login-field" :class="{ 'is-invalid': passwordError }">
                <span class="cd-login-field-icon" aria-hidden="true"><IconLock v-bind="loginFieldIcon" /></span>
                <input
                  v-model="password"
                  :type="showPwd ? 'text' : 'password'"
                  class="form-control"
                  :placeholder="t('login.password')"
                  autocomplete="new-password"
                  @blur="passwordTouched = true"
                />
                <button
                  v-if="password"
                  type="button"
                  class="cd-login-eye"
                  tabindex="-1"
                  @click="showPwd = !showPwd"
                >
                  <IconEye v-if="!showPwd" v-bind="loginFieldIcon" />
                  <IconEyeOff v-else v-bind="loginFieldIcon" />
                </button>
              </div>
              <p class="cd-login-field-hint">{{ passwordError }}</p>
            </div>
            <div class="cd-login-field-group">
              <div class="input-group cd-login-field">
                <span class="cd-login-field-icon" aria-hidden="true"><IconLock v-bind="loginFieldIcon" /></span>
                <input
                  v-model="password2"
                  :type="showPwd2 ? 'text' : 'password'"
                  class="form-control"
                  :placeholder="t('login.confirmPassword')"
                  autocomplete="new-password"
                />
                <button
                  v-if="password2"
                  type="button"
                  class="cd-login-eye"
                  tabindex="-1"
                  @click="showPwd2 = !showPwd2"
                >
                  <IconEye v-if="!showPwd2" v-bind="loginFieldIcon" />
                  <IconEyeOff v-else v-bind="loginFieldIcon" />
                </button>
              </div>
              <p class="cd-login-field-hint"></p>
            </div>
          </template>

          <!-- 忘记密码 -->
          <template v-else-if="mode === 'forgot'">
            <div class="mb-3">
              <div class="input-group cd-login-field">
                <span class="cd-login-field-icon" aria-hidden="true"><IconUser v-bind="loginFieldIcon" /></span>
                <input
                  v-model="username"
                  class="form-control"
                  :placeholder="t('login.account')"
                  autocomplete="username"
                />
              </div>
            </div>
            <p class="text-secondary small mb-3">
              {{ t('login.forgotHint') }}
            </p>
          </template>

          <!-- 重置密码 -->
          <template v-else>
            <div class="mb-3">
              <div class="input-group cd-login-field">
                <span class="cd-login-field-icon" aria-hidden="true"><IconLock v-bind="loginFieldIcon" /></span>
                <input
                  v-model="password"
                  :type="showPwd ? 'text' : 'password'"
                  class="form-control"
                  :placeholder="t('login.newPassword')"
                  autocomplete="new-password"
                />
                <button
                  v-if="password"
                  type="button"
                  class="cd-login-eye"
                  tabindex="-1"
                  @click="showPwd = !showPwd"
                >
                  <IconEye v-if="!showPwd" v-bind="loginFieldIcon" />
                  <IconEyeOff v-else v-bind="loginFieldIcon" />
                </button>
              </div>
            </div>
            <div class="mb-3">
              <div class="input-group cd-login-field">
                <span class="cd-login-field-icon" aria-hidden="true"><IconLock v-bind="loginFieldIcon" /></span>
                <input
                  v-model="password2"
                  :type="showPwd2 ? 'text' : 'password'"
                  class="form-control"
                  :placeholder="t('login.confirmNewPassword')"
                  autocomplete="new-password"
                />
                <button
                  v-if="password2"
                  type="button"
                  class="cd-login-eye"
                  tabindex="-1"
                  @click="showPwd2 = !showPwd2"
                >
                  <IconEye v-if="!showPwd2" v-bind="loginFieldIcon" />
                  <IconEyeOff v-else v-bind="loginFieldIcon" />
                </button>
              </div>
            </div>
          </template>

          <button type="submit" class="cd-login-submit" :disabled="submitting || auth.loading">
            <component :is="SubmitIcon" :size="18" :stroke="1.75" />
            <span>{{ submitLabel }}</span>
          </button>

          <div v-if="mode === 'login' && loginStep === 'credentials' && oauthEnabled && oauthProviders.length" class="cd-oauth-divider">
            <span>{{ t('login.oauthDivider') }}</span>
          </div>
          <div v-if="mode === 'login' && loginStep === 'credentials' && oauthEnabled" class="cd-oauth-buttons">
            <button
              v-for="p in oauthProviders"
              :key="p.id"
              type="button"
              class="cd-oauth-btn"
              @click="oauthLogin(p.id)"
            >
              <img v-if="p.icon_url" :src="p.icon_url" alt="" class="cd-oauth-btn-icon" />
              <span>{{ p.name }}</span>
            </button>
          </div>

          <div v-if="mode === 'register' && passwordRules.length" class="text-secondary small mt-2">
            {{ passwordRulesText }}
          </div>

          <div class="cd-login-card-foot">
            <template v-if="mode === 'login'">
              <span v-if="allowRegister" class="text-secondary small">
                {{ t('login.noAccount') }}
                <button type="button" class="cd-login-link cd-login-link--inline" @click="setMode('register')">
                  <IconUserPlus :size="15" />
                  {{ t('login.registerNow') }}
                </button>
              </span>
            </template>
            <template v-else>
              <button type="button" class="cd-login-link cd-login-back" @click="setMode('login')">
                <IconArrowLeft :size="16" />
                {{ t('login.backLogin') }}
              </button>
            </template>
          </div>
        </form>

        <footer class="cd-login-footer">
          <p class="cd-login-footer-line">
            <span>© {{ new Date().getFullYear() }}</span>{{ ' ' }}<a
              :href="LOGIN_FOOTER_POWERED_BY_URL"
              class="cd-login-footer-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ loginFooterPoweredByName }}
            </a>
            <span class="cd-login-footer-sep">|</span>
            <span>{{ t('login.wechat') }}: {{ LOGIN_FOOTER_WECHAT }}</span>
            <template v-if="loginFooterIcp">
              <span class="cd-login-footer-sep">|</span>
              <span>{{ loginFooterIcp }}</span>
            </template>
          </p>
        </footer>
        <LoginLanguageSwitcher />
      </div>
    </div>
  </div>
</template>
