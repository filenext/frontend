<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import * as usersApi from '@/api/users'
import type { UserRow } from '@/api/users'
import * as deptApi from '@/api/departments'
import type { DepartmentRow } from '@/api/departments'
import * as tokensApi from '@/api/tokens'
import { Perm } from '@/utils/permissions'
import { useAuthStore } from '@/stores/auth'
import { usePageSize } from '@/composables/usePageSize'
import { useToast } from '@/composables/useToast'
import CdModal from '@/components/CdModal.vue'
import CdPagination from '@/components/CdPagination.vue'
import CdAvatar from '@/components/CdAvatar.vue'
import AvatarPicker from '@/components/AvatarPicker.vue'

const auth = useAuthStore()
const toast = useToast()
const { pageSize, ensurePageSize } = usePageSize()
const items = ref<UserRow[]>([])
const departments = ref<DepartmentRow[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const loading = ref(false)

const showCreate = ref(false)
const showEdit = ref(false)
const showToken = ref(false)
const editing = ref<UserRow | null>(null)
const tokenUser = ref<UserRow | null>(null)
const tokenName = ref('gateway')
const tokenPlain = ref('')
const form = ref({ username: '', password: '', role: 'user', real_name: '', department_id: '' as string | number })
const editForm = ref({ role: 'user', real_name: '', department_id: '' as string | number })

async function loadDepts() {
  try {
    departments.value = await deptApi.listAllDepartments()
  } catch {
    departments.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const res = await usersApi.listUsers({ page: page.value, page_size: pageSize.value, keyword: keyword.value || undefined })
    items.value = res.items
    total.value = res.total
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

watch(page, () => load())

async function create() {
  try {
    await usersApi.createUser({
      username: form.value.username,
      password: form.value.password,
      role: form.value.role,
      real_name: form.value.real_name || undefined,
      department_id: form.value.department_id ? Number(form.value.department_id) : null,
    })
    showCreate.value = false
    form.value = { username: '', password: '', role: 'user', real_name: '', department_id: '' }
    toast.show('已创建')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '创建失败')
  }
}

function openEdit(u: UserRow) {
  editing.value = u
  editForm.value = {
    role: u.role,
    real_name: u.real_name || '',
    department_id: u.department_id ?? '',
  }
  showEdit.value = true
}

async function toggleDisabled(u: UserRow) {
  if (u.is_system) return toast.show('系统用户不允许禁用')
  await usersApi.setUserDisabled(u.id, !u.disabled)
  load()
}

async function remove(u: UserRow) {
  if (!auth.isSuperAdmin) return toast.show('需要超级管理员权限')
  if (u.is_system) return toast.show('系统用户不允许删除')
  if (u.id === auth.user?.user_id) return toast.show('不能删除自己')
  if (!confirm(`删除用户 ${u.username}？`)) return
  try {
    await usersApi.deleteUser(u.id)
    toast.show('已删除')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '删除失败')
  }
}

async function saveEdit() {
  if (!editing.value) return
  try {
    const payload: Parameters<typeof usersApi.updateUser>[1] = {
      real_name: editForm.value.real_name || undefined,
      department_id: editForm.value.department_id ? Number(editForm.value.department_id) : null,
    }
    if (!editing.value.is_system) {
      payload.role = editForm.value.role
    }
    await usersApi.updateUser(editing.value.id, payload)
    showEdit.value = false
    toast.show('已保存')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  }
}

function openToken(u: UserRow) {
  tokenUser.value = u
  tokenName.value = u.username === 'guest' ? 'guest-api' : 'admin-issued'
  tokenPlain.value = ''
  showToken.value = true
}

async function issueToken() {
  if (!tokenUser.value) return
  try {
    const row = await tokensApi.adminCreateToken(tokenUser.value.id, {
      name: tokenName.value.trim() || 'token',
      perm_mask: Perm.Editor,
      scopes: [],
    })
    tokenPlain.value = row.token || ''
    toast.show('令牌已创建，请立即复制')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '创建失败')
  }
}

onMounted(async () => {
  await ensurePageSize()
  await loadDepts()
  load()
})
</script>

<template>
  <div>
    <div class="d-flex gap-2 mb-3 flex-wrap">
      <input v-model="keyword" class="form-control form-control-sm" placeholder="搜索用户" style="max-width:14rem" @keyup.enter="search" />
      <button type="button" class="btn btn-sm btn-primary" @click="showCreate = true">添加用户</button>
      <button type="button" class="btn btn-sm" @click="load">刷新</button>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-vcenter card-table table-sm">
          <thead>
            <tr><th></th><th>用户名</th><th>角色</th><th>部门</th><th>状态</th><th>显示名</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="u in items" :key="u.id">
              <td class="w-1"><CdAvatar :src="u.avatar_url" :name="u.real_name || u.username" kind="user" size="sm" /></td>
              <td>{{ u.username }}</td>
              <td><span class="badge bg-secondary-lt">{{ u.role }}</span></td>
              <td>{{ u.department_name || '—' }}</td>
              <td>{{ u.disabled ? '禁用' : '正常' }}</td>
              <td>{{ u.real_name || '—' }}</td>
              <td class="text-end text-nowrap">
                <button type="button" class="btn btn-sm btn-ghost-secondary" @click="openEdit(u)">编辑</button>
                <button type="button" class="btn btn-sm btn-ghost-secondary" @click="openToken(u)">令牌</button>
                <button
                  v-if="!u.is_system"
                  type="button"
                  class="btn btn-sm"
                  @click="toggleDisabled(u)"
                >{{ u.disabled ? '启用' : '禁用' }}</button>
                <button
                  v-if="auth.isSuperAdmin && !u.is_system"
                  type="button"
                  class="btn btn-sm btn-outline-danger ms-1"
                  @click="remove(u)"
                >删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card-footer">
        <CdPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
      </div>
    </div>

    <CdModal :show="showCreate" title="添加用户" @close="showCreate = false">
      <form @submit.prevent="create">
        <div class="modal-body">
          <div class="mb-2"><label class="form-label">用户名</label><input v-model="form.username" class="form-control" required /></div>
          <div class="mb-2"><label class="form-label">密码</label><input v-model="form.password" type="password" class="form-control" required minlength="5" /></div>
          <div class="mb-2"><label class="form-label">角色</label><select v-model="form.role" class="form-select"><option value="user">user</option><option value="admin">admin</option></select></div>
          <div class="mb-2"><label class="form-label">部门</label><select v-model="form.department_id" class="form-select"><option value="">未分配</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></div>
          <div class="mb-2"><label class="form-label">显示名</label><input v-model="form.real_name" class="form-control" /></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showCreate = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">创建</button>
        </div>
      </form>
    </CdModal>

    <CdModal :show="showEdit" title="编辑用户" @close="showEdit = false">
      <form @submit.prevent="saveEdit">
        <div class="modal-body">
          <p class="text-secondary small">用户：{{ editing?.username }}</p>
          <div class="mb-3">
            <label class="form-label">头像</label>
            <AvatarPicker
              v-if="editing"
              kind="user"
              mode="user-admin"
              :target-id="editing.id"
              :avatar-url="editing.avatar_url"
              :name="editing.real_name || editing.username"
              @updated="(url) => { if (editing) editing.avatar_url = url }"
            />
          </div>
          <div class="mb-2">
            <label class="form-label">角色</label>
            <select
              v-model="editForm.role"
              class="form-select"
              :disabled="!!editing?.is_system"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option v-if="editing?.role === 'superadmin'" value="superadmin">superadmin</option>
            </select>
            <div v-if="editing?.is_system" class="form-hint text-secondary">系统用户不允许修改角色</div>
          </div>
          <div class="mb-2"><label class="form-label">部门</label><select v-model="editForm.department_id" class="form-select"><option value="">未分配</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></div>
          <div class="mb-2"><label class="form-label">显示名</label><input v-model="editForm.real_name" class="form-control" /></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showEdit = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">保存</button>
        </div>
      </form>
    </CdModal>

    <CdModal :show="showToken" title="代发访问令牌" @close="showToken = false">
      <div class="modal-body">
        <p class="text-secondary small">用户：{{ tokenUser?.username }}（权限按该用户 ACL 上限收紧）</p>
        <div class="mb-2">
          <label class="form-label">名称</label>
          <input v-model="tokenName" class="form-control" />
        </div>
        <div v-if="tokenPlain" class="alert alert-warning small">
          明文（仅一次）：<code class="user-select-all">{{ tokenPlain }}</code>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-sm" @click="showToken = false">关闭</button>
        <button type="button" class="btn btn-sm btn-primary" @click="issueToken">签发</button>
      </div>
    </CdModal>

    <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
  </div>
</template>
