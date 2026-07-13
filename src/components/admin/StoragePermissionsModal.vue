<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import * as permsApi from '@/api/permissions'
import type { MountRow } from '@/api/permissions'
import * as usersApi from '@/api/users'
import * as deptApi from '@/api/departments'
import { useToast } from '@/composables/useToast'
import CdModal from '@/components/CdModal.vue'
import PermMaskPicker from '@/components/admin/PermMaskPicker.vue'
import { Perm } from '@/utils/permissions'

const props = defineProps<{
  show: boolean
  storageId: string
  storageName: string
}>()

const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const mounts = ref<MountRow[]>([])
const users = ref<{ id: number; username: string }[]>([])
const departments = ref<{ id: string; name: string }[]>([])
const showForm = ref(false)
const form = ref({
  principal_type: 'user',
  principal_id: '',
  root_path: '/',
  perm_mask: Perm.Editor,
})

function resetForm() {
  form.value = {
    principal_type: 'user',
    principal_id: '',
    root_path: '/',
    perm_mask: Perm.Editor,
  }
}

function principalLabel(m: MountRow) {
  if (m.principal_type === 'department') {
    return departments.value.find((d) => d.id === m.principal_id)?.name || m.principal_id
  }
  return users.value.find((u) => String(u.id) === m.principal_id)?.username || m.principal_id
}

async function loadRefs() {
  const [u, d] = await Promise.all([
    usersApi.listUsers({ page: 1, page_size: 200 }),
    deptApi.listAllDepartments(),
  ])
  users.value = u.items.map((x) => ({ id: x.id, username: x.username }))
  departments.value = d
}

async function loadMounts() {
  if (!props.storageId) return
  loading.value = true
  try {
    const res = await permsApi.listMounts({ storage_id: props.storageId, all: true })
    mounts.value = res.items
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载权限失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.value.principal_id) {
    toast.show('请选择用户或部门')
    return
  }
  saving.value = true
  try {
    await permsApi.putMount({
      storage_id: props.storageId,
      principal_type: form.value.principal_type,
      principal_id: Number(form.value.principal_id),
      root_path: form.value.root_path || '/',
      perm_mask: form.value.perm_mask,
    })
    toast.show('已保存')
    showForm.value = false
    resetForm()
    await loadMounts()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(m: MountRow) {
  if (!confirm('删除此挂载规则？')) return
  try {
    await permsApi.deleteMount(m.id)
    toast.show('已删除')
    await loadMounts()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '删除失败')
  }
}

watch(
  () => props.show,
  async (open) => {
    if (!open) {
      showForm.value = false
      resetForm()
      return
    }
    await loadRefs()
    await loadMounts()
  },
)

onMounted(() => {
  if (props.show) {
    loadRefs()
    loadMounts()
  }
})
</script>

<template>
  <CdModal :show="show" :title="`存储权限 · ${storageName}`" size="lg" @close="emit('close')">
    <div class="modal-body">
      <p class="text-secondary small mb-3">
        为用户或部门分配此存储源的可访问根路径与权限上限。未配置的用户默认仅可访问本地存储中与自己用户名同名的文件夹。
      </p>

      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">挂载规则</h6>
        <button type="button" class="btn btn-sm btn-primary" @click="showForm = !showForm; resetForm()">
          {{ showForm ? '取消' : '添加规则' }}
        </button>
      </div>

      <div v-if="showForm" class="card mb-3">
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
                  <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.username }}</option>
                </template>
                <template v-else>
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </template>
              </select>
            </div>
          </div>
          <div class="mb-2">
            <label class="form-label">根路径</label>
            <input v-model="form.root_path" class="form-control form-control-sm" placeholder="/username 或 /shared" />
          </div>
          <div class="mb-2">
            <label class="form-label">权限掩码</label>
            <PermMaskPicker v-model="form.perm_mask" />
          </div>
          <button type="button" class="btn btn-sm btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center text-secondary py-3">加载中…</div>
      <div v-else class="table-responsive">
        <table class="table table-vcenter table-sm mb-0">
          <thead>
            <tr><th>主体</th><th>根路径</th><th>权限</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="m in mounts" :key="m.id">
              <td>{{ m.principal_type }} / {{ principalLabel(m) }}</td>
              <td><code>{{ m.root_path }}</code></td>
              <td class="small">{{ (m.perm_names || []).join(', ') }}</td>
              <td class="text-end">
                <button type="button" class="btn btn-sm btn-ghost-danger" @click="remove(m)">删除</button>
              </td>
            </tr>
            <tr v-if="!mounts.length">
              <td colspan="4" class="text-center text-secondary py-3">暂无规则</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-sm" @click="emit('close')">关闭</button>
    </div>
  </CdModal>
</template>
