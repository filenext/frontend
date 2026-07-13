<script setup lang="ts">
import { ref } from 'vue'
import { ApiError } from '@/api/client'
import * as settingsApi from '@/api/settings'
import type { LDAPSettings } from '@/api/settings'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const form = defineModel<LDAPSettings>({ required: true })
const saving = ref(false)
const testing = ref(false)

async function save() {
  saving.value = true
  try {
    form.value = await settingsApi.saveSettings('ldap', form.value)
    toast.show('LDAP 配置已保存')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function testConn() {
  testing.value = true
  try {
    await settingsApi.saveSettings('ldap', form.value)
    await settingsApi.testLDAP()
    toast.show('LDAP 连接成功')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '连接失败')
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">LDAP / 域集成</h3>
    <p class="text-secondary small mb-4">启用后登录将尝试 LDAP 认证，并自动创建本地账号映射。</p>

    <label class="form-check form-switch mb-4">
      <input v-model="form.enabled" class="form-check-input" type="checkbox" />
      <span class="form-check-label">启用 LDAP 登录</span>
    </label>

    <div class="row g-3">
      <div class="col-md-6"><label class="form-label">主机</label><input v-model="form.host" class="form-control" placeholder="ldap.example.com" /></div>
      <div class="col-md-3"><label class="form-label">端口</label><input v-model.number="form.port" type="number" class="form-control" /></div>
      <div class="col-md-3 d-flex align-items-end">
        <label class="form-check"><input v-model="form.use_tls" type="checkbox" class="form-check-input" /><span class="form-check-label">LDAPS</span></label>
      </div>
      <div class="col-md-6"><label class="form-label">Bind DN</label><input v-model="form.bind_dn" class="form-control" /></div>
      <div class="col-md-6"><label class="form-label">Bind 密码</label><input v-model="form.bind_pass" type="password" class="form-control" /></div>
      <div class="col-12"><label class="form-label">Base DN</label><input v-model="form.base_dn" class="form-control" placeholder="dc=example,dc=com" /></div>
      <div class="col-md-4"><label class="form-label">用户过滤器</label><input v-model="form.user_filter" class="form-control" placeholder="(uid=%s)" /></div>
      <div class="col-md-4"><label class="form-label">用户名字段</label><input v-model="form.username_attr" class="form-control" /></div>
      <div class="col-md-4"><label class="form-label">邮箱字段</label><input v-model="form.email_attr" class="form-control" /></div>
    </div>

    <div class="cd-settings-actions d-flex gap-2">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
      <button type="button" class="btn btn-outline-secondary" :disabled="testing" @click="testConn">
        {{ testing ? '测试中…' : '测试连接' }}
      </button>
    </div>
  </div>
</template>
