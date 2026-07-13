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
        <input
          v-model="form.server_url"
          class="form-control"
          placeholder="http://192.168.x.x:8081 或 https://documentserver.example.com"
        />
        <div class="form-hint">浏览器能打开的 Document Server 地址</div>
      </div>
      <div class="col-12">
        <label class="form-label">本系统回调地址（重要）</label>
        <input
          v-model="form.callback_base_url"
          class="form-control"
          placeholder="http://192.168.x.x:8080 或 http://nextfile.im-erp.com:8080"
        />
        <div class="form-hint">
          Document Server <strong>服务器</strong>访问 NextFile 的根地址（不要填 localhost）。用于下载原文与保存回调；留空则使用
          PUBLIC_BASE_URL 或当前请求 Host。
        </div>
      </div>
      <div class="col-md-8">
        <label class="form-label">JWT Secret（与 Document Server 一致，可留空）</label>
        <input v-model="form.jwt_secret" type="password" class="form-control" />
        <div class="form-hint">若 DS 启用了 JWT，此处必须与 DS 的 secret 完全一致，否则无法保存</div>
      </div>
      <div class="col-md-4">
        <label class="form-label">保留版本数</label>
        <input v-model.number="form.version_keep" type="number" min="1" max="20" class="form-control" />
      </div>
    </div>

    <div class="alert alert-warning mt-4 mb-0 small">
      <strong>出现「无法保存文档」时请检查：</strong>
      <ol class="mb-0 ps-3">
        <li>「本系统回调地址」填 DS 容器/机器能访问到的 NextFile 地址（局域网 IP 或域名，勿用 127.0.0.1）</li>
        <li>NextFile 进程能访问 Document Server URL（保存时要回拉编辑结果）</li>
        <li>JWT Secret 与 Document Server 配置一致（或两边都留空）</li>
      </ol>
    </div>

    <div class="cd-settings-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
