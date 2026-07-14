<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError } from '@/api/client'
import * as tokensApi from '@/api/tokens'
import type { AccessToken, PermissionCeiling } from '@/api/tokens'
import { Perm, PERM_BIT_ITEMS } from '@/utils/permissions'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const items = ref<AccessToken[]>([])
const ceiling = ref<PermissionCeiling | null>(null)
const loading = ref(false)
const creating = ref(false)
const showCreate = ref(false)
const createdPlain = ref('')

const name = ref('')
const preset = ref<'view_only' | 'edit' | 'custom'>('edit')
const customMask = ref(Perm.Editor)
const allScopes = ref(true)
const scopeStorageId = ref<number | null>(null)
const scopePath = ref('/')
const expiresDays = ref<number | null>(null)

async function load() {
  loading.value = true
  try {
    const [list, ceil] = await Promise.all([tokensApi.listTokens(), tokensApi.permissionCeiling()])
    items.value = list.items || []
    ceiling.value = ceil
    if (ceil.mounts?.length) {
      scopeStorageId.value = ceil.mounts[0].storage_id
      scopePath.value = ceil.mounts[0].root_path || '/'
    }
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function maskFromPreset(): number {
  if (preset.value === 'view_only') return Perm.Viewer
  if (preset.value === 'edit') return Perm.Editor
  return customMask.value & (ceiling.value?.max_mask ?? Perm.Editor)
}

function toggleBit(bit: number) {
  const max = ceiling.value?.max_mask ?? 0
  if ((max & bit) !== bit) return
  customMask.value ^= bit
}

async function create() {
  creating.value = true
  createdPlain.value = ''
  try {
    const scopes =
      allScopes.value || scopeStorageId.value == null
        ? []
        : [{ storage_id: scopeStorageId.value, path: scopePath.value || '/' }]
    let expires_at: string | null = null
    if (expiresDays.value && expiresDays.value > 0) {
      const d = new Date()
      d.setDate(d.getDate() + expiresDays.value)
      expires_at = d.toISOString()
    }
    const row = await tokensApi.createToken({
      name: name.value.trim(),
      perm_mask: maskFromPreset(),
      scopes,
      expires_at,
    })
    createdPlain.value = row.token || ''
    name.value = ''
    showCreate.value = false
    toast.show('令牌已创建，请立即复制明文')
    await load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '创建失败')
  } finally {
    creating.value = false
  }
}

async function revoke(row: AccessToken) {
  if (!confirm(`确定撤销令牌「${row.name}」？`)) return
  try {
    await tokensApi.deleteToken(row.id)
    toast.show('已撤销')
    await load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '撤销失败')
  }
}

async function toggleEnabled(row: AccessToken) {
  try {
    await tokensApi.patchToken(row.id, { enabled: !row.enabled })
    await load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '更新失败')
  }
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.show('已复制'),
    () => toast.show('复制失败，请手动选择'),
  )
}

onMounted(load)
</script>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">访问令牌</h3>
    <p class="text-secondary small mb-4">
      用于对接 REST / S3 等外部系统。令牌权限只能在你本人有效权限范围内收紧，不能越权。明文仅在创建时显示一次。
    </p>

    <div v-if="createdPlain" class="alert alert-warning">
      <div class="fw-medium mb-2">请立即保存令牌明文（关闭后无法再次查看）</div>
      <code class="user-select-all">{{ createdPlain }}</code>
      <button type="button" class="btn btn-sm btn-outline-secondary ms-2" @click="copyText(createdPlain)">
        复制
      </button>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-3">
      <div class="small text-secondary">
        能力上限掩码：{{ ceiling?.max_mask ?? '—' }}
        <span v-if="ceiling?.perm_names?.length">（{{ ceiling.perm_names.join(', ') }}）</span>
      </div>
      <button type="button" class="btn btn-sm btn-primary" @click="showCreate = !showCreate">
        {{ showCreate ? '取消' : '创建令牌' }}
      </button>
    </div>

    <div v-if="showCreate" class="cd-settings-card mb-4">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">名称</label>
          <input v-model="name" class="form-control form-control-sm" placeholder="例如：CI 同步" />
        </div>
        <div class="col-md-3">
          <label class="form-label">过期（天，可空）</label>
          <input v-model.number="expiresDays" type="number" min="1" class="form-control form-control-sm" />
        </div>
        <div class="col-md-3">
          <label class="form-label">权限预设</label>
          <select v-model="preset" class="form-select form-select-sm">
            <option value="view_only">只读</option>
            <option value="edit">编辑</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div v-if="preset === 'custom'" class="col-12">
          <label class="form-label">自定义权限（不可超过上限）</label>
          <div class="d-flex flex-wrap gap-2">
            <label
              v-for="bit in PERM_BIT_ITEMS"
              :key="bit.bit"
              class="form-check form-check-inline"
              :class="{ 'text-muted': ((ceiling?.max_mask ?? 0) & bit.bit) !== bit.bit }"
            >
              <input
                class="form-check-input"
                type="checkbox"
                :checked="(customMask & bit.bit) === bit.bit"
                :disabled="((ceiling?.max_mask ?? 0) & bit.bit) !== bit.bit"
                @change="toggleBit(bit.bit)"
              />
              <span class="form-check-label">{{ bit.label }}</span>
            </label>
          </div>
        </div>
        <div class="col-12">
          <label class="form-check">
            <input v-model="allScopes" class="form-check-input" type="checkbox" />
            <span class="form-check-label">全部可访问位置（不限制目录范围）</span>
          </label>
        </div>
        <template v-if="!allScopes">
          <div class="col-md-6">
            <label class="form-label">存储</label>
            <select v-model.number="scopeStorageId" class="form-select form-select-sm">
              <option v-for="m in ceiling?.mounts || []" :key="m.storage_id" :value="m.storage_id">
                {{ m.name || m.storage_id }}（{{ m.root_path }}）
              </option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">路径范围</label>
            <input v-model="scopePath" class="form-control form-control-sm" placeholder="/" />
          </div>
        </template>
      </div>
      <div class="mt-3">
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="creating || !name.trim()"
          @click="create"
        >
          {{ creating ? '创建中…' : '创建' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-secondary">加载中…</div>
    <div v-else-if="!items.length" class="text-secondary small">暂无访问令牌</div>
    <div v-else class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th>名称</th>
            <th>前缀</th>
            <th>权限</th>
            <th>范围</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td>{{ row.name }}</td>
            <td><code>{{ row.token_prefix }}…</code></td>
            <td class="small">{{ (row.perm_names || []).join(', ') || row.perm_mask }}</td>
            <td class="small">
              <template v-if="!row.scopes?.length">全部</template>
              <template v-else>
                <div v-for="(sc, i) in row.scopes" :key="i">#{{ sc.storage_id }} {{ sc.path }}</div>
              </template>
            </td>
            <td>
              <button type="button" class="btn btn-link btn-sm p-0" @click="toggleEnabled(row)">
                {{ row.enabled ? '启用' : '已禁用' }}
              </button>
            </td>
            <td class="text-end">
              <button type="button" class="btn btn-outline-danger btn-sm" @click="revoke(row)">撤销</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
