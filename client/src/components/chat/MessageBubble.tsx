import { useState } from 'react'
import { Copy, Check, Download, BookOpen, UserPlus, Brain, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, Inbox, FileText, Megaphone, Library, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Feedback, Message, Source } from '../../types'

interface Props {
  message: Message
  onSuggestionClick?: (q: string) => void
  onFeedback?: (messageId: string, value: Feedback) => void
}

/**
 * While a reply streams in, it still contains the raw <think>, <unanswered/>
 * and <suggestions> tags (the final text from the server has them removed).
 * Hide them, including a tag that has only partly arrived.
 */
function visibleWhileStreaming(text: string): string {
  return text
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')
    .replace(/<unanswered\s*\/?>/gi, '')
    .split('<suggestions')[0]
    .replace(/<[a-z/]*$/i, '')
}

/** Escapes text so model output can never inject HTML or scripts. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escapes, then applies inline formatting: **bold** and *italic*. */
function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\s](?:[^*]*?[^*\s])?)\*/g, '<em>$1</em>')
}

/**
 * Renders markdown to HTML. Block structure is detected on the raw line,
 * and every piece of text goes through renderInline (which escapes it):
 * - ### / ## / # Heading → <h3> / <h2> / <h1>
 * - > blockquote → <blockquote>
 * - numbered lists → <ol><li>
 * - bullet lists (- or *) → <ul><li>
 * - --- → <hr>
 * - **bold** / *italic* → <strong> / <em>
 * - blank line → spacing
 */
function renderMarkdown(text: string, citable: Set<number> = new Set()): string {
  const lines = text.split('\n')
  const html: string[] = []
  let inOl = false
  let inUl = false

  function closeOl() { if (inOl) { html.push('</ol>'); inOl = false; } }
  function closeUl() { if (inUl) { html.push('</ul>'); inUl = false; } }

  for (const line of lines) {
    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      closeOl(); closeUl()
      html.push('<hr class="my-3 border-gray-200"/>')
      continue
    }

    // ### Heading 3
    if (line.startsWith('### ')) {
      closeOl(); closeUl()
      html.push(`<h3 class="text-[16px] font-semibold text-gray-900 mt-4 mb-1">${renderInline(line.slice(4))}</h3>`)
      continue
    }

    // ## Heading 2
    if (line.startsWith('## ')) {
      closeOl(); closeUl()
      html.push(`<h2 class="text-[17px] font-semibold text-gray-900 mt-5 mb-1">${renderInline(line.slice(3))}</h2>`)
      continue
    }

    // # Heading 1
    if (line.startsWith('# ')) {
      closeOl(); closeUl()
      html.push(`<h1 class="text-[18px] font-semibold text-gray-900 mt-5 mb-2">${renderInline(line.slice(2))}</h1>`)
      continue
    }

    // > Blockquote
    if (line.startsWith('> ')) {
      closeOl(); closeUl()
      html.push(`<blockquote class="border-l-4 pl-3 py-0.5 my-2 text-gray-600 text-[15px] leading-7" style="border-color:#1A6B1A">${renderInline(line.slice(2))}</blockquote>`)
      continue
    }

    // Numbered list: 1. item
    const olMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (olMatch) {
      closeUl()
      if (!inOl) { html.push('<ol class="list-decimal pl-5 my-2 space-y-1">'); inOl = true; }
      html.push(`<li class="text-[15px] leading-7 text-gray-800">${renderInline(olMatch[2])}</li>`)
      continue
    }

    // Bullet list: - item or * item
    const ulMatch = line.match(/^[-*]\s+(.*)/)
    if (ulMatch) {
      closeOl()
      if (!inUl) { html.push('<ul class="list-disc pl-5 my-2 space-y-1">'); inUl = true; }
      html.push(`<li class="text-[15px] leading-7 text-gray-800">${renderInline(ulMatch[1])}</li>`)
      continue
    }

    // Empty line — close lists, add spacing (explicit close tag: <div/> is not self-closing in HTML)
    if (line.trim() === '') {
      closeOl(); closeUl()
      html.push('<div class="h-2"></div>')
      continue
    }

    // Regular paragraph line
    closeOl(); closeUl()
    html.push(`<p class="text-[15px] leading-7 text-gray-800">${renderInline(line)}</p>`)
  }

  closeOl(); closeUl()
  // Citations like [2] become small numbered markers (only for sources that exist)
  return html.join('').replace(/\[(\d{1,2})\]/g, (m, n) =>
    citable.has(Number(n)) ? `<sup class="cite" title="Source ${n}">${n}</sup>` : m)
}

/** Source numbers cited in the answer text, e.g. [1] and [3]. */
function citedNumbers(text: string): Set<number> {
  return new Set([...text.matchAll(/\[(\d{1,2})\]/g)].map(m => Number(m[1])))
}

const SOURCE_ICON = { builtin: Library, kb: BookOpen, document: FileText, announcement: Megaphone, web: Globe }

/** Sources the answer drew on — the ones it cited, or all retrieved ones if it cited none. */
function SourceList({ sources, cited }: { sources: Source[]; cited: Set<number> }) {
  const citedSources = sources.filter(s => cited.has(s.n))
  const shown = citedSources.length ? citedSources : sources
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 mb-1.5">{citedSources.length ? 'Sources' : 'Based on'}</p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(s => {
          const Icon = SOURCE_ICON[s.type] ?? BookOpen
          const body = (
            <>
              <span className="w-4 h-4 rounded-full text-[10px] font-semibold flex items-center justify-center flex-shrink-0"
                    style={{ background: '#e8f5e8', color: '#1A6B1A' }}>{s.n}</span>
              <Icon size={12} className="flex-shrink-0 text-gray-400" />
              <span className="truncate">{s.title}</span>
              {s.detail && <span className="hidden sm:inline truncate text-gray-400">· {s.detail}</span>}
            </>
          )
          const cls = 'inline-flex items-center gap-1.5 max-w-full sm:max-w-[320px] px-2 py-1 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-600'
          return s.url ? (
            <a key={s.n} href={s.url} target={s.type === 'web' ? '_blank' : undefined} rel="noreferrer"
               {...(s.type === 'document' ? { download: true } : {})}
               className={`${cls} hover:border-gray-300 hover:text-gray-900 transition-colors`}>{body}</a>
          ) : (
            <span key={s.n} className={cls}>{body}</span>
          )
        })}
      </div>
    </div>
  )
}

/** Collapsible panel showing the model's reasoning before its answer. */
function ReasoningPanel({ reasoning, thinking }: { reasoning: string; thinking: boolean }) {
  const [open, setOpen] = useState(false)
  const wordCount = reasoning.trim().split(/\s+/).length

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e0e0e0', background: '#fafafa' }}>
      <button onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
        <Brain size={13} style={{ color: '#1A6B1A' }} />
        <span className={`flex-1 ${thinking ? 'animate-pulse' : ''}`}>{thinking ? 'Thinking…' : 'Thought process'}</span>
        <span className="text-[10px] text-gray-400">{wordCount} words</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t max-h-72 overflow-y-auto scrollbar-thin" style={{ borderColor: '#e0e0e0' }}>
          {/* Rendered as plain text — React escapes it */}
          <p className="text-[12px] leading-relaxed text-gray-500 whitespace-pre-wrap italic">{reasoning}</p>
        </div>
      )}
    </div>
  )
}

/** Download URL for a document attached to a bot message. */
function documentHref(doc: { id?: string; name: string; cloudinary_url?: string | null }): string {
  if (doc.cloudinary_url) return doc.cloudinary_url
  return `/api/documents/${encodeURIComponent(doc.id ?? doc.name)}/download`
}

export default function MessageBubble({ message, onSuggestionClick, onFeedback }: Props) {
  const isUser  = message.role === 'user'
  const isNudge = message.isNudge === true
  const [copied, setCopied] = useState(false)

  async function copyText() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Signup nudge card ─────────────────────────────────────────
  if (isNudge) {
    return (
      <div className="flex justify-center">
        <div className="max-w-sm w-full rounded-2xl border p-4 shadow-sm"
             style={{ background: '#e8f5e8', borderColor: '#c8e6c8' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#155715' }}>
            💡 Enjoying IbbulAI?
          </p>
          <p className="text-[13px] mb-3" style={{ color: '#1A6B1A' }}>
            Create a free account to save your chat history and get personalised answers.
            Students use their matric number — takes less than a minute.
          </p>
          <div className="flex gap-2">
            <Link to="/register"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold"
              style={{ background: '#1A6B1A' }}>
              <UserPlus size={13} /> Create account
            </Link>
            <Link to="/login"
              className="flex-1 flex items-center justify-center py-2 rounded-xl text-xs font-semibold border"
              style={{ borderColor: '#c8e6c8', color: '#1A6B1A', background: 'white' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── User message — soft bubble on the right ──────────────────
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-[20px] rounded-br-md px-4 py-2.5 text-[15px] leading-7 text-gray-900 whitespace-pre-wrap break-words"
             style={{ background: '#eef3ec' }}>
          {message.content}
        </div>
      </div>
    )
  }

  // ── Bot message — Claude-style prose with markdown ────────────
  const shownText = message.streaming || message.stopped ? visibleWhileStreaming(message.content) : message.content
  const sources   = message.sources ?? []

  return (
    <div className="flex gap-3 flex-row">
      {/* IBBU logo avatar */}
      <img src="/logo.png" alt="IbbulAI"
           className="hidden sm:block w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />

      {/* Content */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* Model reasoning, shown before the answer */}
        {message.reasoning && (
          <ReasoningPanel reasoning={message.reasoning} thinking={!!message.streaming && !message.content} />
        )}

        <div>
          {/* Rendered markdown */}
          <div
            className="chat-prose"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(shownText, new Set(sources.map(s => s.n))) }}
          />
          {message.streaming && shownText && (
            <span className="inline-block w-1.5 h-3.5 align-middle rounded-sm animate-pulse" style={{ background: '#1A6B1A' }} />
          )}
        </div>

        {message.stopped && (
          <p className="text-[11px] text-gray-400 italic">Stopped — this reply wasn't finished.</p>
        )}

        {/* No verified answer — the question goes to the staff inbox */}
        {message.unanswered && (
          <p className="flex items-start gap-1.5 text-[11px] text-gray-500 rounded-lg px-2.5 py-1.5 w-fit"
             style={{ background: '#f5f5f5' }}>
            <Inbox size={12} className="flex-shrink-0 mt-px" style={{ color: '#1A6B1A' }} />
            IbbulAI had no verified information for this, so the question has been passed to university staff to review.
          </p>
        )}

        {/* Knowledge base sources (not for "no verified answer" replies) */}
        {!message.streaming && !message.unanswered && sources.length > 0 && (
          <SourceList sources={sources} cited={citedNumbers(message.content)} />
        )}

        {/* Document download */}
        {message.document && (
          <a href={documentHref(message.document)}
             download
             className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-all hover:shadow-sm w-fit"
             style={{ borderColor: '#c8e6c8', background: '#e8f5e8', color: '#1A6B1A' }}>
            <Download size={12} />
            {message.document?.name}
          </a>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && onSuggestionClick && (
          <div className="mt-1">
            <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5 mb-1">
              <BookOpen size={11} /> Related questions
            </p>
            <div className="flex flex-col border-t border-gray-100">
              {message.suggestions.map((s, i) => (
                <button key={i} onClick={() => onSuggestionClick(s)}
                  className="group flex items-center justify-between gap-3 text-left text-[14px] text-gray-700 py-2.5 border-b border-gray-100 hover:text-[#1A6B1A] transition-colors">
                  <span>{s}</span>
                  <ChevronRight size={15} className="flex-shrink-0 text-gray-300 group-hover:text-[#1A6B1A]" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5 -ml-1.5">
          {!message.streaming && message.content && (
            <button onClick={copyText} title="Copy" aria-label="Copy response"
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          )}
          {/* Was this helpful? */}
          {message.logId && onFeedback && !message.streaming && (
            <div className="flex items-center gap-0.5">
              {([1, -1] as const).map(value => {
                const Icon = value === 1 ? ThumbsUp : ThumbsDown
                const active = message.feedback === value
                return (
                  <button key={value} onClick={() => onFeedback(message.id, value)}
                    aria-pressed={active}
                    aria-label={value === 1 ? 'Helpful' : 'Not helpful'}
                    title={value === 1 ? 'Helpful' : 'Not helpful'}
                    className={`p-1.5 rounded-md transition-colors ${active ? '' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    style={active ? { color: value === 1 ? '#1A6B1A' : '#b91c1c', background: value === 1 ? '#e8f5e8' : '#fdecec' } : undefined}>
                    <Icon size={14} fill={active ? 'currentColor' : 'none'} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
