/** 解析智能体 / ReAct / DeepSeek 风格回复：思考过程 + 最终答案 */

import { marked } from 'marked'

export interface ParsedAssistantReply {
  thought: string
  answer: string
  hasThought: boolean
  /** 流式过程中 JSON 尚未闭合 */
  pending: boolean
}

marked.setOptions({
  gfm: true,
  breaks: true,
})

function extractBalancedJson(text: string): { json: string; rest: string; start: number } | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return {
          json: text.slice(start, i + 1),
          rest: text.slice(i + 1).trim(),
          start,
        }
      }
    }
  }
  return null
}

function extractThinkTags(text: string): { thought: string; answer: string } | null {
  const re = /<think>([\s\S]*?)<\/think>/i
  const m = text.match(re)
  if (!m) {
    if (/<think>/i.test(text) && !/<\/think>/i.test(text)) {
      return { thought: text.replace(/<think>/i, '').trim(), answer: '' }
    }
    return null
  }
  const thought = m[1].trim()
  const answer = text.replace(re, '').trim()
  return { thought, answer }
}

interface AgentJson {
  thought?: string
  reasoning?: string
  reasoning_content?: string
  action?: string
  action_input?: string | Record<string, unknown>
  answer?: string
  final_answer?: string
  content?: string
}

function unescapeCommon(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function stringifyActionInput(v: string | Record<string, unknown> | undefined): string {
  if (v == null) return ''
  if (typeof v === 'string') return unescapeCommon(v.trim())
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

function looksLikeAgentEnvelope(obj: AgentJson): boolean {
  return !!(
    obj.thought ||
    obj.reasoning ||
    obj.reasoning_content ||
    obj.action ||
    obj.action_input ||
    obj.final_answer ||
    obj.answer
  )
}

function scoreMarkdown(s: string): number {
  if (!s) return 0
  let score = s.length
  if (s.includes('\n')) score += 40
  if (/^#{1,4}\s/m.test(s)) score += 30
  if (/^(\s*[-*]|\s*\d+\.)\s/m.test(s)) score += 30
  if (/\*\*[^*]+\*\*/.test(s)) score += 15
  if (s.includes('|') && s.includes('\n')) score += 20
  // 惩罚仍像 JSON
  if (s.trimStart().startsWith('{')) score -= 80
  if (/"action"\s*:/.test(s) || /"thought"\s*:/.test(s)) score -= 60
  return score
}

function pickAnswer(rest: string, fromFields: string): string {
  const a = (rest || '').trim()
  const b = (fromFields || '').trim()
  if (!a) return b
  if (!b) return a
  // 两者相似时取排版更好的
  if (a.includes(b) || b.includes(a.replace(/\s+/g, ' ').slice(0, 80))) {
    return scoreMarkdown(a) >= scoreMarkdown(b) ? a : b
  }
  return scoreMarkdown(a) >= scoreMarkdown(b) ? a : b
}

/** 去掉答案里残留的 ReAct JSON 外壳 */
export function stripResidualAgentJson(answer: string): string {
  let s = (answer || '').trim()
  if (!s) return s
  // 整段就是 JSON
  if (s.startsWith('{') && (s.includes('"action"') || s.includes('"thought"'))) {
    const extracted = extractBalancedJson(s)
    if (extracted) {
      try {
        const obj = JSON.parse(extracted.json) as AgentJson
        if (looksLikeAgentEnvelope(obj)) {
          const inner = (
            stringifyActionInput(obj.action_input) ||
            obj.final_answer ||
            obj.answer ||
            obj.content ||
            ''
          ).trim()
          s = (extracted.rest || inner).trim() || inner
        }
      } catch {
        /* keep */
      }
    }
  }
  // 正文前残留 JSON
  const extracted = extractBalancedJson(s)
  if (extracted && extracted.start === 0) {
    try {
      const obj = JSON.parse(extracted.json) as AgentJson
      if (looksLikeAgentEnvelope(obj) && extracted.rest) {
        s = extracted.rest
      }
    } catch {
      /* keep */
    }
  }
  return s.trim()
}

export function parseAssistantReply(raw: string): ParsedAssistantReply {
  const text = (raw || '').trim()
  if (!text) {
    return { thought: '', answer: '', hasThought: false, pending: false }
  }

  const tagged = extractThinkTags(text)
  if (tagged) {
    return {
      thought: tagged.thought,
      answer: stripResidualAgentJson(tagged.answer),
      hasThought: !!tagged.thought,
      pending: /<think>/i.test(text) && !/<\/think>/i.test(text),
    }
  }

  const extracted = extractBalancedJson(text)
  if (!extracted) {
    if (text.startsWith('{') && (text.includes('"thought"') || text.includes('"action"'))) {
      const partialThought = text.match(/"thought"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]
      const thought = partialThought ? unescapeCommon(partialThought) : ''
      return {
        thought,
        answer: '',
        hasThought: true,
        pending: true,
      }
    }
    return { thought: '', answer: text, hasThought: false, pending: false }
  }

  try {
    const obj = JSON.parse(extracted.json) as AgentJson
    if (!looksLikeAgentEnvelope(obj) && extracted.start > 0) {
      // 文中的普通 JSON，不当作外壳
      return { thought: '', answer: text, hasThought: false, pending: false }
    }
    const thought = (
      obj.thought ||
      obj.reasoning ||
      obj.reasoning_content ||
      ''
    ).trim()
    const fromFields = (
      stringifyActionInput(obj.action_input) ||
      obj.final_answer ||
      obj.answer ||
      obj.content ||
      ''
    ).trim()
    const answer = stripResidualAgentJson(pickAnswer(extracted.rest, fromFields))
    if (thought || fromFields || obj.action) {
      return {
        thought,
        answer,
        hasThought: !!thought,
        pending: false,
      }
    }
  } catch {
    // fall through
  }

  return { thought: '', answer: text, hasThought: false, pending: false }
}

/** 将模型常见的「挤在一行」的 Markdown 适度拆行，便于渲染 */
export function normalizeMarkdown(src: string): string {
  let s = (src || '').replace(/\r\n/g, '\n').trim()
  if (!s) return s

  s = unescapeCommon(s)

  // 独立分隔线（不碰表格对齐行 | --- |）
  s = s
    .split('\n')
    .map((line) => {
      if (/^\s*\|/.test(line)) return line
      if (/^\s*-{3,}\s*$/.test(line)) return '---'
      // 正文里粘连的 ---
      if (!line.includes('|')) {
        return line.replace(/([^\n|])\s*-{3,}\s*([^\n|])/g, '$1\n\n---\n\n$2')
      }
      return line
    })
    .join('\n')

  // 标题挤在段落后：。###  （注意不要拆开 ### 本身）
  s = s.replace(/([^\n#])[ \t]*(?=#{1,4}[ \t])/g, '$1\n\n')

  // 同一行里挤在一起的编号列表：未知2. **xxx**
  s = s.replace(/([^\n\d])(?=\d+\.\s+\*?)/g, '$1\n')

  const newlineCount = (s.match(/\n/g) || []).length
  if (newlineCount < 4) {
    s = s
      // 中文序号
      .replace(/([：:。；;！!？?])\s*(?=[一二三四五六七八九十]+[、．.])/g, '$1\n')
      .replace(/([：:。；;！!？?])\s*(?=（\d+）)/g, '$1\n')
      // 段落后直接跟无序项
      .replace(/([：:。；;）)》」』`])(?=-\S)/g, '$1\n')
      .replace(/(`[^`]+`)(?=-\S)/g, '$1\n')
      .replace(/([^\n｜|])\s*(?=-\s*\*\*)/g, '$1\n')
  }

  // 列表标记后补空格
  s = s
    .replace(/^(\s*)-(?![\s-])/gm, '$1- ')
    .replace(/^(\s*\d+\.)(?!\s)/gm, '$1 ')
    .replace(/^(\s*[一二三四五六七八九十]+、)(?!\s)/gm, '$1 ')

  // 标题/列表前空行（GFM）；跳过表格行
  s = s
    .split('\n')
    .reduce<string[]>((acc, line, i, arr) => {
      const prev = acc[acc.length - 1]
      const isHeading = /^#{1,4}\s/.test(line)
      const isList = /^\s*([-*]|\d+\.)\s/.test(line)
      const prevIsTable = prev != null && /^\s*\|/.test(prev)
      const prevBlank = prev == null || prev.trim() === ''
      if ((isHeading || isList) && prev != null && !prevBlank && !prevIsTable && !/^#{1,4}\s/.test(prev)) {
        acc.push('')
      }
      acc.push(line)
      // 标题后空行
      if (isHeading && i + 1 < arr.length && arr[i + 1].trim() && !/^#{1,4}\s/.test(arr[i + 1])) {
        acc.push('')
      }
      return acc
    }, [])
    .join('\n')

  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

/** Markdown → HTML（GFM） */
export function formatAnswerHtml(src: string): string {
  const cleaned = stripResidualAgentJson(src)
  const normalized = normalizeMarkdown(cleaned)
  if (!normalized) return ''
  try {
    return marked.parse(normalized, { async: false }) as string
  } catch {
    return normalized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />')
  }
}
