<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/api/client'
import * as permsApi from '@/api/permissions'
import type { AclRow, PermPreset } from '@/api/permissions'
import * as usersApi from '@/api/users'
import * as deptApi from '@/api/departments'
import CdModal from '@/components/CdModal.vue'
import { useToast } from '@/composables/useToast'
import type { FileEntry } from '@/types/files'
import {
  Perm,
  customFlagsFromMask,
  customMaskFromFlags,
  detectPreset,
  denyMaskForGrant,
  type PresetId,
} from '@/utils/permissions'

const props = defineProps<{
  show: boolean
  item: FileEntry | null
  storageId: string
}>()

const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const entries = ref<AclRow[]>([])
const presets = ref<PermPreset[]>([])
const users = ref<{ id: number; username: string; real_name?: string | null }[]>([])
const departments = ref<{ id: string; name: string }[]>([])

const showAdd = ref(false)
const form = ref({
  principal_type: 'user',
  principal_id: '',
  preset: 'view_only' as PresetId,
  customView: true,
  customEdit: false,
  customDelete: false,
  customShare: false,
  inherit: true,
})

const itemPath = computed(() => props.item?.path || '/')
const itemName = computed(() => props.item?.name || '')

const presetOptions = computed(() =>
  presets.value.filter((p) => p.id !== 'custom').concat(presets.value.filter((p) => p.id === 'custom')),
)

function resetForm() {
  form.value = {
    principal_type: 'user',
    principal_id: '',
    preset: 'view_only',
    customView: true,
    customEdit: false,
    customDelete: false,
    customShare: false,
    inherit: true,
  }
}

function resolvePermAllow(): number {
  if (form.value.preset === 'custom') {
    return customMaskFromFlags({
      view: form.value.customView,
      edit: form.value.customEdit,
      delete: form.value.customDelete,
      share: form.value.customShare,
    })
  }
  const preset = presets.value.find((p) => p.id === form.value.preset)
  return preset?.perm_allow ?? Perm.Viewer
}

function principalLabel(row: AclRow) {
  const type = row.principal_type === 'department' ? '部门' : '用户'
  return `${type} · ${row.principal_name || row.principal_id}`
}

function summarizeAllow(row: AclRow) {
  if (row.perm_allow === Perm.Viewer) return '仅查看'
  if (row.perm_allow === Perm.Editor) return '允许编辑'
  return (row.perm_allow_names || []).join(' · ') || String(row.perm_allow)
}

async function loadRefs() {
  const [p, u, d] = await Promise.all([
    permsApi.listPresets(),
    usersApi.listUsers({ page: 1, page_size: 200 }),
    deptApi.listAllDepartments(),
  ])
  presets.value = p
  users.value = u.items
  departments.value = d
}

async function loadEntries() {
  if (!props.storageId || !props.item) return
  loading.value = true
  try {
    const res = await permsApi.listAcl({
      storage_id: props.storageId,
      path: itemPath.value,
      page: 1,
      page_size: 100,
    })
    entries.value = res.items
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载权限失败')
  } finally {
    loading.value = false
  }
}

async function saveEntry() {
  if (!props.item || !form.value.principal_id) {
    toast.show('请选择用户或部门')
    return
  }
  const permAllow = resolvePermAllow()
  if (!permAllow && form.value.preset !== 'view_only') {
    toast.show('请至少选择一项权限')
    return
  }
  const permDeny = denyMaskForGrant(permAllow, form.value.preset)
  saving.value = true
  try {
    await permsApi.putAcl({
      storage_id: props.storageId,
      path: itemPath.value,
      is_dir: props.item.isDir,
      principal_type: form.value.principal_type,
      principal_id: Number(form.value.principal_id),
      perm_allow: permAllow,
      perm_deny: permDeny,
      inherit: form.value.inherit,
    })
    toast.show('权限已保存')
    showAdd.value = false
    resetForm()
    await loadEntries()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeEntry(row: AclRow) {
  if (!confirm(`移除 ${principalLabel(row)} 的权限？`)) return
  try {
    await permsApi.deleteAcl(row.id)
    toast.show('已移除')
    await loadEntries()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '删除失败')
  }
}

function editEntry(row: AclRow) {
  form.value.principal_type = row.principal_type
  form.value.principal_id = row.principal_id
  form.value.inherit = row.inherit
  const preset = detectPreset(row.perm_allow)
  form.value.preset = preset
  if (preset === 'custom') {
    const flags = customFlagsFromMask(row.perm_allow)
    form.value.customView = flags.view
    form.value.customEdit = flags.edit
    form.value.customDelete = flags.delete
    form.value.customShare = flags.share
  }
  showAdd.value = true
}

watch(
  () => props.show,
  async (open) => {
    if (!open) {
      showAdd.value = false
      resetForm()
      return
    }
    try {
      await loadRefs()
      await loadEntries()
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '加载失败')
    }
  },
)

watch(
  () => form.value.preset,
  (preset) => {
    if (preset === 'view_only') {
      form.value.customView = true
      form.value.customEdit = false
      form.value.customDelete = false
      form.value.customShare = false
    } else if (preset === 'edit') {
      form.value.customView = true
      form.value.customEdit = true
      form.value.customDelete = false
      form.value.customShare = false
    }
  },
)
</script>

<template>
  <CdModal :show="show" :title="t('permissions.pathTitle', { name: itemName })" size="lg" @close="emit('close')">
    <div class="modal-body">
      <p class="text-secondary small mb-3">
        {{ t('permissions.pathHint', { path: itemPath }) }}
      </p>

      <div v-if="loading" class="text-center text-secondary py-4">加载中…</div>
      <template v-else>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">已授权</h6>
          <button type="button" class="btn btn-sm btn-primary" @click="showAdd = !showAdd; resetForm()">
            {{ showAdd ? '取消添加' : '添加授权' }}
          </button>
        </div>

        <div v-if="showAdd" class="card mb-3">
          <div class="card-body">
            <div class="row g-2 mb-2">
              <div class="col-6">
                <label class="form-label">主体类型</label>
                <select v-model="form.principal_type" class="form-select form-select-sm">
                  <option value="user">用户</option>
                  <option value="department">部门</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label">主体</label>
                <select v-model="form.principal_id" class="form-select form-select-sm" required>
                  <option value="" disabled>选择</option>
                  <template v-if="form.principal_type === 'user'">
                    <option v-for="u in users" :key="u.id" :value="String(u.id)">
                      {{ u.real_name || u.username }}
                    </option>
                  </template>
                  <template v-else>
                    <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                  </template>
                </select>
              </div>
            </div>

            <label class="form-label">权限预设</label>
            <div class="d-flex flex-wrap gap-2 mb-2">
              <label
                v-for="p in presetOptions"
                :key="p.id"
                class="form-check form-check-inline mb-0"
              >
                <input
                  v-model="form.preset"
                  class="form-check-input"
                  type="radio"
                  :value="p.id"
                />
                <span class="form-check-label">{{ p.label }}</span>
              </label>
            </div>
            <p v-if="form.preset !== 'custom'" class="text-secondary small mb-2">
              {{ presetOptions.find((p) => p.id === form.preset)?.description }}
            </p>

            <div v-if="form.preset === 'custom'" class="mb-2">
              <label class="form-label">自定义权限</label>
              <div class="d-flex flex-wrap gap-3">
                <label class="form-check mb-0">
                  <input v-model="form.customView" class="form-check-input" type="checkbox" />
                  <span class="form-check-label">查看（浏览、预览、下载）</span>
                </label>
                <label class="form-check mb-0">
                  <input v-model="form.customEdit" class="form-check-input" type="checkbox" />
                  <span class="form-check-label">编辑（上传、新建、重命名）</span>
                </label>
                <label class="form-check mb-0">
                  <input v-model="form.customDelete" class="form-check-input" type="checkbox" />
                  <span class="form-check-label">删除</span>
                </label>
                <label class="form-check mb-0">
                  <input v-model="form.customShare" class="form-check-input" type="checkbox" />
                  <span class="form-check-label">共享（分享链接/取件码）</span>
                </label>
              </div>
            </div>

            <label class="form-check mb-3">
              <input v-model="form.inherit" class="form-check-input" type="checkbox" />
              <span class="form-check-label">子目录继承此规则</span>
            </label>

            <button type="button" class="btn btn-sm btn-primary" :disabled="saving" @click="saveEntry">
              {{ saving ? '保存中…' : '保存授权' }}
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-vcenter table-sm mb-0">
            <thead>
              <tr>
                <th>主体</th>
                <th>权限</th>
                <th>继承</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in entries" :key="row.id">
                <td>{{ principalLabel(row) }}</td>
                <td class="small">{{ summarizeAllow(row) }}</td>
                <td>{{ row.inherit ? '是' : '否' }}</td>
                <td class="text-end text-nowrap">
                  <button type="button" class="btn btn-sm btn-ghost-secondary me-1" @click="editEntry(row)">编辑</button>
                  <button type="button" class="btn btn-sm btn-ghost-danger" @click="removeEntry(row)">移除</button>
                </td>
              </tr>
              <tr v-if="!entries.length">
                <td colspan="4" class="text-center text-secondary py-3">暂无授权，点击「添加授权」分享给用户或部门</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-sm" @click="emit('close')">关闭</button>
    </div>
  </CdModal>
</template>
