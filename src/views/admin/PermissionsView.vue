<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import * as permsApi from '@/api/permissions'
import type { AclRow, MountRow } from '@/api/permissions'
import * as storagesApi from '@/api/storages'
import * as usersApi from '@/api/users'
import * as deptApi from '@/api/departments'
import { usePageSize } from '@/composables/usePageSize'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CdModal from '@/components/CdModal.vue'
import CdPagination from '@/components/CdPagination.vue'
import PermMaskPicker from '@/components/admin/PermMaskPicker.vue'
import { Perm } from '@/utils/permissions'

const toast = useToast()
const auth = useAuthStore()
const { pageSize, ensurePageSize } = usePageSize()
const tab = ref<'mounts' | 'acl'>('mounts')

const mounts = ref<MountRow[]>([])
const mountTotal = ref(0)
const mountPage = ref(1)

const aclRows = ref<AclRow[]>([])
const aclTotal = ref(0)
const aclPage = ref(1)
const aclFilterStorage = ref('')
const aclFilterPath = ref('')

const storages = ref<{ id: string; name: string }[]>([])
const users = ref<{ id: number; username: string }[]>([])
const departments = ref<{ id: string; name: string }[]>([])
const loading = ref(false)
const showForm = ref(false)
const form = ref({
  storage_id: '',
  principal_type: 'user',
  principal_id: '',
  root_path: '/',
  perm_mask: Perm.Editor,
})

async function loadRefs() {
  const [st, u, d] = await Promise.all([
    storagesApi.listStorages({ all: true }),
    usersApi.listUsers({ page: 1, page_size: 200 }),
    deptApi.listAllDepartments(),
  ])
  storages.value = st.items.map((s) => ({ id: s.id, name: s.name }))
  users.value = u.items.map((x) => ({ id: x.id, username: x.username }))
  departments.value = d.map((x) => ({ id: x.id, name: x.name }))
}

async function loadMounts() {
  loading.value = true
  try {
    const res = await permsApi.listMounts({ page: mountPage.value, page_size: pageSize.value })
    mounts.value = res.items
    mountTotal.value = res.total
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadAcl() {
  loading.value = true
  try {
    const res = await permsApi.listAcl({
      storage_id: aclFilterStorage.value || undefined,
      path: aclFilterPath.value || undefined,
      page: aclPage.value,
      page_size: pageSize.value,
    })
    aclRows.value = res.items
    aclTotal.value = res.total
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function principalLabel(m: MountRow | AclRow) {
  if (m.principal_type === 'department') {
    return departments.value.find((d) => d.id === m.principal_id)?.name || m.principal_id
  }
  if ('principal_name' in m && m.principal_name) return m.principal_name
  return users.value.find((u) => String(u.id) === m.principal_id)?.username || m.principal_id
}

function storageLabel(id: string) {
  return storages.value.find((s) => s.id === id)?.name || id
}

function summarizeAcl(row: AclRow) {
  if (row.perm_allow === Perm.Viewer) return '仅查看'
  if (row.perm_allow === Perm.Editor) return '允许编辑'
  return (row.perm_allow_names || []).join(', ')
}

async function save() {
  try {
    await permsApi.putMount({
      storage_id: form.value.storage_id,
      principal_type: form.value.principal_type,
      principal_id: Number(form.value.principal_id),
      root_path: form.value.root_path || '/',
      perm_mask: form.value.perm_mask,
    })
    showForm.value = false
    toast.show('已保存')
    loadMounts()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  }
}

async function removeMount(m: MountRow) {
  if (!confirm('删除此挂载规则？')) return
  await permsApi.deleteMount(m.id)
  loadMounts()
}

async function removeAcl(row: AclRow) {
  if (!confirm('删除此路径 ACL？')) return
  await permsApi.deleteAcl(row.id)
  loadAcl()
}

watch(mountPage, () => {
  if (tab.value === 'mounts') loadMounts()
})

watch(aclPage, () => {
  if (tab.value === 'acl') loadAcl()
})

watch(tab, (t) => {
  if (t === 'mounts') loadMounts()
  else loadAcl()
})

onMounted(async () => {
  await ensurePageSize()
  try {
    await loadRefs()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载参考数据失败')
  }
  loadMounts()
})
</script>

<template>
  <div>
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button type="button" class="nav-link" :class="{ active: tab === 'mounts' }" @click="tab = 'mounts'">
          L1 存储挂载
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" :class="{ active: tab === 'acl' }" @click="tab = 'acl'">
          L2 路径 ACL
        </button>
      </li>
    </ul>

    <template v-if="tab === 'mounts'">
      <div class="d-flex gap-2 mb-3">
        <button type="button" class="btn btn-sm btn-primary" @click="showForm = true">添加挂载</button>
        <button type="button" class="btn btn-sm" :disabled="loading" @click="loadMounts">刷新</button>
        <span class="text-secondary small align-self-center">为用户/部门分配可访问的存储源与根路径</span>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-vcenter card-table table-sm mb-0">
            <thead>
              <tr><th>主体</th><th>存储源</th><th>根路径</th><th>权限</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="5" class="text-center text-secondary py-4">加载中…</td></tr>
              <tr v-for="m in mounts" :key="m.id">
                <td>{{ m.principal_type }} / {{ principalLabel(m) }}</td>
                <td>{{ storageLabel(m.storage_id) }}</td>
                <td><code>{{ m.root_path }}</code></td>
                <td class="small">{{ (m.perm_names || []).join(', ') }}</td>
                <td class="text-end">
                  <button
                    v-if="auth.isSuperAdmin"
                    type="button"
                    class="btn btn-sm btn-ghost-danger"
                    @click="removeMount(m)"
                  >删除</button>
                </td>
              </tr>
              <tr v-if="!mounts.length && !loading"><td colspan="5" class="text-center text-secondary py-4">暂无规则</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card-footer">
          <CdPagination v-model:page="mountPage" :total="mountTotal" :page-size="pageSize" :loading="loading" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="d-flex flex-wrap gap-2 mb-3 align-items-end">
        <div>
          <label class="form-label small mb-1">存储源</label>
          <select v-model="aclFilterStorage" class="form-select form-select-sm">
            <option value="">全部</option>
            <option v-for="s in storages" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="form-label small mb-1">路径</label>
          <input v-model="aclFilterPath" class="form-control form-control-sm" placeholder="/docs" />
        </div>
        <button type="button" class="btn btn-sm btn-primary" @click="aclPage = 1; loadAcl()">查询</button>
        <button type="button" class="btn btn-sm" :disabled="loading" @click="loadAcl">刷新</button>
        <span class="text-secondary small">目录级权限在文件页右键「权限设置」中维护</span>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-vcenter card-table table-sm mb-0">
            <thead>
              <tr><th>路径</th><th>主体</th><th>权限</th><th>继承</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="5" class="text-center text-secondary py-4">加载中…</td></tr>
              <tr v-for="row in aclRows" :key="row.id">
                <td><code>{{ row.path }}</code></td>
                <td>{{ row.principal_type }} / {{ principalLabel(row) }}</td>
                <td class="small">{{ summarizeAcl(row) }}</td>
                <td>{{ row.inherit ? '是' : '否' }}</td>
                <td class="text-end">
                  <button
                    v-if="auth.isSuperAdmin"
                    type="button"
                    class="btn btn-sm btn-ghost-danger"
                    @click="removeAcl(row)"
                  >删除</button>
                </td>
              </tr>
              <tr v-if="!aclRows.length && !loading"><td colspan="5" class="text-center text-secondary py-4">暂无路径 ACL</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card-footer">
          <CdPagination v-model:page="aclPage" :total="aclTotal" :page-size="pageSize" :loading="loading" />
        </div>
      </div>
    </template>

    <CdModal :show="showForm" title="添加存储挂载" @close="showForm = false">
      <form @submit.prevent="save">
        <div class="modal-body">
          <div class="mb-2">
            <label class="form-label">存储源</label>
            <select v-model="form.storage_id" class="form-select" required>
              <option value="" disabled>选择</option>
              <option v-for="s in storages" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label">主体类型</label>
              <select v-model="form.principal_type" class="form-select">
                <option value="user">用户</option>
                <option value="department">部门</option>
              </select>
            </div>
            <div class="col-6">
              <label class="form-label">主体</label>
              <select v-model="form.principal_id" class="form-select" required>
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
          <div class="mb-2 mt-2">
            <label class="form-label">根路径</label>
            <input v-model="form.root_path" class="form-control" placeholder="/" />
          </div>
          <div class="mb-2">
            <label class="form-label">权限掩码</label>
            <PermMaskPicker v-model="form.perm_mask" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showForm = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">保存</button>
        </div>
      </form>
    </CdModal>
  </div>
</template>
