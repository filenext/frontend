<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { IconPlus, IconPencil, IconTrash, IconPlugConnected, IconSend, IconBug } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as agentsApi from '@/api/agents'
import type { AgentRow, ChatMessage } from '@/types/agents'
import * as deptApi from '@/api/departments'
import type { DepartmentRow } from '@/api/departments'
import * as usersApi from '@/api/users'
import type { UserRow } from '@/api/users'
import { useAgentsStore } from '@/stores/agents'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { usePageSize } from '@/composables/usePageSize'
import CdModal from '@/components/CdModal.vue'
import CdPagination from '@/components/CdPagination.vue'
import CdAvatar from '@/components/CdAvatar.vue'
import AvatarPicker from '@/components/AvatarPicker.vue'
import AssistantReply from '@/components/AssistantReply.vue'

const toast = useToast()
const auth = useAuthStore()
const agentsStore = useAgentsStore()
const { pageSize, ensurePageSize } = usePageSize()

const agents = ref<AgentRow[]>([])
const total = ref(0)
const page = ref(1)
const departments = ref<DepartmentRow[]>([])
const users = ref<UserRow[]>([])
const loading = ref(false)
const showForm = ref(false)
const editing = ref<AgentRow | null>(null)

const showDebug = ref(false)
const debugTarget = ref<AgentRow | null>(null)
const debugTesting = ref(false)
const debugSending = ref(false)
const debugInput = ref('')
const debugReply = ref('')
const debugError = ref('')

const emptyForm = () => ({
  slug: '',
  name: '',
  description: '',
  provider: 'openai_compatible',
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  model: 'gpt-4o-mini',
  system_prompt: '',
  enabled: true,
  access_mode: 'all' as 'all' | 'restricted',
  allowed_departments: [] as string[],
  allowed_users: [] as string[],
  sort_order: 0,
  chat_path: '/chat/completions',
  temperature: 0.7,
  max_tokens: 2048,
})

const form = ref(emptyForm())

const providerOptions = [
  { value: 'openai_compatible', label: 'OpenAI 兼容 API' },
  { value: 'custom', label: '自定义' },
]

function resetForm() {
  form.value = emptyForm()
  editing.value = null
}

function resetDebugState() {
  debugInput.value = ''
  debugReply.value = ''
  debugError.value = ''
  debugTesting.value = false
  debugSending.value = false
}

function closeDebug() {
  showDebug.value = false
  debugTarget.value = null
  resetDebugState()
}

function openDebug(a: AgentRow) {
  debugTarget.value = a
  resetDebugState()
  showDebug.value = true
}

function fillForm(a: AgentRow) {
  const deptIds = (a.access_rules || [])
    .filter((r) => r.principal_type === 'department')
    .map((r) => r.principal_id)
  const userIds = (a.access_rules || [])
    .filter((r) => r.principal_type === 'user')
    .map((r) => r.principal_id)
  form.value = {
    slug: a.slug,
    name: a.name,
    description: a.description || '',
    provider: a.provider || 'openai_compatible',
    base_url: a.base_url,
    api_key: a.api_key || '',
    model: a.model,
    system_prompt: a.system_prompt || '',
    enabled: a.enabled,
    access_mode: a.access_mode || 'all',
    allowed_departments: deptIds,
    allowed_users: userIds,
    sort_order: a.sort_order || 0,
    chat_path: a.config?.chat_path || '/chat/completions',
    temperature: a.config?.temperature ?? 0.7,
    max_tokens: a.config?.max_tokens ?? 2048,
  }
}

function buildAccessRules() {
  const f = form.value
  const rules: { principal_type: 'user' | 'department'; principal_id: number }[] = []
  if (f.access_mode === 'restricted') {
    for (const id of f.allowed_departments) {
      rules.push({ principal_type: 'department', principal_id: Number(id) })
    }
    for (const id of f.allowed_users) {
      rules.push({ principal_type: 'user', principal_id: Number(id) })
    }
  }
  return rules
}

function buildPayload() {
  const f = form.value
  return {
    slug: f.slug,
    name: f.name,
    description: f.description || undefined,
    provider: f.provider,
    base_url: f.base_url,
    api_key: f.api_key || undefined,
    model: f.model,
    system_prompt: f.system_prompt || undefined,
    enabled: f.enabled,
    access_mode: f.access_mode,
    access_rules: buildAccessRules(),
    sort_order: f.sort_order,
    config: {
      chat_path: f.chat_path || '/chat/completions',
      temperature: f.temperature,
      max_tokens: f.max_tokens,
    },
  }
}

async function loadRefs() {
  try {
    const [depts, userRes] = await Promise.all([
      deptApi.listAllDepartments(),
      usersApi.listUsers({ page: 1, page_size: 200 }),
    ])
    departments.value = depts
    users.value = userRes.items
  } catch {
    departments.value = []
    users.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const res = await agentsApi.listAgents({ page: page.value, page_size: pageSize.value })
    agents.value = res.items
    total.value = res.total
    await agentsStore.load(true)
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

watch(page, () => load())

function openCreate() {
  resetForm()
  loadRefs()
  showForm.value = true
}

function openEdit(a: AgentRow) {
  editing.value = a
  fillForm(a)
  loadRefs()
  showForm.value = true
}

async function debugTestConnection() {
  if (!debugTarget.value) return
  debugError.value = ''
  debugTesting.value = true
  try {
    await agentsApi.testAgent(debugTarget.value.id)
    debugReply.value = '连接测试成功，API 可达。'
  } catch (e) {
    debugError.value = e instanceof ApiError ? e.message : '连接失败'
    debugReply.value = ''
  } finally {
    debugTesting.value = false
  }
}

async function debugSendMessage() {
  if (!debugTarget.value) return
  const text = debugInput.value.trim()
  if (!text) return
  debugError.value = ''
  debugReply.value = ''
  debugSending.value = true
  const messages: ChatMessage[] = [{ role: 'user', content: text }]
  try {
    const res = await agentsApi.chatAgent(debugTarget.value.id, { messages })
    debugReply.value = res.content
  } catch (e) {
    debugError.value = e instanceof ApiError ? e.message : '发送失败'
  } finally {
    debugSending.value = false
  }
}

async function save() {
  const payload = buildPayload()
  try {
    if (editing.value) {
      await agentsApi.updateAgent(editing.value.id, payload)
      toast.show('已保存')
    } else {
      await agentsApi.createAgent(payload)
      toast.show('已添加')
    }
    showForm.value = false
    resetForm()
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  }
}

async function toggleEnabled(a: AgentRow) {
  try {
    await agentsApi.updateAgent(a.id, { enabled: !a.enabled })
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '操作失败')
  }
}

async function remove(a: AgentRow) {
  if (!confirm(`删除智能体「${a.name}」？`)) return
  try {
    await agentsApi.deleteAgent(a.id)
    toast.show('已删除')
    load()
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '删除失败')
  }
}

onMounted(async () => {
  await ensurePageSize()
  loadRefs()
  load()
})

function accessLabel(a: AgentRow) {
  if (a.access_mode !== 'restricted') return '全部用户'
  const n = (a.access_rules || []).length
  return n ? `受限 (${n})` : '受限 (无规则)'
}

function providerLabel(p: string) {
  return providerOptions.find((o) => o.value === p)?.label ?? p
}
</script>

<template>
  <div>
    <div class="d-flex gap-2 mb-3 flex-wrap align-items-center">
      <button type="button" class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" @click="openCreate">
        <IconPlus :size="16" /> 添加智能体
      </button>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="load">刷新</button>
      <span class="text-secondary small">支持 OpenAI 兼容 API；启用后显示在侧栏「文件管理」下方</span>
    </div>

    <div class="cd-admin-cards" :class="{ 'opacity-50': loading && agents.length }">
      <article v-for="a in agents" :key="a.id" class="cd-admin-card">
        <div class="cd-admin-card-head">
          <CdAvatar :src="a.avatar_url" :name="a.name" kind="agent" size="sm" />
          <div class="min-w-0 flex-fill">
            <h3 class="cd-admin-card-title">{{ a.name }}</h3>
            <p v-if="a.description" class="cd-admin-card-desc">{{ a.description }}</p>
            <div class="cd-admin-card-badges">
              <span class="badge" :class="a.enabled ? 'bg-green-lt text-green' : 'bg-secondary-lt'">
                {{ a.enabled ? '启用' : '禁用' }}
              </span>
              <span class="badge bg-secondary-lt">{{ accessLabel(a) }}</span>
            </div>
          </div>
        </div>
        <div class="cd-admin-card-body">
          <dl class="cd-admin-card-meta mb-0">
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">标识</dt>
              <dd class="cd-admin-card-meta-value mb-0"><code>{{ a.slug }}</code></dd>
            </div>
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">模型</dt>
              <dd class="cd-admin-card-meta-value mb-0">{{ a.model }}</dd>
            </div>
            <div class="cd-admin-card-meta-row">
              <dt class="cd-admin-card-meta-label">提供商</dt>
              <dd class="cd-admin-card-meta-value mb-0">{{ providerLabel(a.provider) }}</dd>
            </div>
          </dl>
        </div>
        <div class="cd-admin-card-foot">
          <button type="button" class="btn btn-sm btn-outline-primary" title="调试" @click="openDebug(a)">
            <IconBug :size="15" /> 调试
          </button>
          <button type="button" class="btn btn-sm" @click="toggleEnabled(a)">
            {{ a.enabled ? '禁用' : '启用' }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost-secondary" title="编辑" @click="openEdit(a)">
            <IconPencil :size="15" />
          </button>
          <button
            v-if="auth.isSuperAdmin"
            type="button"
            class="btn btn-sm btn-ghost-danger ms-auto"
            title="删除"
            @click="remove(a)"
          >
            <IconTrash :size="15" />
          </button>
        </div>
      </article>

      <div v-if="loading && !agents.length" class="cd-admin-cards-empty">
        <div class="card">
          <div class="card-body text-center text-secondary">加载中…</div>
        </div>
      </div>
      <div v-else-if="!agents.length" class="cd-admin-cards-empty">
        <div class="card">
          <div class="card-body text-center text-secondary">暂无智能体，点击上方添加</div>
        </div>
      </div>
    </div>

    <div class="cd-admin-cards-pagination">
      <CdPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
    </div>

    <CdModal :show="showForm" :title="editing ? '编辑智能体' : '添加智能体'" size="lg" @close="showForm = false">
      <form @submit.prevent="save">
        <div class="modal-body">
          <div v-if="editing" class="mb-3">
            <label class="form-label">头像</label>
            <AvatarPicker
              kind="agent"
              mode="agent"
              presets-aside
              :target-id="editing.id"
              :avatar-url="editing.avatar_url"
              :name="form.name || editing.name"
              @updated="(url) => { if (editing) { editing.avatar_url = url; agentsStore.load(true) } }"
            />
          </div>
          <div class="row g-2">
            <div class="col-sm-6">
              <label class="form-label">名称</label>
              <input v-model="form.name" class="form-control" required placeholder="例如：智能问答" />
            </div>
            <div class="col-sm-6">
              <label class="form-label">标识（URL 用）</label>
              <input
                v-model="form.slug"
                class="form-control"
                required
                pattern="[a-z0-9][a-z0-9_-]*"
                placeholder="qa-assistant"
                :disabled="!!editing"
              />
            </div>
          </div>
          <div class="mb-3 mt-2">
            <label class="form-label">描述</label>
            <input v-model="form.description" class="form-control" placeholder="可选，显示在对话页" />
          </div>
          <div class="row g-2">
            <div class="col-sm-6">
              <label class="form-label">提供商</label>
              <select v-model="form.provider" class="form-select">
                <option v-for="p in providerOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
            <div class="col-sm-6">
              <label class="form-label">排序</label>
              <input v-model.number="form.sort_order" class="form-control" type="number" min="0" />
            </div>
          </div>
          <div class="mb-3 mt-2">
            <label class="form-label">API Base URL</label>
            <input v-model="form.base_url" class="form-control" required placeholder="https://api.openai.com/v1" />
            <p class="text-secondary small mb-0 mt-1">
              填到版本前缀即可（如 <code>…/v1</code>）。若已是完整地址 <code>…/v1/chat/completions</code>，对话路径请留空或填
              <code>/</code>，系统不会重复拼接。
            </p>
          </div>
          <div class="row g-2">
            <div class="col-sm-6">
              <label class="form-label">API Key</label>
              <input v-model="form.api_key" class="form-control" type="password" placeholder="sk-..." />
            </div>
            <div class="col-sm-6">
              <label class="form-label">模型</label>
              <input v-model="form.model" class="form-control" required placeholder="gpt-4o-mini" />
            </div>
          </div>
          <div class="mb-3 mt-2">
            <label class="form-label">系统提示词</label>
            <textarea v-model="form.system_prompt" class="form-control" rows="3" placeholder="可选，定义智能体角色与行为" />
          </div>
          <div class="row g-2">
            <div class="col-sm-4">
              <label class="form-label">对话路径</label>
              <input v-model="form.chat_path" class="form-control" placeholder="/chat/completions" />
            </div>
            <div class="col-sm-4">
              <label class="form-label">Temperature</label>
              <input v-model.number="form.temperature" class="form-control" type="number" min="0" max="2" step="0.1" />
            </div>
            <div class="col-sm-4">
              <label class="form-label">Max Tokens</label>
              <input v-model.number="form.max_tokens" class="form-control" type="number" min="1" />
            </div>
          </div>
          <label class="form-check mt-3">
            <input v-model="form.enabled" class="form-check-input" type="checkbox" />
            <span class="form-check-label">启用（显示在侧栏）</span>
          </label>

          <div class="mt-3 pt-3 border-top">
            <label class="form-label">访问权限</label>
            <select v-model="form.access_mode" class="form-select mb-2">
              <option value="all">全部登录用户</option>
              <option value="restricted">指定部门 / 用户</option>
            </select>
            <template v-if="form.access_mode === 'restricted'">
              <div class="mb-2">
                <label class="form-label small text-secondary">允许访问的部门</label>
                <select v-model="form.allowed_departments" class="form-select" multiple size="4">
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </div>
              <div class="mb-2">
                <label class="form-label small text-secondary">允许访问的用户</label>
                <select v-model="form.allowed_users" class="form-select" multiple size="4">
                  <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.username }}{{ u.real_name ? ` (${u.real_name})` : '' }}</option>
                </select>
              </div>
              <p class="text-secondary small mb-0">按住 Ctrl / Cmd 多选；未列入的用户无法看到该智能体（管理员除外）</p>
            </template>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="showForm = false">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">保存</button>
        </div>
      </form>
    </CdModal>

    <CdModal
      :show="showDebug"
      :title="debugTarget ? `调试 · ${debugTarget.name}` : '调试'"
      size="lg"
      @close="closeDebug"
    >
      <div class="modal-body cd-agent-debug">
        <div v-if="debugTarget" class="d-flex align-items-center gap-2 mb-3 pb-3 border-bottom">
          <CdAvatar :src="debugTarget.avatar_url" :name="debugTarget.name" kind="agent" size="sm" />
          <div class="min-w-0">
            <div class="fw-medium">{{ debugTarget.name }}</div>
            <div class="text-secondary small">
              <code>{{ debugTarget.slug }}</code>
              · {{ debugTarget.model }}
            </div>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            :disabled="debugTesting || debugSending"
            @click="debugTestConnection"
          >
            <IconPlugConnected :size="16" />
            {{ debugTesting ? '测试中…' : '测试连接' }}
          </button>
        </div>

        <label class="form-label">对话测试</label>
        <div class="input-group mb-2">
          <textarea
            v-model="debugInput"
            class="form-control"
            rows="3"
            placeholder="输入测试消息，Enter 发送"
            :disabled="debugSending"
            @keydown.enter.exact.prevent="debugSendMessage"
          />
          <button
            type="button"
            class="btn btn-primary d-inline-flex align-items-center gap-1"
            :disabled="debugSending || !debugInput.trim()"
            @click="debugSendMessage"
          >
            <IconSend :size="16" />
            {{ debugSending ? '发送中…' : '发送' }}
          </button>
        </div>

        <div v-if="debugReply" class="cd-agent-debug-reply">
          <AssistantReply :content="debugReply" />
        </div>
        <div v-if="debugError" class="text-danger small mt-2">{{ debugError }}</div>
        <p class="text-secondary small mb-0 mt-3">使用已保存的配置进行测试；若在编辑中修改了 API 参数，请先保存后再调试。</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-sm" @click="closeDebug">关闭</button>
      </div>
    </CdModal>

    <div class="toast-host" :class="{ show: toast.visible.value }">{{ toast.message.value }}</div>
  </div>
</template>
