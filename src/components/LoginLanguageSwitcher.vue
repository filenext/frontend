<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALE_OPTIONS, LOCALE_STORAGE_KEY, type AppLocale, setDocumentLang } from '@/i18n'

const NATIVE_LABELS: Record<AppLocale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
  'zh-TW': '繁體中文',
}

const { locale } = useI18n()
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const currentLabel = computed(() => NATIVE_LABELS[locale.value as AppLocale])

const otherOptions = computed(() =>
  LOCALE_OPTIONS.filter((opt) => opt.value !== locale.value).map((opt) => ({
    value: opt.value,
    label: NATIVE_LABELS[opt.value],
  })),
)

function toggle() {
  open.value = !open.value
}

function setLocale(val: AppLocale) {
  locale.value = val
  localStorage.setItem(LOCALE_STORAGE_KEY, val)
  setDocumentLang(val)
  open.value = false
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value || !rootEl.value) return
  if (!rootEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('pointerdown', onDocPointerDown))
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointerDown))
</script>

<template>
  <div ref="rootEl" class="cd-login-lang" :class="{ 'cd-login-lang--open': open }">
    <button
      type="button"
      class="cd-login-lang-current"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggle"
    >
      {{ currentLabel }}
    </button>
    <span class="cd-login-lang-menu" role="menu" :aria-label="currentLabel">
      <button
        v-for="opt in otherOptions"
        :key="opt.value"
        type="button"
        class="cd-login-lang-option"
        role="menuitem"
        @click="setLocale(opt.value)"
      >
        {{ opt.label }}
      </button>
    </span>
  </div>
</template>
