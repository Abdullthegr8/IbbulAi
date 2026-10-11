import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SendHorizontal, RotateCcw } from 'lucide-react'
import MessageBubble from '../components/chat/MessageBubble'
import TypingIndicator from '../components/chat/TypingIndicator'
import { useChat } from '../hooks/useChat'
import { useAuth } from '../hooks/useAuth'

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const ROLE_SUBTITLE: Record<string, string> = {
  student: 'Ask me anything about admissions, fees, registration, exams or campus life.',
  staff:   'Ask about university procedures, or manage documents from the Staff Panel.',
  admin:   'Ask a question to test how IbbulAI responds.',
}

export default function ChatPage() {
  const { messages, loading, send, clear } = useChat()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const scrollRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const handledNav  = useRef<string | null>(null)
  const isEmpty = messages.length === 0

  // A question passed from the Home page (navigate('/chat', { state: { q } }))
  useEffect(() => {
    const q = (location.state as { q?: string } | null)?.q
    // Guard by navigation key: StrictMode runs effects twice in development
    if (q && handledNav.current !== location.key) {
      handledNav.current = location.key
      navigate(location.pathname, { replace: true, state: null })
      send(q)
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // Grow the textarea with its content, up to ~6 lines
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [input])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!input.trim() || loading) return
    send(input)
    setInput('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const firstName = user?.role === 'admin' ? 'Admin' : user?.name.split(' ')[0]

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#fafafa]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin relative">
        {/* Empty state — fades out on the first message */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center transition-all duration-300
                         ${isEmpty ? 'opacity-100' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <img src="/logo.png" alt="IbbulAI" className="w-16 h-16 rounded-full object-cover border-2 mb-4 shadow-sm"
               style={{ borderColor: '#1A6B1A' }} />
          <h2 className="font-display font-bold text-2xl text-gray-800">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            {user ? ROLE_SUBTITLE[user.role] : 'I\'m IbbulAI, the IBBU assistant. Ask me anything about the university.'}
          </p>
        </div>

        {!isEmpty && (
          <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
            {messages.map(m => (
              <div key={m.id} className="animate-msgSlideIn">
                <MessageBubble message={m} onSuggestionClick={loading ? undefined : send} />
              </div>
            ))}
            {loading && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <form onSubmit={submit} className="max-w-3xl mx-auto flex items-end gap-2">
          {!isEmpty && (
            <button type="button" onClick={clear} title="New conversation" aria-label="New conversation"
                    className="flex-shrink-0 w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <RotateCcw size={16} />
            </button>
          )}
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                    rows={1} maxLength={2000} placeholder="Ask about admissions, fees, registration…"
                    aria-label="Message"
                    className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] focus:ring-2 focus:ring-[#1A6B1A]/15 scrollbar-thin bg-gray-50" />
          <button type="submit" disabled={!input.trim() || loading} aria-label="Send"
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
                  style={{ background: '#1A6B1A' }}>
            <SendHorizontal size={17} />
          </button>
        </form>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          IbbulAI can make mistakes. Verify important details with the relevant university office.
        </p>
      </div>
    </div>
  )
}
