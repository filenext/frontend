<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { IconUpload, IconTrash } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as avatarsApi from '@/api/avatars'
import CdAvatar from '@/components/CdAvatar.vue'
import type { AvatarKind } from '@/utils/avatar'

const props = withDefaults(
  defineProps<{
    kind: AvatarKind
    avatarUrl?: string | null
    name?: string
    disabled?: boolean
    /** user: 本人; user-admin: 管理用户; agent: 管理智能体 */
    mode?: 'self' | 'user-admin' | 'agent'
    targetId?: number | string
    /** 预设头像显示在主头像右侧 */
    presetsAside?: boolean
  }>(),
  { avatarUrl: null, name: '', disabled: false, mode: 'self', presetsAside: false },
)

const emit = defineEmits<{
  updated: [url: string | null]
}>()

const current = ref<string | null>(props.avatarUrl)
const presets = ref<{ name: string; url: string }[]>([])
const uploading = ref(false)
const err = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

watch(
  () => props.avatarUrl,
  (v) => {
    current.value = v
  },
)

onMounted(async () => {
  try {
    const res = await avatarsApi.listAvatarPresets(props.kind)
    presets.value = res.items
  } catch {
    presets.value = []
  }
})

function pickFile() {
  if (props.disabled || uploading.value) return
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  err.value = ''
  uploading.value = true
  try {
    let avatarUrl: string | null = null
    if (props.mode === 'user-admin' && props.targetId) {
      const res = await avatarsApi.uploadUserAvatarAdmin(Number(props.targetId), file)
      avatarUrl = res.avatar_url ?? null
    } else if (props.mode === 'agent' && props.targetId) {
      const res = await avatarsApi.uploadAgentAvatar(String(props.targetId), file)
      avatarUrl = res.avatar_url ?? null
    } else {
      const res = await avatarsApi.uploadUserAvatar(file)
      avatarUrl = res.avatar_url ?? null
    }
    current.value = avatarUrl
    emit('updated', current.value)
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : '上传失败'
  } finally {
    uploading.value = false
  }
}

async function selectPreset(preset: string) {
  if (props.disabled || uploading.value) return
  err.value = ''
  uploading.value = true
  try {
    let avatarUrl: string | null = null
    if (props.mode === 'user-admin' && props.targetId) {
      const res = await avatarsApi.setUserAvatarPresetAdmin(Number(props.targetId), preset)
      avatarUrl = res.avatar_url ?? null
    } else if (props.mode === 'agent' && props.targetId) {
      const res = await avatarsApi.setAgentAvatarPreset(String(props.targetId), preset)
      avatarUrl = res.avatar_url ?? null
    } else {
      const res = await avatarsApi.setUserAvatarPreset(preset)
      avatarUrl = res.avatar_url ?? null
    }
    current.value = avatarUrl
    emit('updated', current.value)
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : '设置失败'
  } finally {
    uploading.value = false
  }
}

async function clearAvatar() {
  if (props.disabled || uploading.value) return
  err.value = ''
  uploading.value = true
  try {
    if (props.mode === 'user-admin' && props.targetId) {
      await avatarsApi.deleteUserAvatarAdmin(Number(props.targetId))
    } else if (props.mode === 'agent' && props.targetId) {
      await avatarsApi.deleteAgentAvatar(String(props.targetId))
    } else {
      await avatarsApi.deleteUserAvatar()
    }
    current.value = null
    emit('updated', null)
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : '操作失败'
  } finally {
    uploading.value = false
  }
}

function isSelected(url: string) {
  return current.value === url
}
</script>

<template>
  <div class="cd-avatar-picker" :class="{ 'cd-avatar-picker--aside': presetsAside }">
    <div class="cd-avatar-picker-main">
      <CdAvatar :src="current" :name="name" :kind="kind" size="lg" />
      <div class="cd-avatar-picker-actions">
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="disabled || uploading"
          @click="pickFile"
        >
          <IconUpload :size="14" class="me-1" />
          {{ uploading ? '处理中…' : '上传图片' }}
        </button>
        <button
          v-if="current"
          type="button"
          class="btn btn-sm btn-ghost-secondary"
          :disabled="disabled || uploading"
          @click="clearAvatar"
        >
          <IconTrash :size="14" class="me-1" />
          恢复默认
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          class="d-none"
          @change="onFileChange"
        />
        <p v-if="!presetsAside" class="text-secondary small mb-0">支持 jpg、png、webp，最大 2MB</p>
      </div>
    </div>

    <div v-if="presets.length" class="cd-avatar-picker-presets">
      <div class="cd-avatar-picker-label">{{ presetsAside ? '预设头像' : '或选择预设头像' }}</div>
      <div class="cd-avatar-picker-grid">
        <button
          v-for="p in presets"
          :key="p.name"
          type="button"
          class="cd-avatar-preset-btn"
          :class="{ active: isSelected(p.url) }"
          :disabled="disabled || uploading"
          :title="p.name"
          @click="selectPreset(p.name)"
        >
          <img :src="p.url" :alt="p.name" />
        </button>
        <button
          type="button"
          class="cd-avatar-preset-btn"
          :class="{ active: !current }"
          :disabled="disabled || uploading"
          :title="kind === 'agent' ? '默认智能体图标' : '姓名首字'"
          @click="clearAvatar"
        >
          <CdAvatar :name="name" :kind="kind" size="sm" />
        </button>
      </div>
      <p v-if="presetsAside" class="text-secondary small mb-0 mt-2">支持 jpg、png、webp，最大 2MB</p>
    </div>

    <div v-if="err" class="cd-avatar-picker-error text-danger small">{{ err }}</div>
  </div>
</template>

<style scoped>
.cd-avatar-picker-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cd-avatar-picker-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
}

.cd-avatar-picker-presets {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--tblr-border-color);
}

.cd-avatar-picker--aside {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.cd-avatar-picker--aside .cd-avatar-picker-main {
  flex-shrink: 0;
}

.cd-avatar-picker--aside .cd-avatar-picker-presets {
  flex: 1;
  min-width: 10rem;
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.cd-avatar-picker--aside .cd-avatar-picker-error {
  flex-basis: 100%;
  margin-top: 0.25rem;
}

.cd-avatar-picker-label {
  font-size: 0.8125rem;
  color: var(--tblr-secondary);
  margin-bottom: 0.5rem;
}

.cd-avatar-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cd-avatar-preset-btn {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cd-avatar-preset-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cd-avatar-preset-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.cd-avatar-preset-btn.active {
  border-color: var(--tblr-primary);
}

.cd-avatar-preset-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
