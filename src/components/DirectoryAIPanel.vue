<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  IconArrowUp,
  IconFileText,
  IconFolder,
  IconMessageCircle,
  IconPaperclip,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-vue'
import { ApiError } from '@/api/client'
import * as agentsApi from '@/api/agents'
import type { AIDirectoryStatus, DocTextMatch } from '@/api/ai'
import type { AttachedFile, ChatMessage } from '@/types/agents'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import CdAvatar from '@/components/CdAvatar.vue'
import AssistantReply from '@/components/AssistantReply.vue'

const props = defineProps<{
  storageId: string
  path: string
  status: AIDirectoryStatus | null
}>()

const auth = useAuthStore()
const toast = useToast()
const input = ref('')
const sending = ref(false)
const uploading = ref(false)
const messages = ref<ChatMessage[]>([])
const attachments = ref<AttachedFile[]>([])
const matches = ref<DocTextMatch[]>([])
const listEl = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const agentId = computed(() => props.status?.agent_id || '')
const enabled = computed(() => props.status?.enabled && props.status?.can_use)

const pathLabel = computed(() => {
  const p = (props.path || '/').trim() || '/'
  if (p === '/' || p === '.') return '根目录'
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] || p
})

const pathHint = computed(() => {
  const p = (props.path || '/').trim() || '/'
  return p === '/' || p === '.' ? '/' : p
})

const suggestions = [
  '这个目录里有哪些重要文件？',
  '帮我概括主要文档内容',
  '有没有提到截止日期或待办？',
]

watch(
  () => [props.storageId, props.path],
  () => {
    messages.value = []
    attachments.value = []
    matches.value = []
  },
)

function scrollBottom() {
  requestAnimationFrame(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

function clearChat() {
  if (sending.value) return
  messages.value = []
  matches.value = []
  attachments.value = []
}

function useSuggestion(text: string) {
  input.value = text
}

function pickFiles() {
  fileInput.value?.click()
}

async function onFilesSelected(e: Event) {
  const el = e.target as HTMLInputElement
  const files = el.files
  if (!files?.length || !agentId.value) return
  uploading.value = true
  for (const file of Array.from(files)) {
    const pending: AttachedFile = {
      id: `pending-${Date.now()}-${file.name}`,
      filename: file.name,
      status: 'parsing',
    }
    attachments.value.push(pending)
    try {
      const doc = await agentsApi.uploadAgentFile(agentId.value, file)
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
        toast.show(isImage(file.name) ? `图片识别完成（${doc.char_count} 字）` : `已解析：${doc.filename}`)
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
  el.value = ''
  uploading.value = false
}

function isImage(name: string) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((a) => a.id !== id)
}

async function send() {
  const text = input.value.trim()
  if (!text || !agentId.value || sending.value || !enabled.value) return
  if (attachments.value.some((a) => a.status === 'parsing')) {
    toast.show('请等待文件解析完成')
    return
  }

  const userMsg: ChatMessage = { role: 'user', content: text }
  messages.value.push(userMsg)
  input.value = ''
  sending.value = true
  matches.value = []

  const assistantIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: '' })
  scrollBottom()

  const ctx = attachments.value.filter((a) => a.status === 'ready').map((a) => ({ file_id: a.id }))
  let streamed = ''

  try {
    await agentsApi.chatAgentStream(
      agentId.value,
      {
        messages: messages.value.slice(0, -1),
        context_files: ctx,
        scope: { storage_id: props.storageId, path: props.path },
      },
      (evt) => {
        if (evt.type === 'token') {
          streamed += evt.content
          messages.value[assistantIdx] = { role: 'assistant', content: streamed }
          scrollBottom()
        } else if (evt.type === 'matches') {
          matches.value = evt.matches
        } else if (evt.type === 'done') {
          messages.value[assistantIdx] = { role: 'assistant', content: evt.content }
          if (evt.matches?.length) matches.value = evt.matches
        } else if (evt.type === 'error') {
          throw new ApiError(evt.message)
        }
      },
    )
    attachments.value = []
  } catch (e) {
    messages.value.splice(assistantIdx, 1)
    messages.value.pop()
    input.value = text
    toast.show(e instanceof ApiError ? e.message : '发送失败')
  } finally {
    sending.value = false
    scrollBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <aside v-if="enabled" class="cd-ai-panel">
    <header class="cd-ai-panel-head">
      <div class="cd-ai-panel-brand">
        <span class="cd-ai-panel-icon" aria-hidden="true">
          <IconSparkles :size="16" :stroke="1.75" />
        </span>
        <div class="cd-ai-panel-heading">
          <h3 class="cd-ai-panel-title">AI 问答</h3>
          <p class="cd-ai-panel-path" :title="pathHint">
            <IconFolder :size="12" :stroke="1.75" />
            <span>{{ pathLabel }}</span>
          </p>
        </div>
      </div>
      <div class="cd-ai-panel-actions">
        <span
          v-if="status?.doc_count != null"
          class="cd-ai-index-badge"
          :title="`${status.doc_count} 份文件已索引`"
        >
          {{ status.doc_count }} 索引
        </span>
        <button
          v-if="messages.length"
          type="button"
          class="cd-ai-icon-btn"
          title="清空对话"
          :disabled="sending"
          @click="clearChat"
        >
          <IconTrash :size="15" :stroke="1.75" />
        </button>
      </div>
    </header>

    <div ref="listEl" class="cd-ai-panel-messages">
      <div v-if="!messages.length" class="cd-ai-panel-welcome">
        <div class="cd-ai-welcome-orb">
          <IconMessageCircle :size="22" :stroke="1.6" />
        </div>
        <p class="cd-ai-welcome-title">基于当前目录提问</p>
        <p class="cd-ai-welcome-desc">
          已索引文件会自动同步；可附带截图或文档定位原文
        </p>
        <div class="cd-ai-suggestions">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="cd-ai-suggestion"
            @click="useSuggestion(s)"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="cd-ai-msg"
        :class="msg.role === 'user' ? 'cd-ai-msg--user' : 'cd-ai-msg--assistant'"
      >
        <CdAvatar
          v-if="msg.role === 'user'"
          :src="auth.user?.avatar_url"
          :name="auth.displayName"
          kind="user"
          size="sm"
          class="cd-ai-msg-avatar"
        />
        <span v-else class="cd-ai-msg-bot" aria-hidden="true">
          <IconSparkles :size="14" :stroke="1.75" />
        </span>
        <div class="cd-ai-msg-main">
          <div class="cd-ai-msg-role">{{ msg.role === 'user' ? '你' : '助手' }}</div>
          <div class="cd-ai-msg-body">
            <template v-if="msg.role === 'assistant' && sending && i === messages.length - 1 && !msg.content">
              <span class="cd-ai-typing" aria-label="正在生成">
                <span /><span /><span />
              </span>
            </template>
            <template v-else-if="msg.role === 'user'">{{ msg.content }}</template>
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

    <section v-if="matches.length" class="cd-ai-matches" aria-label="可能原文位置">
      <div class="cd-ai-matches-head">
        <IconFileText :size="14" :stroke="1.75" />
        <span>可能原文 · {{ matches.length }}</span>
      </div>
      <div class="cd-ai-matches-list">
        <article v-for="(m, i) in matches" :key="i" class="cd-ai-match">
          <div class="cd-ai-match-top">
            <span class="cd-ai-match-name" :title="m.filename">{{ m.filename }}</span>
            <span v-if="m.score" class="cd-ai-match-score">{{ Math.round(m.score * 100) }}%</span>
          </div>
          <div v-if="m.path" class="cd-ai-match-path" :title="m.path">{{ m.path }}</div>
          <p v-if="m.snippet" class="cd-ai-match-snippet">{{ m.snippet }}</p>
        </article>
      </div>
    </section>

    <footer class="cd-ai-composer">
      <div v-if="attachments.length" class="cd-ai-attachments">
        <span
          v-for="att in attachments"
          :key="att.id"
          class="cd-ai-attach-chip"
          :class="{
            'cd-ai-attach-chip--ready': att.status === 'ready',
            'cd-ai-attach-chip--failed': att.status === 'failed',
            'cd-ai-attach-chip--parsing': att.status === 'parsing',
          }"
        >
          <IconPaperclip :size="12" />
          <span class="cd-ai-attach-name">{{ att.filename }}</span>
          <span v-if="att.status === 'parsing'" class="cd-ai-attach-meta">解析中</span>
          <span v-else-if="att.status === 'ready'" class="cd-ai-attach-meta">{{ att.char_count }} 字</span>
          <span v-else-if="att.error_msg" class="cd-ai-attach-meta cd-ai-attach-meta--err" :title="att.error_msg">失败</span>
          <button type="button" class="cd-ai-attach-remove" :title="'移除 ' + att.filename" @click="removeAttachment(att.id)">
            <IconX :size="12" />
          </button>
        </span>
      </div>

      <div class="cd-ai-input-shell">
        <input
          ref="fileInput"
          type="file"
          class="d-none"
          accept=".txt,.md,.docx,.pdf,.png,.jpg,.jpeg,.webp,image/*"
          @change="onFilesSelected"
        />
        <textarea
          v-model="input"
          class="cd-ai-textarea"
          rows="2"
          placeholder="问当前目录下的文件…"
          :disabled="sending"
          @keydown="onKeydown"
        />
        <div class="cd-ai-toolbar">
          <div class="cd-ai-toolbar-left">
            <span class="cd-ai-tool-pill" :title="pathHint">
              <IconFolder :size="14" :stroke="1.75" />
              <span>{{ pathLabel }}</span>
            </span>
          </div>
          <div class="cd-ai-toolbar-right">
            <button
              type="button"
              class="cd-ai-tool-icon"
              :disabled="sending || uploading"
              title="附带文件或截图"
              @click="pickFiles"
            >
              <IconPaperclip :size="20" :stroke="1.6" />
            </button>
            <button
              type="button"
              class="cd-ai-send"
              :disabled="sending || uploading || !input.trim()"
              title="发送"
              @click="send"
            >
              <IconArrowUp :size="18" :stroke="2.25" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.cd-ai-panel {
  width: 22.5rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(15, 23, 42, 0.08);
  background:
    linear-gradient(180deg, rgba(var(--cd-primary-rgb), 0.04) 0%, transparent 7.5rem),
    #f8fafc;
  min-height: 0;
}

.cd-ai-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.875rem 0.875rem 0.75rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.cd-ai-panel-brand {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  min-width: 0;
}

.cd-ai-panel-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.875rem;
  height: 1.875rem;
  border-radius: 0.5rem;
  color: var(--cd-primary);
  background: rgba(var(--cd-primary-rgb), 0.12);
  flex-shrink: 0;
}

.cd-ai-panel-heading {
  min-width: 0;
}

.cd-ai-panel-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: #0f172a;
  line-height: 1.25;
}

.cd-ai-panel-path {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0.2rem 0 0;
  max-width: 100%;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.2;
}

.cd-ai-panel-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-ai-panel-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.cd-ai-index-badge {
  display: inline-flex;
  align-items: center;
  height: 1.375rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--cd-primary);
  background: rgba(var(--cd-primary-rgb), 0.1);
  border: 1px solid rgba(var(--cd-primary-rgb), 0.14);
}

.cd-ai-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 0.4rem;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.cd-ai-icon-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.cd-ai-icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.cd-ai-panel-messages {
  flex: 1;
  overflow: auto;
  padding: 0.875rem;
  min-height: 8rem;
}

.cd-ai-panel-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.25rem 0.5rem 0.75rem;
}

.cd-ai-welcome-orb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  border-radius: 1rem;
  color: var(--cd-primary);
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.9), transparent 55%),
    rgba(var(--cd-primary-rgb), 0.12);
  box-shadow: 0 8px 20px rgba(var(--cd-primary-rgb), 0.12);
}

.cd-ai-welcome-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
}

.cd-ai-welcome-desc {
  margin: 0.375rem 0 0;
  max-width: 16rem;
  font-size: 0.75rem;
  line-height: 1.45;
  color: #64748b;
}

.cd-ai-suggestions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
  margin-top: 1rem;
}

.cd-ai-suggestion {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 0.625rem;
  background: #fff;
  color: #334155;
  font-size: 0.75rem;
  text-align: left;
  line-height: 1.35;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.cd-ai-suggestion:hover {
  border-color: rgba(var(--cd-primary-rgb), 0.35);
  background: rgba(var(--cd-primary-rgb), 0.04);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.cd-ai-msg {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
}

.cd-ai-msg--user {
  flex-direction: row-reverse;
}

.cd-ai-msg-avatar {
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.cd-ai-msg-bot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  margin-top: 0.15rem;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(
    145deg,
    var(--cd-primary) 0%,
    color-mix(in srgb, var(--cd-primary) 72%, #0f172a) 100%
  );
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(var(--cd-primary-rgb), 0.28);
}

.cd-ai-msg-main {
  min-width: 0;
  max-width: calc(100% - 2.25rem);
}

.cd-ai-msg--user .cd-ai-msg-main {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.cd-ai-msg-role {
  margin-bottom: 0.2rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #94a3b8;
}

.cd-ai-msg-body {
  padding: 0.55rem 0.7rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.cd-ai-msg--user .cd-ai-msg-body {
  color: #fff;
  background: linear-gradient(
    160deg,
    var(--cd-primary) 0%,
    color-mix(in srgb, var(--cd-primary) 82%, #1e3a8a) 100%
  );
  border-bottom-right-radius: 0.25rem;
  box-shadow: 0 4px 12px rgba(var(--cd-primary-rgb), 0.22);
}

.cd-ai-msg--assistant .cd-ai-msg-body {
  color: #1e293b;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-bottom-left-radius: 0.25rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  white-space: normal;
}

.cd-ai-typing {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  min-height: 1rem;
  padding: 0.15rem 0.1rem;
}

.cd-ai-typing span {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 999px;
  background: #94a3b8;
  animation: cd-ai-bounce 1.2s ease-in-out infinite;
}

.cd-ai-typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.cd-ai-typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes cd-ai-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  40% {
    transform: translateY(-0.2rem);
    opacity: 1;
  }
}

.cd-ai-cursor {
  animation: cd-ai-blink 1s step-end infinite;
}

@keyframes cd-ai-blink {
  50% {
    opacity: 0;
  }
}

.cd-ai-matches {
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  background: #fff;
  max-height: 9.5rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cd-ai-matches-head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.875rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
  flex-shrink: 0;
}

.cd-ai-matches-list {
  overflow: auto;
  padding: 0.25rem 0.75rem 0.625rem;
  min-height: 0;
}

.cd-ai-match {
  padding: 0.5rem 0.625rem;
  margin-bottom: 0.375rem;
  border-radius: 0.5rem;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.cd-ai-match:last-child {
  margin-bottom: 0;
}

.cd-ai-match-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.cd-ai-match-name {
  min-width: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-ai-match-score {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--cd-primary);
  background: rgba(var(--cd-primary-rgb), 0.1);
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
}

.cd-ai-match-path {
  margin-top: 0.15rem;
  font-size: 0.625rem;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-ai-match-snippet {
  margin: 0.35rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: #475569;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cd-ai-composer {
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  padding: 0.75rem;
  background: transparent;
}

.cd-ai-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.cd-ai-attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.2rem 0.4rem 0.2rem 0.45rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  color: #334155;
  background: #eef2ff;
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.cd-ai-attach-chip--ready {
  background: rgba(var(--cd-primary-rgb), 0.08);
  border-color: rgba(var(--cd-primary-rgb), 0.16);
  color: #1e293b;
}

.cd-ai-attach-chip--failed {
  background: #fef2f2;
  border-color: rgba(239, 68, 68, 0.2);
  color: #991b1b;
}

.cd-ai-attach-chip--parsing {
  background: #fff7ed;
  border-color: rgba(249, 115, 22, 0.2);
}

.cd-ai-attach-name {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-ai-attach-meta {
  color: #64748b;
  font-size: 0.625rem;
}

.cd-ai-attach-meta--err {
  color: #dc2626;
}

.cd-ai-attach-remove {
  display: inline-flex;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}

.cd-ai-attach-remove:hover {
  opacity: 1;
}

.cd-ai-input-shell {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 0.875rem 0.625rem;
  border-radius: 1.25rem;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px rgba(15, 23, 42, 0.06);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.cd-ai-input-shell:focus-within {
  border-color: rgba(var(--cd-primary-rgb), 0.35);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 0 0 3px rgba(var(--cd-primary-rgb), 0.1),
    0 8px 24px rgba(15, 23, 42, 0.06);
}

.cd-ai-textarea {
  width: 100%;
  min-height: 2.75rem;
  max-height: 7rem;
  padding: 0.15rem 0.15rem 0.35rem;
  border: 0;
  resize: none;
  background: transparent;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #0f172a;
  outline: none;
}

.cd-ai-textarea::placeholder {
  color: #94a3b8;
}

.cd-ai-textarea:disabled {
  opacity: 0.65;
}

.cd-ai-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 2rem;
}

.cd-ai-toolbar-left,
.cd-ai-toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.cd-ai-tool-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 9rem;
  height: 1.75rem;
  padding: 0 0.625rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--cd-primary);
  background: rgba(var(--cd-primary-rgb), 0.08);
  border: 1px solid rgba(var(--cd-primary-rgb), 0.22);
}

.cd-ai-tool-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-ai-tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.cd-ai-tool-icon:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.cd-ai-tool-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.cd-ai-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: color-mix(in srgb, var(--cd-primary) 72%, #93c5fd);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
}

.cd-ai-send:hover:not(:disabled) {
  background: var(--cd-primary);
  transform: translateY(-1px);
}

.cd-ai-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 1100px) {
  .cd-ai-panel {
    width: 20rem;
  }
}
</style>
