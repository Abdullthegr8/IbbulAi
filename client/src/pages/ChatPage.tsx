import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowUp, Square, FileText, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import MessageBubble from '../components/chat/MessageBubble'
import TypingIndicator from '../components/chat/TypingIndicator'
import AnnouncementBanner from '../components/chat/AnnouncementBanner'
import { useChat } from '../hooks/useChat'
import type { ChatDocument } from '../hooks/useChat'
import { useAuth } from '../hooks/useAuth'
import type { Feedback, Role } from '../types'

const GREEN = '#1A6B1A'

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const STARTERS: Record<Role | 'guest', string[]> = {
  guest:   ['What are the admission requirements?', 'How do I pay my school fees?', 'How do I register my courses?', 'How is hostel allocation done?'],
  student: ['How do I pay my school fees?', 'How do I register my courses?', 'How do I check my results?', 'How do I request a transcript?'],
  staff:   ['How do students request transcripts?', 'What documents do new students need for clearance?', 'How does course registration work?', 'What are the graduation requirements?'],
  admin:   ['What are the admission requirements?', 'How do I pay my school fees?', 'How is hostel allocation done?', 'What are the graduation requirements?'],
}

const DOCUMENT_STARTERS = [
  'Summarise this document',
  'What are the key dates or deadlines in it?',
  'Who is this document for?',
]

export default function ChatPage() {
  const {
    messages, conversationId, document, loading, opening,
    send, stop, newChat, openConversation, rate,
  } = useChat()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { conversationId: routeId } = useParams()
  const [input, setInput] = useState('')
  const scrollRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const handledNav  = useRef<string | null>(null)
  const lastRouteId = useRef<string | undefined>(undefined)
  const isEmpty  = messages.length === 0
  const centered = isEmpty && !opening

  // The URL decides which conversation is open. Only react when it changes —
  // a newly saved conversation updates the state first, then the URL.
  useEffect(() => {
    if (routeId === lastRouteId.current) return
    lastRouteId.current = routeId
    if (!routeId) {
      if (conversationId) newChat()
    } else if (routeId !== conversationId) {
      openConversation(routeId).catch(() => {
        toast.error('That conversation could not be opened')
        navigate('/chat', { replace: true })
      })
    }
  }, [routeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Give a newly saved conversation its own URL
  useEffect(() => {
    if (conversationId && conversationId !== routeId) {
      lastRouteId.current = conversationId
      navigate(`/chat/${conversationId}`, { replace: true })
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // "New chat" ({ fresh }), a question from the Home page ({ q }) or a document from the Documents page ({ doc })
  useEffect(() => {
    const state = location.state as { q?: string; doc?: ChatDocument; fresh?: number } | null
    // Guard by navigation key: StrictMode runs effects twice in development
    if (!state || handledNav.current === location.key) return
    handledNav.current = location.key
    navigate(location.pathname, { replace: true, state: null })
    if (state.doc) newChat(state.doc)
    else if (state.q) send(state.q)
    else if (state.fresh) { newChat(); setInput(''); textareaRef.current?.focus() }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // Grow the textarea with its content, up to ~8 lines
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
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

  function exitDocument() {
    newChat()
    if (routeId) navigate('/chat')
  }

  async function onFeedback(messageId: string, value: Feedback) {
    const previous = messages.find(m => m.id === messageId)?.feedback
    try {
      await rate(messageId, value)
      if (value === -1 && previous !== -1) toast.success('Thanks — university staff will review this answer.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const firstName = user?.role === 'admin' ? 'Admin' : user?.name.split(' ')[0]
  // The empty streaming reply is shown as the typing indicator until text arrives
  const shown   = messages.filter(m => !(m.streaming && !m.content && !m.reasoning))
  const waiting = messages.some(m => m.streaming && !m.content && !m.reasoning)
  const starters = document ? DOCUMENT_STARTERS : STARTERS[user?.role ?? 'guest']

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <AnnouncementBanner />

      <div ref={scrollRef}
           className={`overflow-y-auto scrollbar-thin relative ${centered ? 'flex-1 sm:flex-none sm:mt-auto' : 'flex-1'}`}>
        {opening ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin" style={{ color: GREEN }} />
          </div>
        ) : isEmpty ? (
          // Empty state: vertically centred on mobile; on larger screens it sits just above the centred composer
          <div className="h-full sm:h-auto flex flex-col items-center justify-center px-4 py-8 sm:pt-0 sm:pb-6 text-center animate-fadeIn">
            <div className="flex items-center gap-3 justify-center">
              <img src="/logo.png" alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0" />
              <h1 className="font-display font-semibold text-[26px] sm:text-[34px] leading-tight text-gray-800">
                {document ? 'Ask about this document' : <>{greeting()}{firstName ? `, ${firstName}` : ''}</>}
              </h1>
            </div>
            <p className="text-[14px] text-gray-500 mt-3 max-w-md">
              {document
                ? <>Answers come only from <span className="font-medium text-gray-700">{document.name}</span>.</>
                : 'Ask about admissions, fees, registration, exams or campus life. I search the IBBU knowledge base first.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-2xl">
              {starters.map(q => (
                <button key={q} onClick={() => send(q)} disabled={loading}
                        className="text-[13px] px-3.5 py-2 rounded-full border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-4 flex flex-col gap-7">
            {shown.map(m => (
              <div key={m.id} className="animate-msgSlideIn">
                <MessageBubble message={m} onSuggestionClick={loading ? undefined : send} onFeedback={onFeedback} />
              </div>
            ))}
            {waiting && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className={`flex-shrink-0 px-3 sm:px-6 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-white ${centered ? 'sm:mb-auto sm:pb-10' : ''}`}>
        <form onSubmit={submit} className="max-w-3xl mx-auto w-full">
          <div className="rounded-[22px] border border-gray-200 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] focus-within:border-gray-300 transition-colors">
            {document && (
              <div className="flex items-center gap-1.5 mx-3 mt-3 pl-2.5 pr-1.5 py-1 rounded-lg text-[12px] w-fit max-w-[calc(100%-1.5rem)]"
                   style={{ background: '#e8f5e8', color: '#155715' }}>
                <FileText size={13} className="flex-shrink-0" />
                <span className="truncate font-medium">{document.name}</span>
                {!conversationId && (
                  <button type="button" onClick={exitDocument} aria-label="Stop asking about this document" title="Remove"
                          className="p-0.5 rounded hover:bg-black/5 flex-shrink-0">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                      rows={1} maxLength={2000} autoFocus={centered}
                      placeholder={document ? `Ask about ${document.name}…` : 'How can I help you today?'}
                      aria-label="Message"
                      className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-base sm:text-[15px] leading-6 outline-none placeholder:text-gray-400 scrollbar-thin" />
            <div className="flex items-center justify-between gap-2 pl-4 pr-2.5 pb-2.5 pt-1">
              <span className="text-[11px] text-gray-400 truncate">
                {document ? 'Document mode' : 'IBBU knowledge base'}
              </span>
              {loading ? (
                <button type="button" onClick={stop} aria-label="Stop generating" title="Stop"
                        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white"
                        style={{ background: '#155715' }}>
                  <Square size={12} fill="currentColor" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} aria-label="Send"
                        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-opacity"
                        style={{ background: GREEN }}>
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </div>
        </form>
        <p className="text-center text-[11px] text-gray-400 mt-2 px-2">
          IbbulAI can make mistakes. Verify important details with the relevant university office.
        </p>
      </div>
    </div>
  )
}
