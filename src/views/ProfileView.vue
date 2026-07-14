<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconAdjustments,
  IconKey,
  IconLock,
  IconShieldLock,
  IconUser,
} from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as authApi from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AvatarPicker from '@/components/AvatarPicker.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import TokensPanel from '@/views/profile/TokensPanel.vue'
import { useI18n } from 'vue-i18n'

type ProfileTab = 'basic' | 'preferences' | 'security' | 'tokens'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const realName = ref('')
const timezone = ref('UTC')
const timezones = ref<string[]>([])
const oldPwd = ref('')
const newPwd = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)

const totpEnabled = ref(false)
const totpEnforced = ref(false)
const totpQr = ref('')
const totpCode = ref('')
const totpLoading = ref(false)

const nav = computed(() => [
  { id: 'basic' as const, label: '基本信息', icon: IconUser },
  { id: 'preferences' as const, label: t('profile.preferences'), icon: IconAdjustments },
  { id: 'tokens' as const, label: '访问令牌', icon: IconKey },
  { id: 'security' as const, label: '账号安全', icon: IconShieldLock },
])

const validTabs = new Set<ProfileTab>(['basic', 'preferences', 'security', 'tokens'])

function parseTab(raw: unknown): ProfileTab {
  if (typeof raw === 'string' && validTabs.has(raw as ProfileTab)) {
    return raw as ProfileTab
  }
  return 'basic'
}

const activeTab = computed(() => parseTab(route.query.tab))

function selectTab(id: ProfileTab) {
  if (id === activeTab.value) return
  router.replace({ path: '/profile', query: { tab: id } })
}

onMounted(async () => {
  if (!route.query.tab) {
    await router.replace({ path: '/profile', query: { tab: 'basic' } })
  }
  if (auth.user) {
    realName.value = auth.user.real_name || ''
    timezone.value = auth.user.timezone || 'UTC'
  }
  try {
    const res = await authApi.fetchTimezones()
    timezones.value = res.items
  } catch {
    timezones.value = ['UTC', 'Asia/Shanghai']
  }
  await loadTotp()
})

watch(
  () => auth.user,
  (u) => {
    if (!u) return
    realName.value = u.real_name || ''
    timezone.value = u.timezone || 'UTC'
  },
)

async function loadTotp() {
  try {
    const s = await authApi.totpStatus()
    totpEnabled.value = s.enabled
    totpEnforced.value = s.enforced
  } catch {
    /* ignore */
  }
}

async function setupTotp() {
  totpLoading.value = true
  try {
    const res = await authApi.totpSetup()
    totpQr.value = res.qr_url
    toast.show('请使用验证器扫码，再输入验证码确认')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '设置失败')
  } finally {
    totpLoading.value = false
  }
}

async function confirmTotp() {
  totpLoading.value = true
  try {
    await authApi.totpConfirm(totpCode.value.trim())
    totpQr.value = ''
    totpCode.value = ''
    totpEnabled.value = true
    if (auth.user) auth.user.totp_enabled = true
    toast.show('双因素认证已启用')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '确认失败')
  } finally {
    totpLoading.value = false
  }
}

async function disableTotp() {
  totpLoading.value = true
  try {
    await authApi.totpDisable(totpCode.value.trim())
    totpCode.value = ''
    totpEnabled.value = false
    if (auth.user) auth.user.totp_enabled = false
    toast.show('双因素认证已关闭')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '关闭失败')
  } finally {
    totpLoading.value = false
  }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    const u = await authApi.updateProfile({
      real_name: realName.value || undefined,
      timezone: timezone.value,
    })
    auth.user = u
    toast.show('基本信息已保存')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  savingPassword.value = true
  try {
    await authApi.changePassword(oldPwd.value, newPwd.value)
    toast.show('密码已修改，请重新登录')
    await auth.logout()
    router.push('/login')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '修改失败')
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <div class="card cd-settings-layout">
    <aside class="cd-settings-nav">
      <nav class="cd-settings-nav-list">
        <button
          v-for="item in nav"
          :key="item.id"
          type="button"
          class="cd-settings-nav-item"
          :class="{ active: activeTab === item.id }"
          @click="selectTab(item.id)"
        >
          <component :is="item.icon" :size="17" :stroke="1.75" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="cd-settings-main">
      <!-- 基本信息 -->
      <div v-if="activeTab === 'basic'" class="cd-settings-panel">
        <h3 class="cd-settings-panel-title">基本信息</h3>
        <p class="text-secondary small mb-4">头像、显示名称与时区，用于界面展示与时间显示。</p>

        <div class="cd-settings-section">
          <h4>头像</h4>
          <AvatarPicker
            kind="user"
            mode="self"
            presets-aside
            :avatar-url="auth.user?.avatar_url"
            :name="auth.displayName"
            @updated="(url) => auth.user && (auth.user.avatar_url = url)"
          />
        </div>

        <div class="cd-settings-section">
          <h4>账号资料</h4>
          <div class="cd-settings-form">
            <div class="cd-settings-form-row">
              <div class="cd-settings-form-label">用户名</div>
              <div class="cd-settings-form-control">
                <input class="form-control form-control-sm" :value="auth.user?.username" disabled />
              </div>
            </div>
            <div class="cd-settings-form-row">
              <div class="cd-settings-form-label">显示名称</div>
              <div class="cd-settings-form-control">
                <input v-model="realName" class="form-control form-control-sm" placeholder="可选" />
              </div>
            </div>
            <div class="cd-settings-form-row">
              <div class="cd-settings-form-label">时区</div>
              <div class="cd-settings-form-control">
                <select v-model="timezone" class="form-select form-select-sm">
                  <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="cd-settings-form-actions">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="savingProfile"
              @click="saveProfile"
            >
              {{ savingProfile ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 偏好设置 -->
      <div v-else-if="activeTab === 'preferences'" class="cd-settings-panel">
        <h3 class="cd-settings-panel-title">{{ t('profile.preferences') }}</h3>
        <p class="text-secondary small mb-4">{{ t('profile.languageHint') }}</p>

        <div class="cd-settings-section">
          <h4>{{ t('language.label') }}</h4>
          <div class="cd-settings-form">
            <div class="cd-settings-form-row">
              <div class="cd-settings-form-label">{{ t('language.label') }}</div>
              <div class="cd-settings-form-control">
                <LanguageSwitcher inline />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 访问令牌 -->
      <TokensPanel v-else-if="activeTab === 'tokens'" />

      <!-- 账号安全 -->
      <div v-else-if="activeTab === 'security'" class="cd-settings-panel">
        <h3 class="cd-settings-panel-title">账号安全</h3>
        <p class="text-secondary small mb-4">修改登录密码，并配置双因素认证提升安全性。</p>

        <div class="cd-settings-section">
          <h4>
            <IconLock :size="16" :stroke="1.75" class="me-1" style="vertical-align: -0.15em" />
            修改密码
          </h4>
          <div class="cd-settings-form">
            <div class="cd-settings-form-row">
              <div class="cd-settings-form-label">原密码</div>
              <div class="cd-settings-form-control">
                <input
                  v-model="oldPwd"
                  type="password"
                  class="form-control form-control-sm"
                  autocomplete="current-password"
                />
              </div>
            </div>
            <div class="cd-settings-form-row">
              <div class="cd-settings-form-label">新密码</div>
              <div class="cd-settings-form-control">
                <input
                  v-model="newPwd"
                  type="password"
                  class="form-control form-control-sm"
                  minlength="5"
                  autocomplete="new-password"
                />
                <div class="form-text">修改成功后需重新登录</div>
              </div>
            </div>
          </div>
          <div class="cd-settings-form-actions">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="savingPassword || !oldPwd || !newPwd"
              @click="savePassword"
            >
              {{ savingPassword ? '更新中…' : '更新密码' }}
            </button>
          </div>
        </div>

        <div class="cd-settings-section">
          <h4>
            <IconShieldLock :size="16" :stroke="1.75" class="me-1" style="vertical-align: -0.15em" />
            双因素认证 (2FA)
          </h4>
          <p class="text-secondary small mb-3">
            启用后，登录时除账号密码外还需输入验证器 App（如 Google Authenticator）生成的动态验证码。
          </p>

          <div class="cd-settings-card mb-3">
            <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
              <div>
                <div class="fw-medium">当前状态</div>
                <div class="small mt-1">
                  <span :class="totpEnabled ? 'text-success' : 'text-secondary'">
                    {{ totpEnabled ? '已启用' : '未启用' }}
                  </span>
                  <span v-if="totpEnforced" class="text-warning ms-2">管理员已强制开启，无法关闭</span>
                </div>
              </div>
              <button
                v-if="!totpEnabled && !totpQr"
                type="button"
                class="btn btn-sm btn-outline-primary"
                :disabled="totpLoading"
                @click="setupTotp"
              >
                {{ totpLoading ? '生成中…' : '生成绑定二维码' }}
              </button>
            </div>
          </div>

          <template v-if="!totpEnabled && totpQr">
            <div class="cd-settings-card">
              <div class="mb-3 text-center">
                <img :src="totpQr" alt="TOTP QR" class="cd-totp-qr" />
                <p class="text-secondary small mt-2 mb-0">请使用验证器扫码</p>
              </div>
              <div class="cd-settings-form">
                <div class="cd-settings-form-row">
                  <div class="cd-settings-form-label">验证码</div>
                  <div class="cd-settings-form-control">
                    <div class="d-flex flex-wrap gap-2">
                      <input
                        v-model="totpCode"
                        class="form-control form-control-sm"
                        style="max-width: 10rem"
                        placeholder="6 位数字"
                        maxlength="8"
                        autocomplete="one-time-code"
                      />
                      <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        :disabled="totpLoading || !totpCode.trim()"
                        @click="confirmTotp"
                      >
                        确认启用
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="totpEnabled && !totpEnforced">
            <div class="cd-settings-form">
              <div class="cd-settings-form-row">
                <div class="cd-settings-form-label">验证码</div>
                <div class="cd-settings-form-control">
                  <div class="d-flex flex-wrap gap-2">
                    <input
                      v-model="totpCode"
                      class="form-control form-control-sm"
                      style="max-width: 10rem"
                      placeholder="6 位数字"
                      maxlength="8"
                      autocomplete="one-time-code"
                    />
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger"
                      :disabled="totpLoading || !totpCode.trim()"
                      @click="disableTotp"
                    >
                      关闭 2FA
                    </button>
                  </div>
                  <div class="form-text">关闭前需输入当前动态验证码</div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>
