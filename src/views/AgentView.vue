<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { IconArrowUp, IconPaperclip, IconSparkles, IconX } from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as agentsApi from '@/api/agents'
import type { AgentRow, AttachedFile, ChatMessage } from '@/types/agents'
import { useAgentsStore } from '@/stores/agents'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import CdAvatar from '@/components/CdAvatar.vue'
import AssistantReply from '@/components/AssistantReply.vue'

const route = useRoute()
const agentsStore = useAgentsStore()
const auth = useAuthStore()
const toast = useToast()

const agent = ref<AgentRow | null>(null)
const loading = ref(true)
const sending = ref(false)
const uploading = ref(false)
const input = ref('')
const messages = ref<ChatMessage[]>([])
const attachments = ref<AttachedFile[]>([])
const listEl = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const abortCtrl = ref<AbortController | null>(null)

const slug = computed(() => String(route.params.slug || ''))

async function loadAgent() {
  loading.value = true
  await agentsStore.load()
  const found = agentsStore.agentBySlug(slug.value)
  if (!found) {
    agent.value = null
    loading.value = false
    return
  }
  try {
    agent.value = await agentsApi.getAgent(found.id)
  } catch (e) {
    agent.value = found
    if (e instanceof ApiError) toast.show(e.message)
  } finally {
    loading.value = false
  }
}

async function scrollBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

function contextFiles() {
  return attachments.value
    .filter((a) => a.status === 'ready')
    .map((a) => ({ file_id: a.id }))
}

function pickFiles() {
  fileInput.value?.click()
}

async function onFilesSelected(e: Event) {
  const inputEl = e.target as HTMLInputElement
  const files = inputEl.files
  if (!files?.length || !agent.value) return
  uploading.value = true
  for (const file of Array.from(files)) {
    const pending: AttachedFile = {
      id: `pending-${Date.now()}-${file.name}`,
      filename: file.name,
      status: 'parsing',
    }
    attachments.value.push(pending)
    try {
      const doc = await agentsApi.uploadAgentFile(agent.value.id, file)
      const idx = attachments.value.findIndex((a) => a.id === pending.id)
      const attached: AttachedFile = {
        id: doc.id,
        filename: doc.filename,
        status: doc.status,
        error_msg: doc.error_msg,
        char_count: doc.char_count,
      }
      if (idx >= 0) attachments.value[idx] = attached
      else attachments.value.push(attached)
      if (doc.status === 'ready') {
        toast.show(`已解析：${doc.filename}（${doc.char_count} 字）`)
      } else {
        toast.show(doc.error_msg || `解析失败：${doc.filename}`)
      }
    } catch (err) {
      const idx = attachments.value.findIndex((a) => a.id === pending.id)
      if (idx >= 0) {
        attachments.value[idx] = {
          ...pending,
          status: 'failed',
          error_msg: err instanceof ApiError ? err.message : '上传失败',
        }
      }
      toast.show(err instanceof ApiError ? err.message : '上传失败')
    }
  }
  inputEl.value = ''
  uploading.value = false
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((a) => a.id !== id)
}

async function send() {
  const text = input.value.trim()
  if (!text || !agent.value || sending.value) return
  if (attachments.value.some((a) => a.status === 'parsing')) {
    toast.show('请等待文件解析完成')
    return
  }

  const userMsg: ChatMessage = { role: 'user', content: text }
  messages.value.push(userMsg)
  const ctx = contextFiles()
  input.value = ''
  sending.value = true

  const assistantIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: '' })
  await scrollBottom()

  abortCtrl.value = new AbortController()
  let streamed = ''

  try {
    await agentsApi.chatAgentStream(
      agent.value.id,
      { messages: messages.value.slice(0, -1), context_files: ctx },
      (evt) => {
        if (evt.type === 'token') {
          streamed += evt.content
          messages.value[assistantIdx] = { role: 'assistant', content: streamed }
          scrollBottom()
        } else if (evt.type === 'done') {
          messages.value[assistantIdx] = { role: 'assistant', content: evt.content }
        } else if (evt.type === 'error') {
          throw new ApiError(evt.message)
        }
      },
      abortCtrl.value.signal,
    )
    attachments.value = []
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    messages.value.splice(assistantIdx, 1)
    messages.value.pop()
    input.value = text
    toast.show(e instanceof ApiError ? e.message : '发送失败')
  } finally {
    sending.value = false
    abortCtrl.value = null
    scrollBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

watch(slug, loadAgent)
onMounted(loadAgent)
</script>

<template>
  <div class="cd-agent-page">
    <div v-if="loading" class="cd-agent-empty">加载中…</div>
    <div v-else-if="!agent" class="cd-agent-empty">
      <p>智能体不存在或未启用</p>
    </div>
    <template v-else>
      <header class="cd-agent-header">
        <div class="cd-agent-header-main">
          <CdAvatar :src="agent.avatar_url" :name="agent.name" kind="agent" size="md" />
          <div>
            <h1 class="cd-agent-title">{{ agent.name }}</h1>
            <p v-if="agent.description" class="cd-agent-desc">{{ agent.description }}</p>
            <p v-else class="cd-agent-desc">模型 {{ agent.model }} · 支持 SSE 流式 · 文件问答</p>
          </div>
        </div>
      </header>

      <div ref="listEl" class="cd-agent-messages">
        <div v-if="!messages.length" class="cd-agent-welcome">
          <CdAvatar :src="agent.avatar_url" :name="agent.name" kind="agent" size="lg" />
          <p class="mb-1 mt-2">开始与「{{ agent.name }}」对话</p>
          <p class="text-secondary small mb-0">可上传 txt/md/docx/pdf 等文件进行问答，Enter 发送</p>
        </div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="cd-agent-msg"
          :class="msg.role === 'user' ? 'cd-agent-msg--user' : 'cd-agent-msg--assistant'"
        >
          <CdAvatar
            v-if="msg.role === 'user'"
            :src="auth.user?.avatar_url"
            :name="auth.displayName"
            kind="user"
            size="sm"
            class="cd-agent-msg-avatar"
          />
          <CdAvatar
            v-else
            :src="agent.avatar_url"
            :name="agent.name"
            kind="agent"
            size="sm"
            class="cd-agent-msg-avatar"
          />
          <div class="cd-agent-msg-content">
            <div class="cd-agent-msg-role">{{ msg.role === 'user' ? '你' : agent.name }}</div>
            <div class="cd-agent-msg-body" :class="{ 'cd-agent-msg-body--rich': msg.role === 'assistant' }">
              <template v-if="msg.role === 'user'">{{ msg.content }}</template>
              <AssistantReply
                v-else
                :content="msg.content"
                :streaming="sending && i === messages.length - 1"
                :show-cursor="sending && i === messages.length - 1 && !!msg.content"
              />
            </div>
          </div>
        </div>
      </div>

      <footer class="cd-agent-input-bar">
        <div v-if="attachments.length" class="cd-agent-attachments">
          <span
            v-for="att in attachments"
            :key="att.id"
            class="cd-agent-attach-chip"
            :class="{
              'cd-agent-attach-chip--ready': att.status === 'ready',
              'cd-agent-attach-chip--failed': att.status === 'failed',
              'cd-agent-attach-chip--parsing': att.status === 'parsing',
            }"
          >
            <IconPaperclip :size="14" />
            <span class="cd-agent-attach-name">{{ att.filename }}</span>
            <span v-if="att.status === 'parsing'" class="cd-agent-attach-meta">解析中…</span>
            <span v-else-if="att.status === 'ready'" class="cd-agent-attach-meta">{{ att.char_count }} 字</span>
            <span v-else-if="att.error_msg" class="cd-agent-attach-meta cd-agent-attach-meta--err" :title="att.error_msg">失败</span>
            <button type="button" class="cd-agent-attach-remove" @click="removeAttachment(att.id)">
              <IconX :size="14" />
            </button>
          </span>
        </div>

        <div class="cd-agent-input-shell">
          <input
            ref="fileInput"
            type="file"
            class="d-none"
            multiple
            accept=".txt,.md,.markdown,.json,.csv,.xml,.html,.htm,.yaml,.yml,.docx,.pdf,.log,.ini,.cfg,.conf,.go,.py,.js,.ts,.vue,.sql,image/*"
            @change="onFilesSelected"
          />
          <textarea
            v-model="input"
            class="cd-agent-textarea"
            rows="2"
            :placeholder="`给 ${agent.name} 发送消息`"
            :disabled="sending"
            @keydown="onKeydown"
          />
          <div class="cd-agent-toolbar">
            <div class="cd-agent-toolbar-left">
              <span class="cd-agent-tool-pill">
                <IconSparkles :size="14" :stroke="1.75" />
                <span>文件问答</span>
              </span>
            </div>
            <div class="cd-agent-toolbar-right">
              <button
                type="button"
                class="cd-agent-tool-icon"
                :disabled="sending || uploading"
                title="上传文件"
                @click="pickFiles"
              >
                <IconPaperclip :size="22" :stroke="1.6" />
              </button>
              <button
                type="button"
                class="cd-agent-send"
                :disabled="sending || uploading || !input.trim()"
                title="发送"
                @click="send"
              >
                <IconArrowUp :size="20" :stroke="2.25" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.cd-agent-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
  border-radius: 0.5rem;
  border: 1px solid var(--tblr-border-color);
  overflow: hidden;
}

.cd-agent-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--tblr-secondary);
}

.cd-agent-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--tblr-border-color);
  background: #fafbfc;
}

.cd-agent-header-main {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.cd-agent-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.cd-agent-desc {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--tblr-secondary);
}

.cd-agent-messages {
  flex: 1;
  overflow: auto;
  padding: 1rem 1.25rem;
  min-height: 0;
}

.cd-agent-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 12rem;
  text-align: center;
  color: var(--tblr-secondary);
}

.cd-agent-msg {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  max-width: 42rem;
  margin-bottom: 1rem;
}

.cd-agent-msg--user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.cd-agent-msg--user .cd-agent-msg-content {
  align-items: flex-end;
}

.cd-agent-msg-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.cd-agent-msg-avatar {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.cd-agent-msg--user .cd-agent-msg-body {
  background: var(--cd-primary-soft);
  color: var(--cd-primary);
}

.cd-agent-msg-role {
  font-size: 0.75rem;
  color: var(--tblr-secondary);
  margin-bottom: 0.25rem;
}

.cd-agent-msg-body {
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  background: #f4f6fb;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.cd-agent-msg-body--rich {
  white-space: normal;
}

.cd-agent-input-bar {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem 1.25rem 1.125rem;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  background: #f8fafc;
}

.cd-agent-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.cd-agent-attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  max-width: 100%;
}

.cd-agent-attach-chip--ready {
  background: rgba(var(--cd-primary-rgb), 0.08);
  border-color: rgba(var(--cd-primary-rgb), 0.18);
}

.cd-agent-attach-chip--failed {
  background: #fef2f2;
  border-color: #fecaca;
}

.cd-agent-attach-chip--parsing {
  background: #fff7ed;
  border-color: rgba(249, 115, 22, 0.22);
}

.cd-agent-attach-name {
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-agent-attach-meta {
  font-size: 0.6875rem;
  color: #64748b;
}

.cd-agent-attach-meta--err {
  color: #dc2626;
}

.cd-agent-attach-remove {
  border: none;
  background: transparent;
  padding: 0;
  display: inline-flex;
  color: var(--tblr-secondary);
  cursor: pointer;
}

.cd-agent-attach-remove:hover {
  color: var(--tblr-danger);
}

.cd-agent-input-shell {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 48rem;
  width: 100%;
  margin: 0 auto;
  padding: 0.875rem 1rem 0.75rem;
  border-radius: 1.5rem;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 10px 28px rgba(15, 23, 42, 0.06);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.cd-agent-input-shell:focus-within {
  border-color: rgba(var(--cd-primary-rgb), 0.35);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 0 0 3px rgba(var(--cd-primary-rgb), 0.1),
    0 10px 28px rgba(15, 23, 42, 0.06);
}

.cd-agent-textarea {
  width: 100%;
  min-height: 3rem;
  max-height: 9rem;
  padding: 0.15rem 0.2rem 0.35rem;
  border: 0;
  resize: none;
  background: transparent;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: #0f172a;
  outline: none;
}

.cd-agent-textarea::placeholder {
  color: #94a3b8;
}

.cd-agent-textarea:disabled {
  opacity: 0.65;
}

.cd-agent-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.25rem;
}

.cd-agent-toolbar-left,
.cd-agent-toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.cd-agent-tool-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 2rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--cd-primary);
  background: rgba(var(--cd-primary-rgb), 0.08);
  border: 1px solid rgba(var(--cd-primary-rgb), 0.22);
}

.cd-agent-tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.cd-agent-tool-icon:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.cd-agent-tool-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.cd-agent-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: color-mix(in srgb, var(--cd-primary) 72%, #93c5fd);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
}

.cd-agent-send:hover:not(:disabled) {
  background: var(--cd-primary);
  transform: translateY(-1px);
}

.cd-agent-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}
</style>
