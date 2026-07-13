<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import * as usersApi from '@/api/users'
import type { UserRow } from '@/api/users'
import * as deptApi from '@/api/departments'
import type { DepartmentRow } from '@/api/departments'
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
const editing = ref<UserRow | null>(null)
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

async function saveEdit() {
  if (!editing.value) return
  try {
    await usersApi.updateUser(editing.value.id, {
      role: editForm.value.role,
      real_name: editForm.value.real_name || undefined,
      department_id: editForm.value.department_id ? Number(editForm.value.department_id) : null,
    })
    showEdit.value = false
    toast.show('已保存')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  }
}

async function toggleDisabled(u: UserRow) {
  await usersApi.setUserDisabled(u.id, !u.disabled)
  load()
}

async function remove(u: UserRow) {
  if (u.id === auth.user?.user_id) return toast.show('不能删除自己')
  if (!confirm(`删除用户 ${u.username}？`)) return
  await usersApi.deleteUser(u.id)
  toast.show('已删除')
  load()
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
                <button type="button" class="btn btn-sm" @click="toggleDisabled(u)">{{ u.disabled ? '启用' : '禁用' }}</button>
                <button type="button" class="btn btn-sm btn-outline-danger ms-1" @click="remove(u)">删除</button>
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
          <div class="mb-2"><label class="form-label">角色</label><select v-model="editForm.role" class="form-select"><option value="user">user</option><option value="admin">admin</option></select></div>
          <div class="mb-2"><label class="form-label">部门</label><select v-model="editForm.department_id" class="form-select"><option value="">未分配</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></div>
          <div class="mb-2"><label class="form-label">显示名</label><input v-model="editForm.real_name" class="form-control" /></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showEdit = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">保存</button>
        </div>
      </form>
    </CdModal>

    <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
  </div>
</template>
