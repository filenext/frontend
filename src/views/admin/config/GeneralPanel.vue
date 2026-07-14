<script setup lang="ts">
import { ref } from 'vue'
import { ApiError } from '@/api/client'
import * as settingsApi from '@/api/settings'
import { useToast } from '@/composables/useToast'
import { usePageSize } from '@/composables/usePageSize'

const toast = useToast()
const { invalidatePageSize } = usePageSize()
const form = defineModel<{ page_size: number; local_files_root: string }>({ required: true })
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    const n = Math.max(1, Math.min(200, form.value.page_size || 20))
    const root = (form.value.local_files_root || '').trim()
    form.value = await settingsApi.saveSettings('general', {
      page_size: n,
      local_files_root: root,
    })
    invalidatePageSize()
    toast.show('已保存')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">常规</h3>
    <p class="text-secondary small mb-4">全局列表分页与系统本地文件根目录。</p>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label">每页条数</label>
        <input v-model.number="form.page_size" type="number" min="1" max="200" class="form-control" />
        <div class="form-hint">影响用户、日志、存储源等列表（1–200）</div>
      </div>
      <div class="col-12">
        <label class="form-label">本地文件根目录</label>
        <input
          v-model="form.local_files_root"
          type="text"
          class="form-control font-monospace"
          placeholder="例如 /data/files 或 D:/"
        />
        <div class="form-hint">
          仅影响默认「本地存储」的文件浏览根路径。Windows 可填
          <code>D:/</code>。头像、分片临时目录、版本备份仍使用程序目录下的
          <code>data/</code>，互不影响。
        </div>
      </div>
    </div>
    <div class="cd-settings-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
