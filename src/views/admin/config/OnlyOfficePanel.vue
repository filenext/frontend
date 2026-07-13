<script setup lang="ts">
import { ref } from 'vue'
import { ApiError } from '@/api/client'
import * as settingsApi from '@/api/settings'
import type { OnlyOfficeSettings } from '@/api/settings'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const form = defineModel<OnlyOfficeSettings>({ required: true })
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    form.value = await settingsApi.saveSettings('onlyoffice', form.value)
    toast.show('ONLYOFFICE 配置已保存')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">ONLYOFFICE 文档编辑</h3>
    <p class="text-secondary small mb-4">
      配置 Document Server 地址与 JWT。保存文档时自动保留最近
      {{ form.version_keep || 5 }} 个历史版本。
    </p>

    <label class="form-check form-switch mb-4">
      <input v-model="form.enabled" class="form-check-input" type="checkbox" />
      <span class="form-check-label">启用在线编辑</span>
    </label>

    <div class="row g-3">
      <div class="col-12">
        <label class="form-label">Document Server URL</label>
        <input v-model="form.server_url" class="form-control" placeholder="https://documentserver.example.com" />
      </div>
      <div class="col-md-8">
        <label class="form-label">JWT Secret（与 Document Server 一致，可留空）</label>
        <input v-model="form.jwt_secret" type="password" class="form-control" />
      </div>
      <div class="col-md-4">
        <label class="form-label">保留版本数</label>
        <input v-model.number="form.version_keep" type="number" min="1" max="20" class="form-control" />
      </div>
    </div>

    <div class="alert alert-info mt-4 mb-0 small">
      支持 Word / Excel / PowerPoint 等 Office 格式。请确保 Document Server 能访问本系统的文件下载回调地址。
    </div>

    <div class="cd-settings-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
