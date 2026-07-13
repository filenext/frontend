<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { IconPlus, IconPuzzle, IconPencil, IconTrash } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as pluginsApi from '@/api/plugins'
import type { PluginRow } from '@/api/plugins'
import { usePageSize } from '@/composables/usePageSize'
import { useToast } from '@/composables/useToast'
import CdModal from '@/components/CdModal.vue'
import CdPagination from '@/components/CdPagination.vue'

const toast = useToast()
const { pageSize, ensurePageSize } = usePageSize()
const plugins = ref<PluginRow[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const showForm = ref(false)
const editing = ref<PluginRow | null>(null)
const form = ref({
  plugin_id: '',
  name: '',
  type: 'ai',
  base_url: '',
  webhook_url: '',
  hooks: 'file.upload,file.delete',
  enabled: true,
})

function resetForm() {
  editing.value = null
  form.value = {
    plugin_id: '',
    name: '',
    type: 'ai',
    base_url: '',
    webhook_url: '',
    hooks: 'file.upload,file.delete',
    enabled: true,
  }
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(p: PluginRow) {
  editing.value = p
  form.value = {
    plugin_id: p.plugin_id,
    name: p.name,
    type: p.type || 'ai',
    base_url: p.base_url || '',
    webhook_url: p.webhook_url || '',
    hooks: (p.hooks || []).join(','),
    enabled: p.enabled,
  }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  resetForm()
}

async function load() {
  loading.value = true
  try {
    const res = await pluginsApi.listPlugins({ page: page.value, page_size: pageSize.value })
    plugins.value = res.items
    total.value = res.total
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function buildPayload() {
  return {
    name: form.value.name,
    type: form.value.type,
    base_url: form.value.base_url || undefined,
    webhook_url: form.value.webhook_url || undefined,
    hooks: form.value.hooks.split(',').map((s) => s.trim()).filter(Boolean),
    enabled: form.value.enabled,
  }
}

async function save() {
  try {
    if (editing.value) {
      await pluginsApi.updatePlugin(editing.value.id, buildPayload())
      toast.show('已保存')
    } else {
      await pluginsApi.registerPlugin({
        plugin_id: form.value.plugin_id,
        ...buildPayload(),
      })
      toast.show('已注册')
    }
    closeForm()
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  }
}

async function toggleEnabled(p: PluginRow) {
  try {
    await pluginsApi.updatePlugin(p.id, { enabled: !p.enabled })
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '操作失败')
  }
}

async function remove(p: PluginRow) {
  if (!confirm(`删除插件「${p.name}」？`)) return
  try {
    await pluginsApi.deletePlugin(p.id)
    toast.show('已删除')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '删除失败')
  }
}

watch(page, () => load())

onMounted(async () => {
  await ensurePageSize()
  load()
})
</script>

<template>
  <div>
    <div class="d-flex gap-2 mb-3 flex-wrap align-items-center">
      <button type="button" class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" @click="openCreate">
        <IconPlus :size="16" /> 注册插件
      </button>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="load">刷新</button>
      <span class="text-secondary small">文件事件将通过 Webhook 通知已启用插件</span>
    </div>

    <div class="cd-admin-cards" :class="{ 'opacity-50': loading && plugins.length }">
      <article v-for="p in plugins" :key="p.id" class="cd-admin-card">
        <div class="cd-admin-card-head">
          <span class="cd-admin-card-icon"><IconPuzzle :size="20" /></span>
          <div class="min-w-0 flex-fill">
            <h3 class="cd-admin-card-title">{{ p.name }}</h3>
            <div class="cd-admin-card-badges">
              <span class="badge" :class="p.enabled ? 'bg-green-lt text-green' : 'bg-secondary-lt'">
                {{ p.enabled ? '启用' : '禁用' }}
              </span>
              <span v-if="p.type" class="badge bg-blue-lt text-blue">{{ p.type }}</span>
            </div>
          </div>
        </div>
        <div class="cd-admin-card-body">
          <dl class="cd-admin-card-meta mb-0">
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">ID</dt>
              <dd class="cd-admin-card-meta-value mb-0"><code>{{ p.plugin_id }}</code></dd>
            </div>
            <div v-if="p.base_url" class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">Base</dt>
              <dd class="cd-admin-card-meta-value mb-0 text-truncate" :title="p.base_url">{{ p.base_url }}</dd>
            </div>
            <div v-if="p.webhook_url" class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">Hook</dt>
              <dd class="cd-admin-card-meta-value mb-0 text-truncate" :title="p.webhook_url">{{ p.webhook_url }}</dd>
            </div>
            <div v-if="p.hooks?.length" class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">事件</dt>
              <dd class="cd-admin-card-meta-value mb-0">
                <div class="cd-admin-card-hooks">
                  <span v-for="h in p.hooks" :key="h" class="badge bg-secondary-lt">{{ h }}</span>
                </div>
              </dd>
            </div>
          </dl>
        </div>
        <div class="cd-admin-card-foot">
          <button type="button" class="btn btn-sm" @click="toggleEnabled(p)">
            {{ p.enabled ? '禁用' : '启用' }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost-secondary" title="编辑" @click="openEdit(p)">
            <IconPencil :size="15" />
          </button>
          <button type="button" class="btn btn-sm btn-ghost-danger ms-auto" title="删除" @click="remove(p)">
            <IconTrash :size="15" />
          </button>
        </div>
      </article>

      <div v-if="loading && !plugins.length" class="cd-admin-cards-empty">
        <div class="card">
          <div class="card-body text-center text-secondary">加载中…</div>
        </div>
      </div>
      <div v-else-if="!plugins.length" class="cd-admin-cards-empty">
        <div class="card">
          <div class="card-body text-center text-secondary">暂无插件，点击上方注册</div>
        </div>
      </div>
    </div>

    <div class="cd-admin-cards-pagination">
      <CdPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
    </div>

    <CdModal :show="showForm" :title="editing ? '编辑插件' : '注册插件'" @close="closeForm">
      <form @submit.prevent="save">
        <div class="modal-body">
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label">插件 ID</label>
              <input
                v-model="form.plugin_id"
                class="form-control"
                required
                :disabled="!!editing"
                placeholder="唯一标识，如 my-ai-plugin"
              />
            </div>
            <div class="col-6">
              <label class="form-label">名称</label>
              <input v-model="form.name" class="form-control" required />
            </div>
          </div>
          <div class="mb-2 mt-2">
            <label class="form-label">类型</label>
            <input v-model="form.type" class="form-control" placeholder="ai" />
          </div>
          <div class="mb-2">
            <label class="form-label">Base URL</label>
            <input v-model="form.base_url" class="form-control" />
          </div>
          <div class="mb-2">
            <label class="form-label">Webhook URL</label>
            <input v-model="form.webhook_url" class="form-control" placeholder="接收 file.upload 等事件" />
          </div>
          <div class="mb-2">
            <label class="form-label">Hooks（逗号分隔）</label>
            <input v-model="form.hooks" class="form-control" placeholder="file.upload,file.delete" />
          </div>
          <label class="form-check">
            <input v-model="form.enabled" class="form-check-input" type="checkbox" />
            <span class="form-check-label">启用</span>
          </label>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="closeForm">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">{{ editing ? '保存' : '注册' }}</button>
        </div>
      </form>
    </CdModal>

    <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
  </div>
</template>
