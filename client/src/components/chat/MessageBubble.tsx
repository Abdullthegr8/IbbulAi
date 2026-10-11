import { useState } from 'react'
import { Copy, Check, Download, BookOpen, UserPlus, Brain, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import type { Message } from '../../types'

// `reasoning` is returned by POST /api/chat alongside the answer
type BotMessage = Message & { reasoning?: string | null }

interface Props {
  message: BotMessage
  onSuggestionClick?: (q: string) => void
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
function renderMarkdown(text: string): string {
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
      html.push(`<h3 class="text-[14px] font-semibold text-gray-800 mt-4 mb-1">${renderInline(line.slice(4))}</h3>`)
      continue
    }

    // ## Heading 2
    if (line.startsWith('## ')) {
      closeOl(); closeUl()
      html.push(`<h2 class="text-[15px] font-bold text-gray-900 mt-5 mb-1">${renderInline(line.slice(3))}</h2>`)
      continue
    }

    // # Heading 1
    if (line.startsWith('# ')) {
      closeOl(); closeUl()
      html.push(`<h1 class="text-[16px] font-bold text-gray-900 mt-5 mb-2">${renderInline(line.slice(2))}</h1>`)
      continue
    }

    // > Blockquote
    if (line.startsWith('> ')) {
      closeOl(); closeUl()
      html.push(`<blockquote class="border-l-4 pl-3 py-0.5 my-2 text-gray-600 italic text-[13px]" style="border-color:#1A6B1A">${renderInline(line.slice(2))}</blockquote>`)
      continue
    }

    // Numbered list: 1. item
    const olMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (olMatch) {
      closeUl()
      if (!inOl) { html.push('<ol class="list-decimal pl-5 my-2 space-y-1">'); inOl = true; }
      html.push(`<li class="text-[13px] leading-relaxed text-gray-800">${renderInline(olMatch[2])}</li>`)
      continue
    }

    // Bullet list: - item or * item
    const ulMatch = line.match(/^[-*]\s+(.*)/)
    if (ulMatch) {
      closeOl()
      if (!inUl) { html.push('<ul class="list-disc pl-5 my-2 space-y-1">'); inUl = true; }
      html.push(`<li class="text-[13px] leading-relaxed text-gray-800">${renderInline(ulMatch[1])}</li>`)
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
    html.push(`<p class="text-[13px] leading-relaxed text-gray-800">${renderInline(line)}</p>`)
  }

  closeOl(); closeUl()
  return html.join('')
}

/** Collapsible panel showing the model's reasoning before its answer. */
function ReasoningPanel({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false)
  const wordCount = reasoning.trim().split(/\s+/).length

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e0e0e0', background: '#fafafa' }}>
      <button onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
        <Brain size={13} style={{ color: '#1A6B1A' }} />
        <span className="flex-1">Thought process</span>
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

export default function MessageBubble({ message, onSuggestionClick }: Props) {
  const isUser  = message.role === 'user'
  const isNudge = (message as any).isNudge === true
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

  // ── User message — green bubble ───────────────────────────────
  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
             style={{ background: '#1A6B1A' }}>
          You
        </div>
        <div className="flex flex-col items-end gap-1 max-w-[80%] sm:max-w-[70%]">
          <div className="rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed text-white shadow-sm"
               style={{ background: '#1A6B1A' }}>
            {message.content}
          </div>
          <span className="text-[10px] text-gray-400 px-1">
            {format(message.timestamp, 'h:mm a')}
          </span>
        </div>
      </div>
    )
  }

  // ── Bot message — Claude-style prose with markdown ────────────
  return (
    <div className="flex gap-3 flex-row">
      {/* IBBU logo avatar */}
      <img src="/logo.png" alt="IbbulAI"
           className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 shadow-sm mt-0.5"
           style={{ borderColor: '#e8f5e8' }} />

      {/* Content */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* Model reasoning, shown before the answer */}
        {message.reasoning && <ReasoningPanel reasoning={message.reasoning} />}

        <div className="relative group">
          {/* Rendered markdown */}
          <div
            className="chat-prose"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
          {/* Copy button on hover */}
          <button onClick={copyText}
            className="absolute -top-1 right-0 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy response">
            {copied
              ? <Check size={11} className="text-green-600" />
              : <Copy size={11} className="text-gray-400" />}
          </button>
        </div>

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
          <div className="flex flex-col gap-1.5 mt-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              <BookOpen size={10} /> You might also ask
            </p>
            <div className="flex flex-col gap-1.5">
              {message.suggestions.map((s, i) => (
                <button key={i} onClick={() => onSuggestionClick(s)}
                  className="text-left text-[12px] font-medium px-3 py-2 rounded-xl border transition-all hover:shadow-sm w-fit max-w-full"
                  style={{ borderColor: '#c8e6c8', background: '#f0faf0', color: '#1A6B1A' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <span className="text-[10px] text-gray-400">
          {format(message.timestamp, 'h:mm a')}
        </span>
      </div>
    </div>
  )
}
