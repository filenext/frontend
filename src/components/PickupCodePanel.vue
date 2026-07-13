<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import { resolvePickupShareToken, extractPickupCode, publicSharePageUrl } from '@/api/shares'

const props = withDefaults(
  defineProps<{
    initialCode?: string
    autoSubmit?: boolean
  }>(),
  {
    initialCode: '',
    autoSubmit: false,
  },
)

const PICKUP_MIN_LEN = 5
const TIP_MS = 3000

const code = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const loading = ref(false)
const tipVisible = ref(false)
const tipMessage = ref('')
let tipTimer: ReturnType<typeof setTimeout> | null = null

function showTip(msg: string) {
  tipMessage.value = msg
  tipVisible.value = true
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => {
    tipVisible.value = false
  }, TIP_MS)
}

function hideTip() {
  if (tipTimer) clearTimeout(tipTimer)
  tipVisible.value = false
}

function normalizeCode(raw: string) {
  return extractPickupCode(raw) || raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

function canSubmit(value = code.value) {
  return value.length > 4
}

function openWidget() {
  if (open.value) return
  open.value = true
  hideTip()
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function closeWidget() {
  if (loading.value) return
  open.value = false
  hideTip()
}

function onBarClick() {
  if (!open.value) openWidget()
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (rootRef.value.contains(e.target as Node)) return
  closeWidget()
}

function onInput(e: Event) {
  hideTip()
  const input = e.target as HTMLInputElement
  const normalized = normalizeCode(input.value)
  code.value = normalized
  input.value = normalized
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  if (!open.value) openWidget()
  code.value = normalizeCode(e.clipboardData?.getData('text') || '')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeWidget()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    void submit()
  }
}

async function submit() {
  if (!open.value) {
    openWidget()
    return
  }
  const value = code.value.trim()
  if (!canSubmit(value)) {
    showTip(`请输入至少 ${PICKUP_MIN_LEN} 位取件码`)
    return
  }
  loading.value = true
  hideTip()
  try {
    const shareToken = await resolvePickupShareToken(value)
    const url = publicSharePageUrl(shareToken, undefined, true)
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      showTip('无法打开新窗口，请检查浏览器是否拦截了弹出窗口')
      return
    }
    code.value = ''
    open.value = false
    hideTip()
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : '取件码无效或已过期'
    showTip(msg)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.initialCode,
  (v) => {
    if (!v) return
    code.value = normalizeCode(v)
    open.value = true
    if (props.autoSubmit && canSubmit(code.value)) void submit()
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('click', onDocClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true)
  if (tipTimer) clearTimeout(tipTimer)
})
</script>

<template>
  <div
    ref="rootRef"
    class="cd-pickup-float"
    :class="{ 'cd-pickup-float--open': open, 'cd-pickup-float--loading': loading }"
  >
    <form class="cd-pickup-bar" @submit.prevent="submit" @click="onBarClick">
      <span class="cd-pickup-bar-label" @click.stop="onBarClick">取件码</span>

      <div class="cd-pickup-bar-body">
        <input
          ref="inputRef"
          :value="code"
          class="cd-pickup-bar-input font-monospace"
          type="text"
          inputmode="text"
          autocomplete="off"
          placeholder="输入取件码"
          :disabled="loading"
          :tabindex="open ? 0 : -1"
          aria-label="取件码"
          @focus="openWidget"
          @input="onInput"
          @paste="onPaste"
          @keydown="onKeydown"
          @click.stop
        />
        <button
          type="submit"
          class="cd-pickup-bar-action"
          :disabled="loading || !canSubmit()"
          @click.stop
        >
          {{ loading ? '…' : '打开' }}
        </button>
      </div>
    </form>
  </div>

  <Teleport to="body">
    <div class="cd-pickup-tip" :class="{ 'cd-pickup-tip--show': tipVisible }">{{ tipMessage }}</div>
  </Teleport>
</template>
