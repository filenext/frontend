<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconBrain, IconChevronDown } from '@tabler/icons-vue'
import { formatAnswerHtml, parseAssistantReply } from '@/utils/assistantReply'

const props = withDefaults(
  defineProps<{
    content: string
    streaming?: boolean
    showCursor?: boolean
  }>(),
  {
    streaming: false,
    showCursor: false,
  },
)

const parsed = computed(() => parseAssistantReply(props.content))
const open = ref(true)

watch(
  () => [parsed.value.hasThought, parsed.value.pending, props.streaming] as const,
  ([has, pending, streaming]) => {
    if (pending || streaming) open.value = true
    else if (has && !streaming) open.value = false
  },
  { immediate: true },
)

const answerHtml = computed(() => {
  if (parsed.value.answer) return formatAnswerHtml(parsed.value.answer)
  if (!parsed.value.hasThought && !parsed.value.pending && props.content) {
    return formatAnswerHtml(props.content)
  }
  return ''
})
</script>

<template>
  <div class="cd-assistant-reply">
    <div v-if="parsed.hasThought || parsed.pending" class="cd-assistant-think">
      <button type="button" class="cd-assistant-think-toggle" @click="open = !open">
        <IconBrain :size="14" :stroke="1.75" class="cd-assistant-think-icon" />
        <span class="cd-assistant-think-label">
          <template v-if="parsed.pending || (streaming && !parsed.answer)">思考中…</template>
          <template v-else>已深度思考</template>
        </span>
        <IconChevronDown
          :size="14"
          :stroke="1.75"
          class="cd-assistant-think-chevron"
          :class="{ 'is-open': open }"
        />
      </button>
      <div v-show="open" class="cd-assistant-think-body">
        {{ parsed.thought || (parsed.pending ? '正在组织思路…' : '') }}
      </div>
    </div>

    <div v-if="answerHtml" class="cd-assistant-answer" v-html="answerHtml" />
    <span v-if="showCursor" class="cd-assistant-cursor">▍</span>
  </div>
</template>

<style scoped>
.cd-assistant-reply {
  min-width: 0;
}

.cd-assistant-think {
  margin-bottom: 0.625rem;
}

.cd-assistant-think-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.45rem 0.2rem 0.35rem;
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.cd-assistant-think-toggle:hover {
  background: rgba(15, 23, 42, 0.05);
  color: #475569;
}

.cd-assistant-think-icon {
  color: #94a3b8;
}

.cd-assistant-think-chevron {
  transition: transform 0.18s ease;
  opacity: 0.7;
}

.cd-assistant-think-chevron.is-open {
  transform: rotate(180deg);
}

.cd-assistant-think-body {
  margin-top: 0.35rem;
  padding: 0.5rem 0.625rem;
  border-left: 2px solid rgba(148, 163, 184, 0.55);
  color: #64748b;
  font-size: 0.75rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.cd-assistant-answer {
  font-size: inherit;
  line-height: 1.65;
  color: #1e293b;
  word-break: break-word;
}

.cd-assistant-answer :deep(p) {
  margin: 0 0 0.65rem;
}

.cd-assistant-answer :deep(p:last-child) {
  margin-bottom: 0;
}

.cd-assistant-answer :deep(h1),
.cd-assistant-answer :deep(h2),
.cd-assistant-answer :deep(h3),
.cd-assistant-answer :deep(h4) {
  margin: 0.75rem 0 0.4rem;
  font-weight: 650;
  line-height: 1.35;
  color: #0f172a;
}

.cd-assistant-answer :deep(h1) { font-size: 1.15em; }
.cd-assistant-answer :deep(h2) { font-size: 1.08em; }
.cd-assistant-answer :deep(h3),
.cd-assistant-answer :deep(h4) { font-size: 1em; }

.cd-assistant-answer :deep(ul),
.cd-assistant-answer :deep(ol) {
  margin: 0.35rem 0 0.75rem;
  padding-left: 1.35rem;
}

.cd-assistant-answer :deep(li) {
  margin: 0.25rem 0;
}

.cd-assistant-answer :deep(li > p) {
  margin: 0;
}

.cd-assistant-answer :deep(strong) {
  font-weight: 700;
  color: #0f172a;
}

.cd-assistant-answer :deep(em) {
  font-style: italic;
}

.cd-assistant-answer :deep(code) {
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  background: rgba(15, 23, 42, 0.07);
  font-size: 0.88em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.cd-assistant-answer :deep(pre) {
  margin: 0.5rem 0 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.cd-assistant-answer :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
}

.cd-assistant-answer :deep(blockquote) {
  margin: 0.5rem 0;
  padding: 0.25rem 0 0.25rem 0.75rem;
  border-left: 3px solid rgba(var(--cd-primary-rgb), 0.35);
  color: #64748b;
}

.cd-assistant-answer :deep(hr) {
  margin: 0.75rem 0;
  border: 0;
  border-top: 1px solid rgba(15, 23, 42, 0.1);
}

.cd-assistant-answer :deep(a) {
  color: var(--cd-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cd-assistant-answer :deep(table) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0.5rem 0 0.75rem;
  border-collapse: collapse;
  font-size: 0.9em;
  overflow-x: auto;
}

.cd-assistant-answer :deep(th),
.cd-assistant-answer :deep(td) {
  padding: 0.4rem 0.55rem;
  border: 1px solid rgba(15, 23, 42, 0.1);
  text-align: left;
  vertical-align: top;
}

.cd-assistant-answer :deep(th) {
  background: rgba(15, 23, 42, 0.04);
  font-weight: 600;
  white-space: nowrap;
}

.cd-assistant-answer :deep(ul ul),
.cd-assistant-answer :deep(ol ol),
.cd-assistant-answer :deep(ul ol),
.cd-assistant-answer :deep(ol ul) {
  margin: 0.15rem 0 0.25rem;
}

.cd-assistant-cursor {
  animation: cd-assistant-blink 1s step-end infinite;
  color: var(--cd-primary);
}

@keyframes cd-assistant-blink {
  50% {
    opacity: 0;
  }
}
</style>
