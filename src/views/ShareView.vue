<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconChevronRight, IconDownload } from '@tabler/icons-vue'
import { fmtDate, fmtSize, ApiError } from '@/api/client'
import * as sharesApi from '@/api/shares'
import type { PublicShareChild, PublicShareInfo } from '@/api/shares'
import { parseSharePasswordFromQuery, normalizeSharePassword } from '@/api/shares'
import { useBrandingStore } from '@/stores/branding'
import { LOGIN_FOOTER_POWERED_BY_URL, LOGIN_FOOTER_WECHAT } from '@/types/branding'
import AppBrand from '@/components/AppBrand.vue'
import CdAvatar from '@/components/CdAvatar.vue'
import FileTypeIcon from '@/components/FileTypeIcon.vue'
import { useToast } from '@/composables/useToast'

const branding = useBrandingStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const error = ref('')
const loading = ref(true)
const needPassword = ref(false)
const requiresPassword = ref(false)
const password = ref('')
const passwordError = ref('')
const file = ref<PublicShareInfo | null>(null)
const cwd = ref('')
const adImageBroken = ref(false)
const sharerName = ref('')
const sharerAvatar = ref('')
const extracting = ref(false)
const packing = ref(false)
const downloadingPath = ref('')

const token = () => String(route.params.token || '')

const shareAdImageUrl = computed(() => branding.settings.share_ad_image_url?.trim() || '')
const shareAdLinkUrl = computed(() => {
  const raw = branding.settings.share_ad_url?.trim() || ''
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
})

const sharerDisplayName = computed(() => sharerName.value.trim() || '用户')

const loginFooterPoweredByName = computed(
  () => branding.settings.footer_powered_by_name?.trim() || 'NextFile',
)
const loginFooterIcp = computed(() => branding.settings.footer_icp?.trim() || '')

const showPasswordForm = computed(() => needPassword.value && !file.value)

const isFolderShare = computed(() => !!file.value?.is_dir)

const shareRootName = computed(() => file.value?.share_name || file.value?.name || '分享')

const children = computed(() => {
  const list = file.value?.children || []
  return [...list].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
})

const breadcrumbs = computed(() => {
  const root = shareRootName.value
  const parts = cwd.value ? cwd.value.split('/').filter(Boolean) : []
  const crumbs: { label: string; relPath: string }[] = [{ label: root, relPath: '' }]
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    crumbs.push({ label: part, relPath: acc })
  }
  return crumbs
})

function syncPasswordRoute(pwd: string) {
  const normalized = normalizeSharePassword(pwd)
  if (!normalized) return
  router.replace({ path: `/s/${token()}`, query: { pwd: normalized } })
}

function applySharer(info: Pick<PublicShareInfo, 'sharer_name' | 'sharer_avatar_url'>) {
  if (info.sharer_name) sharerName.value = info.sharer_name
  if (info.sharer_avatar_url !== undefined) sharerAvatar.value = info.sharer_avatar_url || ''
}

async function load(pwd?: string, relPath = cwd.value) {
  loading.value = true
  error.value = ''
  passwordError.value = ''
  const normalized = pwd ? normalizeSharePassword(pwd) : ''
  try {
    const info = await sharesApi.getPublicShare(token(), normalized || undefined, relPath || undefined)
    if (info.need_password) {
      applySharer(info)
      requiresPassword.value = true
      needPassword.value = true
      file.value = null
      return
    }
    needPassword.value = false
    file.value = info
    cwd.value = info.rel_path || ''
    applySharer(info)
    if (normalized) {
      password.value = normalized
      requiresPassword.value = true
      syncPasswordRoute(normalized)
    }
  } catch (e) {
    file.value = null
    const msg = e instanceof ApiError ? e.message : '无法加载分享文件'
    if (normalized || needPassword.value || requiresPassword.value || msg.includes('密码')) {
      requiresPassword.value = true
      needPassword.value = true
      passwordError.value = normalized ? msg : ''
      return
    }
    needPassword.value = false
    error.value = msg
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const initial = parseSharePasswordFromQuery(route.query)
  if (initial) {
    password.value = initial
    syncPasswordRoute(initial)
    load(initial)
    return
  }
  load()
})

async function downloadFile(auto = false, child?: PublicShareChild) {
  if (!file.value || extracting.value || packing.value) return false
  if (!child && file.value.is_dir) return false
  extracting.value = true
  downloadingPath.value = child?.rel_path || ''
  try {
    await sharesApi.downloadPublicShare(
      token(),
      password.value || undefined,
      child?.name || file.value.name,
      child?.rel_path || undefined,
    )
    if (!auto) toast.show('开始下载')
    return true
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '下载失败')
    return false
  } finally {
    extracting.value = false
    downloadingPath.value = ''
  }
}

async function packCurrentDir() {
  if (!file.value?.is_dir || packing.value || extracting.value) return
  packing.value = true
  try {
    const name = `${file.value.name || 'download'}.zip`
    await sharesApi.packPublicShare(
      token(),
      password.value || undefined,
      name,
      cwd.value || undefined,
    )
    toast.show('开始打包下载')
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '打包失败')
  } finally {
    packing.value = false
  }
}

async function packChildDir(child: PublicShareChild) {
  if (!child.is_dir || packing.value || extracting.value) return
  packing.value = true
  try {
    await sharesApi.packPublicShare(
      token(),
      password.value || undefined,
      `${child.name}.zip`,
      child.rel_path,
    )
    toast.show('开始打包下载')
  } catch (e) {
    toast.show(e instanceof Error ? e.message : '打包失败')
  } finally {
    packing.value = false
  }
}

async function onExtract() {
  await downloadFile()
}

async function openChild(child: PublicShareChild) {
  if (!child.is_dir) {
    await downloadFile(false, child)
    return
  }
  await load(password.value || undefined, child.rel_path)
}

async function goBreadcrumb(relPath: string) {
  if (relPath === cwd.value) return
  await load(password.value || undefined, relPath)
}

async function submitPassword() {
  const pwd = normalizeSharePassword(password.value)
  password.value = pwd
  if (pwd.length < 4) {
    passwordError.value = '请输入 4 位分享密码'
    return
  }
  await load(pwd, '')
  if (file.value && !file.value.is_dir) {
    await downloadFile(true)
  }
}

function onPasswordInput() {
  password.value = normalizeSharePassword(password.value)
  passwordError.value = ''
}

function childBusy(child: PublicShareChild) {
  return extracting.value && downloadingPath.value === child.rel_path
}
</script>

<template>
  <div class="page cd-share-page cd-share-page--gate">
    <div class="cd-share-gate">
      <div class="cd-share-baidu-left">
        <div class="cd-share-baidu-main" :class="{ 'cd-share-baidu-main--browse': isFolderShare }">
          <div class="cd-share-baidu-topbrand cd-login-card-brand">
            <AppBrand size="lg" show-tagline />
          </div>

          <div class="cd-share-baidu-card">
            <div class="cd-share-baidu-card-head">
              <div class="cd-share-baidu-sharer">
                <CdAvatar
                  :src="sharerAvatar"
                  :name="sharerDisplayName"
                  kind="user"
                  size="lg"
                />
                <div class="cd-share-baidu-sharer-meta">
                  <p class="cd-share-baidu-sharer-line">
                    <span class="cd-share-baidu-sharer-name">{{ sharerDisplayName }}</span>
                    给您分享了{{ file?.is_dir ? '一个文件夹' : '一个文件' }}
                  </p>
                </div>
              </div>
            </div>

            <div class="cd-share-baidu-card-body">
              <div v-if="loading" class="cd-share-baidu-loading">加载中…</div>

              <form v-else-if="showPasswordForm" class="cd-share-baidu-form" novalidate @submit.prevent="submitPassword">
                <label class="cd-share-baidu-label" for="share-pwd">请输入分享密码：</label>
                <div class="cd-share-baidu-input-row">
                  <input
                    id="share-pwd"
                    v-model="password"
                    class="cd-share-baidu-input font-monospace"
                    maxlength="4"
                    autocomplete="off"
                    placeholder=""
                    @input="onPasswordInput"
                  />
                  <button type="submit" class="cd-share-baidu-submit" :disabled="password.length < 4 || extracting">
                    {{ extracting ? '提取中…' : '提取文件' }}
                  </button>
                </div>
                <p v-if="passwordError" class="cd-share-baidu-error">{{ passwordError }}</p>
              </form>

              <div v-else-if="file && file.is_dir" class="cd-share-baidu-file cd-share-browse">
                <div class="cd-share-baidu-file-row">
                  <FileTypeIcon
                    :name="file.name"
                    :is-dir="true"
                    :mime-type="file.mime_type"
                    :size="52"
                  />
                  <div class="cd-share-baidu-file-meta min-w-0">
                    <div class="cd-share-baidu-file-name">{{ shareRootName }}</div>
                    <div class="cd-share-baidu-file-sub">
                      {{ file.storage_name || '文件夹' }}
                      <template v-if="file.size"> · {{ fmtSize(file.size) }}</template>
                    </div>
                  </div>
                </div>
                <dl class="cd-share-baidu-file-dl">
                  <dt>修改时间</dt>
                  <dd>{{ fmtDate(file.modified) || '—' }}</dd>
                  <template v-if="file.expires_at">
                    <dt>有效期至</dt>
                    <dd>{{ fmtDate(file.expires_at) }}</dd>
                  </template>
                </dl>
                <button
                  type="button"
                  class="cd-share-baidu-submit cd-share-baidu-submit--block"
                  :disabled="packing || extracting"
                  @click="packCurrentDir"
                >
                  <IconDownload :size="16" :stroke="1.75" />
                  {{ packing ? '打包中…' : '打包下载' }}
                </button>

                <div class="cd-share-browse-panel">
                  <nav class="cd-share-browse-crumbs" aria-label="路径">
                    <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.relPath || 'root'">
                      <button
                        v-if="idx < breadcrumbs.length - 1"
                        type="button"
                        class="cd-share-browse-crumb"
                        @click="goBreadcrumb(crumb.relPath)"
                      >
                        {{ crumb.label }}
                      </button>
                      <span v-else class="cd-share-browse-crumb cd-share-browse-crumb--current">
                        {{ crumb.label }}
                      </span>
                      <IconChevronRight
                        v-if="idx < breadcrumbs.length - 1"
                        :size="14"
                        class="cd-share-browse-sep"
                      />
                    </template>
                  </nav>

                  <div v-if="!children.length" class="cd-share-browse-empty">此文件夹为空</div>
                  <ul v-else class="cd-share-browse-list">
                    <li v-for="child in children" :key="child.rel_path" class="cd-share-browse-item">
                      <button
                        type="button"
                        class="cd-share-browse-main"
                        :disabled="packing || extracting"
                        @click="openChild(child)"
                      >
                        <FileTypeIcon
                          :name="child.name"
                          :is-dir="child.is_dir"
                          :mime-type="child.mime_type"
                          :size="28"
                        />
                        <span class="cd-share-browse-meta min-w-0">
                          <span class="cd-share-browse-name">{{ child.name }}</span>
                          <span class="cd-share-browse-sub">
                            <template v-if="child.is_dir">文件夹</template>
                            <template v-else>{{ fmtSize(child.size) }}</template>
                            <template v-if="child.modified"> · {{ fmtDate(child.modified) }}</template>
                          </span>
                        </span>
                        <IconChevronRight v-if="child.is_dir" :size="16" class="cd-share-browse-arrow" />
                      </button>
                      <button
                        v-if="!child.is_dir"
                        type="button"
                        class="cd-share-browse-dl"
                        :disabled="packing || extracting"
                        :title="'下载 ' + child.name"
                        @click="downloadFile(false, child)"
                      >
                        {{ childBusy(child) ? '…' : '下载' }}
                      </button>
                      <button
                        v-else
                        type="button"
                        class="cd-share-browse-dl"
                        :disabled="packing || extracting"
                        title="打包下载此文件夹"
                        @click="packChildDir(child)"
                      >
                        打包
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              <div v-else-if="file" class="cd-share-baidu-file">
                <div class="cd-share-baidu-file-row">
                  <FileTypeIcon
                    :name="file.name"
                    :is-dir="file.is_dir"
                    :mime-type="file.mime_type"
                    :size="52"
                  />
                  <div class="cd-share-baidu-file-meta min-w-0">
                    <div class="cd-share-baidu-file-name">{{ file.name }}</div>
                    <div class="cd-share-baidu-file-sub">
                      {{ file.storage_name }} · {{ fmtSize(file.size) }}
                    </div>
                  </div>
                </div>
                <dl class="cd-share-baidu-file-dl">
                  <dt>修改时间</dt>
                  <dd>{{ fmtDate(file.modified) || '—' }}</dd>
                  <template v-if="file.expires_at">
                    <dt>有效期至</dt>
                    <dd>{{ fmtDate(file.expires_at) }}</dd>
                  </template>
                </dl>
                <button
                  type="button"
                  class="cd-share-baidu-submit cd-share-baidu-submit--block"
                  :disabled="extracting"
                  @click="onExtract"
                >
                  {{ extracting ? '提取中…' : '提取文件' }}
                </button>
              </div>

              <div v-else-if="error" class="cd-share-baidu-error cd-share-baidu-error--center">{{ error }}</div>
            </div>
          </div>
        </div>

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
            <span>微信: {{ LOGIN_FOOTER_WECHAT }}</span>
            <template v-if="loginFooterIcp">
              <span class="cd-login-footer-sep">|</span>
              <span>{{ loginFooterIcp }}</span>
            </template>
          </p>
        </footer>
      </div>

      <aside class="cd-share-gate-ad" aria-label="推广">
        <component
          :is="shareAdLinkUrl ? 'a' : 'div'"
          class="cd-share-gate-ad-link"
          :href="shareAdLinkUrl || undefined"
          :target="shareAdLinkUrl ? '_blank' : undefined"
          :rel="shareAdLinkUrl ? 'noopener noreferrer' : undefined"
        >
          <img
            v-if="shareAdImageUrl && !adImageBroken"
            :src="shareAdImageUrl"
            alt=""
            class="cd-share-gate-ad-img"
            @error="adImageBroken = true"
          />
          <div v-else class="cd-share-gate-ad-img cd-share-gate-ad-img--placeholder">
            <span class="cd-share-gate-ad-placeholder-title">推广位</span>
            <span class="cd-share-gate-ad-placeholder-desc">可在外观设置中配置广告图片</span>
          </div>
        </component>
      </aside>
    </div>

    <div class="toast-host toast-host--global" :class="{ show: toast.visible.value }">
      {{ toast.message.value }}
    </div>
  </div>
</template>
