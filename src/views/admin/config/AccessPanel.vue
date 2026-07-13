<script setup lang="ts">
import { ref } from 'vue'
import { ApiError } from '@/api/client'
import * as settingsApi from '@/api/settings'
import type { AccessSettings } from '@/api/settings'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const form = defineModel<AccessSettings>({ required: true })
const saving = ref(false)
const ipInput = ref('')
const uaInput = ref('')

function addIP() {
  const v = ipInput.value.trim()
  if (!v) return
  if (!form.value.ip_blacklist.includes(v)) form.value.ip_blacklist.push(v)
  ipInput.value = ''
}

function addUA() {
  const v = uaInput.value.trim()
  if (!v) return
  if (!form.value.ua_blacklist.includes(v)) form.value.ua_blacklist.push(v)
  uaInput.value = ''
}

function removeIP(i: number) {
  form.value.ip_blacklist.splice(i, 1)
}

function removeUA(i: number) {
  form.value.ua_blacklist.splice(i, 1)
}

async function save() {
  saving.value = true
  try {
    form.value = await settingsApi.saveSettings('access', form.value)
    toast.show('访问控制已保存')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">访问控制</h3>
    <p class="text-secondary small mb-4">匹配客户端 IP 或 User-Agent 子串时拒绝访问 API。</p>

    <div class="cd-settings-section">
      <h4>IP 黑名单</h4>
      <div class="input-group mb-2">
        <input v-model="ipInput" class="form-control" placeholder="如 192.168.1.100 或 10.0." @keyup.enter="addIP" />
        <button type="button" class="btn btn-outline-primary" @click="addIP">添加</button>
      </div>
      <div class="cd-tag-list">
        <span v-for="(ip, i) in form.ip_blacklist" :key="ip" class="cd-tag">
          {{ ip }}
          <button type="button" class="cd-tag-remove" @click="removeIP(i)">×</button>
        </span>
        <span v-if="!form.ip_blacklist.length" class="text-secondary small">暂无</span>
      </div>
    </div>

    <div class="cd-settings-section">
      <h4>UA 黑名单</h4>
      <div class="input-group mb-2">
        <input v-model="uaInput" class="form-control" placeholder="如 curl、bot、scanner" @keyup.enter="addUA" />
        <button type="button" class="btn btn-outline-primary" @click="addUA">添加</button>
      </div>
      <div class="cd-tag-list">
        <span v-for="(ua, i) in form.ua_blacklist" :key="ua" class="cd-tag">
          {{ ua }}
          <button type="button" class="cd-tag-remove" @click="removeUA(i)">×</button>
        </span>
        <span v-if="!form.ua_blacklist.length" class="text-secondary small">暂无</span>
      </div>
    </div>

    <div class="cd-settings-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
