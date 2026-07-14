<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@/api/client'
import { useBrandingStore } from '@/stores/branding'
import { COLOR_PRESETS, DEFAULT_BRANDING, type BrandingSettings } from '@/types/branding'
import { useToast } from '@/composables/useToast'
import AppBrand from '@/components/AppBrand.vue'

const branding = useBrandingStore()
const toast = useToast()
const saving = ref(false)

const form = ref<BrandingSettings>({
  site_name: '',
  tagline: '',
  primary_color: '#2563eb',
  logo_url: '',
  favicon_url: '',
  logo_text: '',
  login_description: '',
  footer_powered_by_name: '',
  footer_icp: '',
  share_ad_image_url: '',
  share_ad_url: '',
  pickup_enabled: 'true',
})

const previewStyle = computed(() => ({
  background: `linear-gradient(135deg, ${form.value.primary_color} 0%, color-mix(in srgb, ${form.value.primary_color} 70%, #0f172a) 100%)`,
}))

function loadForm() {
  form.value = { ...DEFAULT_BRANDING, ...branding.settings }
}

async function save() {
  saving.value = true
  try {
    await branding.save({ ...form.value })
    toast.show('外观已保存')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function pickPreset(color: string) {
  form.value.primary_color = color
}

function readImageFile(e: Event, field: 'logo_url' | 'favicon_url') {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 256 * 1024) {
    toast.show('图片请小于 256KB')
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.value[field] = String(reader.result || '')
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function clearImage(field: 'logo_url' | 'favicon_url') {
  form.value[field] = ''
}

onMounted(loadForm)
</script>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">品牌与主题</h3>
    <p class="text-secondary small mb-4">系统名称、主题色、登录页与分享页展示，以及取件码入口开关。</p>

    <div class="row g-4">
      <div class="col-lg-7">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">系统名称</label>
            <input v-model="form.site_name" class="form-control" maxlength="32" />
          </div>
          <div class="col-md-6">
            <label class="form-label">副标题</label>
            <input
              v-model="form.tagline"
              class="form-control"
              maxlength="64"
              placeholder="如：统一文件管理 · 智能体"
            />
          </div>
          <div class="col-md-6">
            <label class="form-label">Logo 文字（无图片时显示 1–2 字）</label>
            <input
              v-model="form.logo_text"
              class="form-control"
              maxlength="2"
              placeholder="留空则用默认图标"
            />
          </div>
          <div class="col-md-6">
            <label class="form-label">主题色</label>
            <div class="input-group">
              <input v-model="form.primary_color" type="color" class="form-control form-control-color" />
              <input v-model="form.primary_color" class="form-control font-monospace" maxlength="7" />
            </div>
          </div>
          <div class="col-12">
            <label class="form-label">登录页介绍</label>
            <textarea
              v-model="form.login_description"
              class="form-control"
              rows="2"
              maxlength="256"
              placeholder="登录页左侧简介，例如：支持本地与多云接入，并可经开放协议对外访问"
            />
          </div>
        </div>

        <hr class="my-4" />
        <h4 class="mb-3">取件码</h4>
        <label class="form-check">
          <input
            v-model="form.pickup_enabled"
            class="form-check-input"
            type="checkbox"
            true-value="true"
            false-value="false"
          />
          <span class="form-check-label">启用取件码入口</span>
        </label>
        <p class="text-secondary small mb-0 mt-1">
          开启后，登录页与文件管理页顶部会显示取件码输入框；输入后跳转至分享详情页。
        </p>

        <hr class="my-4" />
        <h4 class="mb-3">分享页</h4>
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label">广告图片</label>
            <input
              v-model="form.share_ad_image_url"
              class="form-control"
              maxlength="512"
              placeholder="https://… 显示在带密码分享页右侧全屏区域"
            />
            <p class="text-secondary small mb-0 mt-1">留空则显示默认推广位占位</p>
          </div>
          <div class="col-12">
            <label class="form-label">广告 URL</label>
            <input
              v-model="form.share_ad_url"
              class="form-control"
              maxlength="512"
              placeholder="https://… 点击广告图时跳转"
            />
            <p class="text-secondary small mb-0 mt-1">留空则广告图不可点击</p>
          </div>
        </div>

        <hr class="my-4" />
        <h4 class="mb-3">登录页页脚</h4>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">名称</label>
            <input
              v-model="form.footer_powered_by_name"
              class="form-control"
              maxlength="32"
              placeholder="NextFile"
            />
          </div>
          <div class="col-md-6">
            <label class="form-label">ICP 备案号</label>
            <input
              v-model="form.footer_icp"
              class="form-control"
              maxlength="64"
              placeholder="如：京ICP备1xx，留空则不显示"
            />
          </div>
          <div class="col-12">
            <p class="text-secondary small mb-0">链接与微信已固定为 GitHub 仓库与 amwahaha，不可修改。</p>
          </div>
        </div>

        <div class="mt-3">
          <label class="form-label d-block mb-2">快捷配色</label>
          <div class="cd-color-presets">
            <button
              v-for="p in COLOR_PRESETS"
              :key="p.value"
              type="button"
              class="cd-color-chip"
              :class="{ active: form.primary_color === p.value }"
              :style="{ background: p.value }"
              :title="p.name"
              @click="pickPreset(p.value)"
            />
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-md-6">
            <label class="form-label">Logo 图片</label>
            <input
              type="file"
              accept="image/*"
              class="form-control form-control-sm"
              @change="readImageFile($event, 'logo_url')"
            />
            <button
              v-if="form.logo_url"
              type="button"
              class="btn btn-sm btn-link px-0 mt-1"
              @click="clearImage('logo_url')"
            >
              清除 Logo
            </button>
          </div>
          <div class="col-md-6">
            <label class="form-label">Favicon</label>
            <input
              type="file"
              accept="image/*"
              class="form-control form-control-sm"
              @change="readImageFile($event, 'favicon_url')"
            />
            <button
              v-if="form.favicon_url"
              type="button"
              class="btn btn-sm btn-link px-0 mt-1"
              @click="clearImage('favicon_url')"
            >
              清除 Favicon
            </button>
          </div>
        </div>

        <div class="cd-settings-actions">
          <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存设置' }}
          </button>
          <button type="button" class="btn" @click="loadForm">重置</button>
        </div>
      </div>

      <div class="col-lg-5">
        <div class="card cd-preview-card overflow-hidden">
          <div class="cd-preview-banner" :style="previewStyle">
            <AppBrand size="lg" show-tagline />
          </div>
          <div class="card-body">
            <p class="text-secondary small mb-3">实时预览登录页与顶栏效果</p>
            <div class="cd-preview-navbar mb-3">
              <span class="cd-brand-mark cd-brand-mark-sm">
                <img v-if="form.logo_url" :src="form.logo_url" alt="" class="cd-brand-img" />
                <span v-else-if="form.logo_text" class="cd-brand-text">{{ form.logo_text.slice(0, 2) }}</span>
                <span v-else class="cd-brand-dot" :style="{ background: form.primary_color }" />
              </span>
              <span class="fw-semibold">{{ form.site_name || 'NextFile' }}</span>
              <span class="ms-auto badge" :style="{ background: form.primary_color, color: '#fff' }">主题色</span>
            </div>
            <button
              type="button"
              class="btn btn-sm w-100"
              :style="{
                background: form.primary_color,
                borderColor: form.primary_color,
                color: '#fff',
              }"
            >
              主按钮示例
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
  </div>
</template>
