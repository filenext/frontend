<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { IconCopy, IconLink, IconPackage } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as filesApi from '@/api/files'
import * as sharesApi from '@/api/shares'
import {
  PICKUP_EXPIRY_OPTIONS,
  SHARE_EXPIRY_OPTIONS,
  buildShareCopyText,
  publicPickupPageUrl,
  publicSharePageUrl,
} from '@/api/shares'
import type { FileEntry } from '@/types/files'
import CdModal from '@/components/CdModal.vue'
import FileTypeIcon from '@/components/FileTypeIcon.vue'
import { useToast } from '@/composables/useToast'
import { useBrandingStore } from '@/stores/branding'
import { copyToClipboard } from '@/utils/clipboard'

const props = defineProps<{
  show: boolean
  item: FileEntry | null
  storageId: string
  usesCloudShare?: boolean
  canBaiduShare?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const branding = useBrandingStore()

type Tab = 'link' | 'pickup'

const tab = ref<Tab>('link')
const syncing = ref(false)

const isPublic = ref(false)
const sharePasswordInput = ref('')
const expiryDays = ref(7)

const shareToken = ref('')
const shareLink = ref('')
const sharePassword = ref('')
const shareIsCloud = ref(false)
const shareExpiresAt = ref('')

const pickupCode = ref('')
const pickupShareToken = ref('')
const pickupExpiresAt = ref('')
const pickupCountdown = ref(0)
const pickupExpiryMinutes = ref(5)
let pickupTimer: ReturnType<typeof setInterval> | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncVersion = 0

const qrCanvas = ref<HTMLCanvasElement | null>(null)
const pickupQrCanvas = ref<HTMLCanvasElement | null>(null)

const itemName = computed(() => props.item?.name || '')
const itemIsDir = computed(() => props.item?.isDir ?? false)
const itemMime = computed(() => props.item?.mimeType)

const expiryLabel = computed(() => {
  if (tab.value === 'pickup') {
    const opt = PICKUP_EXPIRY_OPTIONS.find((o) => o.minutes === pickupExpiryMinutes.value)
    return opt?.label || `${pickupExpiryMinutes.value} 分钟`
  }
  const opt = SHARE_EXPIRY_OPTIONS.find((o) => o.days === expiryDays.value)
  return opt?.label || '自定义'
})

const effectivePassword = computed(() => {
  if (isPublic.value) return ''
  const input = sharesApi.normalizeSharePassword(sharePasswordInput.value)
  return input || sharePassword.value || ''
})

const displayLink = computed(() => {
  if (shareIsCloud.value) return shareLink.value
  if (shareToken.value) {
    return sharesApi.publicSharePageUrl(
      shareToken.value,
      effectivePassword.value || undefined,
      isPublic.value,
    )
  }
  return shareLink.value
})

const shareCopyText = computed(() =>
  buildShareCopyText({
    link: displayLink.value,
    token: shareToken.value || undefined,
    password: effectivePassword.value || undefined,
    isPublic: isPublic.value,
    fileName: itemName.value,
    siteName: branding.settings.site_name,
    tagline: `${branding.settings.site_name} AI + 智能体 · 企业级文件安全`,
  }),
)

function resetState() {
  tab.value = 'link'
  isPublic.value = false
  sharePasswordInput.value = sharesApi.randomAccessCode(4)
  expiryDays.value = 7
  shareToken.value = ''
  shareLink.value = ''
  sharePassword.value = ''
  shareIsCloud.value = false
  shareExpiresAt.value = ''
  pickupCode.value = ''
  pickupShareToken.value = ''
  pickupExpiresAt.value = ''
  pickupCountdown.value = 0
  pickupExpiryMinutes.value = 5
  stopPickupTimer()
  clearSyncTimer()
}

function clearSyncTimer() {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
}

function stopPickupTimer() {
  if (pickupTimer) {
    clearInterval(pickupTimer)
    pickupTimer = null
  }
}

function startPickupTimer(expiresAt: string) {
  stopPickupTimer()
  const tick = () => {
    const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    pickupCountdown.value = left
    if (left <= 0) stopPickupTimer()
  }
  tick()
  pickupTimer = setInterval(tick, 1000)
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      resetState()
      scheduleLinkSync(0)
    } else {
      stopPickupTimer()
      clearSyncTimer()
    }
  },
)

watch(isPublic, (v) => {
  if (!v && !sharePasswordInput.value.trim()) {
    sharePasswordInput.value = sharesApi.randomAccessCode(4)
  }
  // 切换公开/密码时必须重建分享，否则链接样式与后端 token 不一致
  scheduleLinkSync(v ? 0 : undefined)
})

watch([expiryDays], () => {
  if (props.show && tab.value === 'link') scheduleLinkSync()
})

watch(pickupExpiryMinutes, () => {
  if (props.show && tab.value === 'pickup') void ensurePickupTab(true, false)
})

watch([sharePasswordInput, isPublic, displayLink], async () => {
  if (!props.show || tab.value !== 'link' || !displayLink.value) return
  await nextTick()
  await renderQR(displayLink.value, qrCanvas.value)
})

watch(tab, (v) => {
  if (v === 'link') {
    if (props.show && !shareToken.value && !shareLink.value) {
      scheduleLinkSync(0)
    } else if (displayLink.value) {
      nextTick().then(() => renderQR(displayLink.value, qrCanvas.value))
    }
  }
  if (v === 'pickup' && props.show) {
    void ensurePickupTab()
  }
})

function scheduleLinkSync(delay = 450) {
  clearSyncTimer()
  if (!props.show || tab.value !== 'link' || !props.item) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    void syncLinkShare()
  }, delay)
}

async function renderQR(text: string, canvas: HTMLCanvasElement | null) {
  if (!canvas || !text) return
  await QRCode.toCanvas(canvas, text, { width: 168, margin: 1 })
}

async function copyText(text: string, msg = '已复制') {
  if (await copyToClipboard(text)) {
    toast.show(msg)
  } else {
    toast.show('复制失败，请手动选择复制')
  }
}

function shouldFallbackFromBaiduShare(err: unknown) {
  if (!(err instanceof ApiError)) return true
  const msg = err.message
  return msg.includes('share') || msg.includes('分享') || msg.includes('errno=2')
}

async function syncLinkShare() {
  if (!props.item) return
  const ver = ++syncVersion
  syncing.value = true
  try {
    if (props.usesCloudShare && props.canBaiduShare) {
      try {
        const res = await filesApi.createCloudShare(props.storageId, props.item.path, {
          periodDays: expiryDays.value || 7,
        })
        if (ver !== syncVersion) return
        shareLink.value = res.short_url || res.link
        sharePassword.value = res.password || ''
        shareIsCloud.value = true
        shareToken.value = ''
        shareExpiresAt.value = ''
        await nextTick()
        await renderQR(displayLink.value, qrCanvas.value)
        return
      } catch (e) {
        if (!shouldFallbackFromBaiduShare(e)) throw e
        toast.show('百度原生分享不可用，已改用平台分享')
      }
    }

    const pwd = isPublic.value ? '' : sharePasswordInput.value.trim().toUpperCase()
    const res = await sharesApi.createShare({
      storage_id: props.storageId,
      path: props.item.path,
      is_public: isPublic.value,
      password: pwd,
      expires_days: expiryDays.value,
    })
    if (ver !== syncVersion) return

    shareToken.value = res.token
    sharePassword.value = res.password || ''
    if (res.password && !isPublic.value) {
      sharePasswordInput.value = res.password
    }
    shareLink.value = sharesApi.publicSharePageUrl(res.token, undefined, isPublic.value)
    shareIsCloud.value = false
    shareExpiresAt.value = res.expires_at || ''
    await nextTick()
    await renderQR(displayLink.value, qrCanvas.value)
  } catch (e) {
    if (ver === syncVersion) {
      toast.show(e instanceof ApiError ? e.message : '生成分享失败')
    }
  } finally {
    if (ver === syncVersion) syncing.value = false
  }
}

async function applyPickupResult(code: string, expiresAt: string, shareToken?: string) {
  pickupCode.value = code
  pickupShareToken.value = shareToken || ''
  pickupExpiresAt.value = expiresAt
  startPickupTimer(expiresAt)
  await nextTick()
  const link = pickupShareToken.value
    ? publicSharePageUrl(pickupShareToken.value, undefined, true)
    : publicPickupPageUrl(code)
  await renderQR(link, pickupQrCanvas.value)
}

async function fetchActivePickup() {
  if (!props.item) return false
  const active = await sharesApi.getActivePickup({
    storage_id: props.storageId,
    path: props.item.path,
  })
  if (!active.active || !active.code || !active.expires_at) return false
  await applyPickupResult(active.code, active.expires_at, active.share_token)
  return true
}

async function createPickupShare(copyOnCreate = false) {
  if (!props.item) return
  const res = await sharesApi.createPickup({
    storage_id: props.storageId,
    path: props.item.path,
    expires_minutes: pickupExpiryMinutes.value,
  })
  await applyPickupResult(res.code, res.expires_at, res.share_token)
  if (copyOnCreate) await copyText(res.code, '取件码已复制')
}

const pickupPageLink = computed(() =>
  pickupShareToken.value
    ? publicSharePageUrl(pickupShareToken.value, undefined, true)
    : pickupCode.value
      ? publicPickupPageUrl(pickupCode.value)
      : '',
)

async function ensurePickupTab(regenerate = false, copyOnCreate = regenerate) {
  if (!props.item || !props.show) return
  if (!regenerate && pickupCode.value && pickupCountdown.value > 0) {
    await nextTick()
    await renderQR(publicPickupPageUrl(pickupCode.value), pickupQrCanvas.value)
    return
  }
  syncing.value = true
  try {
    if (!regenerate && (await fetchActivePickup())) return
    await createPickupShare(copyOnCreate)
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : regenerate ? '重新生成失败' : '生成取件码失败')
  } finally {
    syncing.value = false
  }
}

function copyShareAll() {
  copyText(shareCopyText.value, '分享信息已复制')
}

function formatCountdown(sec: number) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m}:${String(s).padStart(2, '0')}`
}

function genRandomPassword() {
  sharePasswordInput.value = sharesApi.randomAccessCode(4)
}
</script>

<template>
  <CdModal :show="show" title="分享文件" size="lg" @close="emit('close')">
    <div class="modal-body cd-share-modal">
      <div v-if="itemName" class="cd-share-file-head">
        <FileTypeIcon :name="itemName" :is-dir="itemIsDir" :mime-type="itemMime" :size="28" />
        <div class="cd-share-file-meta min-w-0">
          <div class="cd-share-file-title text-truncate">{{ itemName }}</div>
          <div class="text-secondary small">
            {{ itemIsDir ? '分享文件夹后，访客可浏览子目录并下载文件或打包下载' : '设置有效期与访问方式后，生成链接或取件码' }}
          </div>
        </div>
      </div>

      <nav class="nav nav-segmented cd-share-mode-nav mb-3" role="tablist">
        <button
          type="button"
          class="nav-link"
          :class="{ active: tab === 'link' }"
          role="tab"
          :aria-selected="tab === 'link'"
          @click="tab = 'link'"
        >
          <IconLink :size="16" :stroke="1.75" />
          链接分享
        </button>
        <button
          type="button"
          class="nav-link"
          :class="{ active: tab === 'pickup' }"
          role="tab"
          :aria-selected="tab === 'pickup'"
          @click="tab = 'pickup'"
        >
          <IconPackage :size="16" :stroke="1.75" />
          取件码
        </button>
      </nav>

      <!-- 链接分享 -->
      <template v-if="tab === 'link'">
        <div class="card cd-share-card mb-3">
          <div class="card-body">
            <label class="form-label">有效期</label>
            <nav class="nav nav-segmented cd-share-expiry-nav mb-3" role="tablist">
              <button
                v-for="opt in SHARE_EXPIRY_OPTIONS"
                :key="opt.label"
                type="button"
                class="nav-link"
                :class="{ active: expiryDays === opt.days }"
                :title="opt.label"
                role="tab"
                :aria-selected="expiryDays === opt.days"
                @click="expiryDays = opt.days"
              >
                {{ opt.shortLabel }}
              </button>
            </nav>

            <div class="cd-share-access-row">
              <label class="form-check mb-0 cd-share-access-check">
                <input v-model="isPublic" class="form-check-input" type="checkbox" />
                <span class="form-check-label">公开访问</span>
              </label>
              <template v-if="!isPublic">
                <span class="cd-share-access-divider" aria-hidden="true" />
                <span class="cd-share-access-label">分享密码</span>
                <div class="input-group input-group-sm cd-share-password-input">
                  <input
                    v-model="sharePasswordInput"
                    class="form-control font-monospace text-uppercase text-center"
                    maxlength="4"
                    placeholder="4位"
                    @input="sharePasswordInput = sharesApi.normalizeSharePassword(sharePasswordInput); scheduleLinkSync()"
                  />
                  <button type="button" class="btn btn-outline-secondary" @click="genRandomPassword">
                    换码
                  </button>
                </div>
              </template>
              <span v-else class="text-secondary small">无需密码，任何人可访问</span>
            </div>
          </div>
        </div>

        <div class="card cd-share-card" :class="{ 'cd-share-card--loading': syncing }">
          <div class="card-body cd-share-result">
            <div class="cd-share-qr-wrap">
              <canvas ref="qrCanvas" class="cd-share-qr" />
              <div class="text-secondary small mt-2">扫码打开分享</div>
            </div>
            <div class="cd-share-result-fields">
              <label class="form-label">分享内容</label>
              <textarea
                :value="shareCopyText"
                class="form-control form-control-sm cd-share-copy-text"
                rows="5"
                readonly
              />
              <div class="cd-share-result-foot">
                <div class="text-secondary small">
                  <span v-if="syncing">正在更新分享…</span>
                  <span v-else-if="shareIsCloud">已通过百度网盘 API 创建分享</span>
                  <span v-else-if="shareExpiresAt">
                    有效期至 <strong>{{ new Date(shareExpiresAt).toLocaleString() }}</strong>
                  </span>
                  <span v-else-if="displayLink"><strong>永久有效</strong></span>
                </div>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  :disabled="!shareCopyText || syncing"
                  @click="copyShareAll"
                >
                  <IconCopy :size="15" :stroke="1.75" />
                  复制分享信息
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 取件码 -->
      <template v-else>
        <div class="card cd-share-card mb-3">
          <div class="card-body">
            <label class="form-label">有效期</label>
            <nav class="nav nav-segmented cd-share-expiry-nav" role="tablist">
              <button
                v-for="opt in PICKUP_EXPIRY_OPTIONS"
                :key="opt.minutes"
                type="button"
                class="nav-link"
                :class="{ active: pickupExpiryMinutes === opt.minutes }"
                :title="opt.label"
                role="tab"
                :aria-selected="pickupExpiryMinutes === opt.minutes"
                :disabled="syncing"
                @click="pickupExpiryMinutes = opt.minutes"
              >
                {{ opt.shortLabel }}
              </button>
            </nav>
          </div>
        </div>

        <div v-if="syncing && !pickupCode" class="card cd-share-card">
          <div class="card-body text-center text-secondary py-5">正在生成取件码…</div>
        </div>

        <div v-else-if="pickupCode" class="card cd-share-card">
          <div class="card-body cd-share-pickup-head">
            <div class="text-secondary small mb-1">取件码 · {{ expiryLabel }}</div>
            <div class="cd-pickup-code">{{ pickupCode }}</div>
            <div class="text-secondary small">
              <span v-if="pickupCountdown > 0">剩余 {{ formatCountdown(pickupCountdown) }}</span>
              <span v-else class="text-danger">已过期，请重新生成</span>
            </div>
          </div>
          <div class="card-body border-top cd-share-result">
            <div class="cd-share-qr-wrap">
              <canvas ref="pickupQrCanvas" class="cd-share-qr" />
              <div class="text-secondary small mt-2">扫码取件</div>
            </div>
            <div class="cd-share-result-fields">
              <label class="form-label">分享页链接</label>
              <div class="input-group input-group-sm mb-3">
                <input :value="pickupPageLink" class="form-control" readonly />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="copyText(pickupPageLink, '分享页链接已复制')"
                >
                  <IconCopy :size="15" :stroke="1.75" />
                  复制
                </button>
              </div>
              <div class="cd-share-result-foot">
                <span class="text-secondary small">取件码单次有效，过期后需重新生成</span>
                <div class="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    @click="copyText(pickupCode, '取件码已复制')"
                  >
                    复制取件码
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    :disabled="syncing"
                    @click="ensurePickupTab(true)"
                  >
                    {{ syncing ? '生成中…' : '重新生成' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-sm" @click="emit('close')">关闭</button>
    </div>
  </CdModal>
</template>
