import { useCallback, useEffect, useRef, useState } from 'react'
import { getConversation, sendFeedback, streamChat } from '../services/api'
import type { ChatResponse } from '../services/api'
import type { Feedback, Message } from '../types'
import { useAuth } from './useAuth'
import { conversationsChanged } from './conversationEvents'

const NUDGE_AFTER   = 3    // guest messages before the signup nudge
const HISTORY_TURNS = 10   // turns sent to the server for follow-up context (unsaved chats only)

export interface ChatDocument { id: string; name: string }

interface ChatState {
  owner:          string | undefined   // account the chat belongs to
  conversationId: string | null        // saved conversation, once the first reply arrives
  document:       ChatDocument | null  // "ask about this document" scope
  messages:       Message[]
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function emptyChat(owner: string | undefined, document: ChatDocument | null = null): ChatState {
  return { owner, conversationId: null, document, messages: [] }
}

export function useChat() {
  const { user, isLoggedIn } = useAuth()
  const identifier = user?.identifier
  // Every signed-in account (student, staff, admin) has saved conversations
  const canSave = isLoggedIn

  const [chat, setChat] = useState<ChatState>(() => emptyChat(identifier))
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState(false)
  const nudged = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Start fresh when the signed-in account changes (state reset during render)
  if (chat.owner !== identifier) {
    setChat(emptyChat(identifier))
    nudged.current = false
  }
  const current = chat.owner === identifier ? chat : emptyChat(identifier)

  // Abandon an in-flight reply when the page unmounts. Deferred, because
  // StrictMode's simulated unmount/remount in development must not abort it.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      setTimeout(() => { if (!mounted.current) abortRef.current?.abort() })
    }
  }, [])

  const updateMessage = useCallback((id: string, patch: (m: Message) => Partial<Message>) => {
    setChat(c => ({ ...c, messages: c.messages.map(m => (m.id === id ? { ...m, ...patch(m) } : m)) }))
  }, [])

  const send = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || loading) return

    const userMsg: Message = { id: newId(), role: 'user', content, timestamp: new Date() }
    const botId = newId()
    const botMsg: Message = { id: botId, role: 'assistant', content: '', reasoning: '', timestamp: new Date(), streaming: true }
    const history = current.conversationId ? undefined : current.messages
      .filter(m => !m.isNudge && !m.error && !m.stopped)
      .slice(-HISTORY_TURNS)
      .map(m => ({ role: m.role, content: m.content }))

    setChat(c => ({ ...c, messages: [...c.messages, userMsg, botMsg] }))
    setLoading(true)
    const abort = new AbortController()
    abortRef.current = abort

    // Pieces arrive faster than the screen refreshes, so apply them once per frame
    let pendingAnswer = '', pendingReasoning = '', frame = 0
    const flush = () => {
      frame = 0
      const a = pendingAnswer, r = pendingReasoning
      pendingAnswer = pendingReasoning = ''
      updateMessage(botId, m => ({ content: m.content + a, reasoning: (m.reasoning || '') + r }))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(flush) }

    let data: ChatResponse
    try {
      data = await streamChat(
        {
          message:        content,
          history,
          conversationId: current.conversationId ?? undefined,
          documentId:     current.conversationId ? undefined : current.document?.id,
        },
        {
          onAnswer:    d => { pendingAnswer += d; schedule() },
          onReasoning: d => { pendingReasoning += d; schedule() },
        },
        abort.signal,
      )
    } catch (err) {
      if (frame) cancelAnimationFrame(frame)
      flush()
      if (abort.signal.aborted) {
        // Stopped by the user: keep what arrived so far
        updateMessage(botId, () => ({ streaming: false, stopped: true }))
      } else {
        updateMessage(botId, () => ({
          content:   "I couldn't reach the server. Please check your connection and try again.",
          reasoning: null,
          streaming: false,
          error:     true,
        }))
      }
      setLoading(false)
      return
    }
    if (frame) cancelAnimationFrame(frame)

    setChat(c => {
      const messages = c.messages.map(m => m.id !== botId ? m : {
        ...m,
        content:     data.answer,
        reasoning:   data.reasoning || m.reasoning || null,
        suggestions: data.suggestions,
        sources:     data.sources ?? [],
        logId:       data.logId ?? null,
        unanswered:  data.unanswered,
        error:       data.error,
        streaming:   false,
      })
      const userCount = messages.filter(m => m.role === 'user').length
      if (!isLoggedIn && !nudged.current && userCount >= NUDGE_AFTER) {
        nudged.current = true
        messages.push({ id: newId(), role: 'assistant', content: '', timestamp: new Date(), isNudge: true })
      }
      return { ...c, conversationId: data.conversationId ?? c.conversationId, messages }
    })
    setLoading(false)
    // New conversations appear in the sidebar, and updated ones move to the top
    if (data.conversationId) conversationsChanged()
  }, [current.conversationId, current.document, current.messages, loading, isLoggedIn, updateMessage])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  /** Clears the screen for a new conversation, optionally about one document. */
  const newChat = useCallback((document: ChatDocument | null = null) => {
    abortRef.current?.abort()
    setLoading(false)
    setChat(emptyChat(identifier, document))
    nudged.current = false
  }, [identifier])

  /** Loads a saved conversation. Rejects if it can't be loaded. */
  const openConversation = useCallback(async (id: string) => {
    abortRef.current?.abort()
    setLoading(false)
    setOpening(true)
    try {
      const { conversation, exchanges } = await getConversation(id)
      const messages = exchanges.flatMap<Message>(e => [
        { id: `${e.public_id}-q`, role: 'user', content: e.question, timestamp: new Date(e.created_at) },
        {
          id:          e.public_id,
          role:        'assistant',
          content:     e.answer,
          reasoning:   e.reasoning,
          suggestions: e.suggestions ?? [],
          sources:     e.sources ?? [],
          logId:       e.public_id,
          feedback:    e.feedback,
          unanswered:  !!e.unanswered,
          timestamp:   new Date(e.created_at),
        },
      ])
      setChat({
        owner:          identifier,
        conversationId: conversation.id,
        document:       conversation.document_id ? { id: conversation.document_id, name: conversation.document_name ?? 'Document' } : null,
        messages,
      })
    } finally {
      setOpening(false)
    }
  }, [identifier])

  /** Rates an answer; picking the current rating again clears it. */
  const rate = useCallback(async (messageId: string, value: Feedback) => {
    const msg = current.messages.find(m => m.id === messageId)
    if (!msg?.logId) return
    const next: Feedback = msg.feedback === value ? 0 : value
    const previous = msg.feedback ?? null
    updateMessage(messageId, () => ({ feedback: next }))
    try {
      await sendFeedback(msg.logId, next)
    } catch {
      updateMessage(messageId, () => ({ feedback: previous }))
      throw new Error('Could not save your feedback')
    }
  }, [current.messages, updateMessage])

  return {
    messages:       current.messages,
    conversationId: current.conversationId,
    document:       current.document,
    loading,
    opening,
    canSave,
    send,
    stop,
    newChat,
    openConversation,
    rate,
  }
}
