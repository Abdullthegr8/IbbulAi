import { useCallback, useEffect, useRef, useState } from 'react'
import { sendChat } from '../services/api'
import type { ChatResponse } from '../services/api'
import type { Message } from '../types'
import { useAuth } from './useAuth'

const NUDGE_AFTER   = 3    // guest messages before the signup nudge
const HISTORY_TURNS = 10   // turns sent to the server for follow-up context
const MAX_SAVED     = 100  // messages kept in browser storage per account

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function storageKey(identifier: string) {
  return `unibot_chat_${identifier}`
}

function loadSaved(identifier: string | undefined): Message[] {
  if (!identifier) return []
  try {
    const raw = localStorage.getItem(storageKey(identifier))
    if (!raw) return []
    return (JSON.parse(raw) as Message[]).map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
  } catch {
    return []
  }
}

export function useChat() {
  const { user, isLoggedIn } = useAuth()
  const identifier = user?.identifier
  // `owner` records which account the messages belong to, so switching
  // accounts never saves one user's chat under another's key
  const [chat, setChat] = useState(() => ({ owner: identifier, messages: loadSaved(identifier) }))
  const [loading, setLoading] = useState(false)
  const nudged = useRef(false)

  // Switch conversation when the signed-in account changes (state reset during render)
  if (chat.owner !== identifier) {
    setChat({ owner: identifier, messages: loadSaved(identifier) })
    nudged.current = false
  }
  const messages = chat.owner === identifier ? chat.messages : []

  const setMessages = useCallback((update: (prev: Message[]) => Message[]) => {
    setChat(c => ({ ...c, messages: update(c.messages) }))
  }, [])

  // Signed-in users keep their chat history in this browser
  useEffect(() => {
    if (!chat.owner) return
    try {
      localStorage.setItem(storageKey(chat.owner), JSON.stringify(chat.messages.filter(m => !m.isNudge).slice(-MAX_SAVED)))
    } catch { /* storage full or unavailable */ }
  }, [chat])

  const send = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || loading) return

    const userMsg: Message = { id: newId(), role: 'user', content, timestamp: new Date() }
    const history = messages
      .filter(m => !m.isNudge && !m.error)
      .slice(-HISTORY_TURNS)
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    let data: ChatResponse
    try {
      data = await sendChat(content, history)
    } catch (err) {
      // The server still returns a friendly answer + suggestions on 500
      const body = (err as { response?: { data?: Partial<ChatResponse> } })?.response?.data
      data = {
        answer:        body?.answer || "I couldn't reach the server. Please check your connection and try again.",
        reasoning:     null,
        suggestions:   body?.suggestions || [],
        foundInKB:     false,
        usedWebSearch: false,
        error:         true,
      }
    }

    const botMsg: Message = {
      id:          newId(),
      role:        'assistant',
      content:     data.answer,
      reasoning:   data.reasoning,
      suggestions: data.suggestions,
      timestamp:   new Date(),
      error:       data.error,
    }

    setMessages(prev => {
      const next = [...prev, botMsg]
      const userCount = next.filter(m => m.role === 'user').length
      if (!isLoggedIn && !nudged.current && userCount >= NUDGE_AFTER) {
        nudged.current = true
        next.push({ id: newId(), role: 'assistant', content: '', timestamp: new Date(), isNudge: true })
      }
      return next
    })
    setLoading(false)
  }, [messages, loading, isLoggedIn, setMessages])

  const clear = useCallback(() => {
    setMessages(() => [])
    nudged.current = false
  }, [setMessages])

  return { messages, loading, send, clear }
}
