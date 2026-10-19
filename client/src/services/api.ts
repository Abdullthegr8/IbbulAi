import axios from 'axios'
import type {
  AdminStats, Analytics, Announcement, ChatLog, Conversation, Feedback, InboxItem, KBEntry, Source, TopQuestion, User,
} from '../types'
import { getToken, clearAuth } from '../hooks/useAuth'

export interface Document {
  id: string
  name: string
  category: string
  description: string
  cloudinary_url: string | null
  mimetype: string
  size: number
  created_at: string
  searchable: boolean   // has extracted text, so the chatbot can answer questions about it
}

export interface SystemSettings {
  web_search_enabled: string
  rag_top_k:          string
  max_file_size_mb:   string
}

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = getToken()
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Expired or revoked session — sign out so the UI reflects it
api.interceptors.response.use(undefined, err => {
  if (err.response?.status === 401 && getToken()) clearAuth()
  return Promise.reject(err)
})

/** Server error message from an axios error, for toasts and forms. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  // Rejected by the host before reaching the server (Vercel allows 4.5 MB per request)
  if ((err as { response?: { status?: number } })?.response?.status === 413) return 'File is too large'
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data
  return data?.error || fallback
}

// ── Chat ──────────────────────────────────────────────────────────
export interface ChatResponse {
  answer:          string
  reasoning:       string | null   // model's thought process, shown above the answer
  suggestions:     string[]
  unanswered?:     boolean
  foundInKB:       boolean
  usedWebSearch:   boolean
  sources?:        Source[]
  logId?:          string | null
  conversationId?: string | null
  meta?:           { model: string; provider: string }
  error?:          boolean
}

export interface ChatRequest {
  message:         string
  history?:        { role: string; content: string }[]   // guests only; saved conversations use server history
  conversationId?: string
  documentId?:     string
}

export interface StreamHandlers {
  onReasoning?: (delta: string) => void
  onAnswer?:    (delta: string) => void
}

/**
 * Sends a message and streams the reply (server-sent events over a POST).
 * Resolves with the final response; rejects on network errors and aborts.
 */
export async function streamChat(body: ChatRequest, handlers: StreamHandlers, signal?: AbortSignal): Promise<ChatResponse> {
  const token = getToken()
  const res = await fetch('/api/chat/stream', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body:    JSON.stringify(body),
    signal,
  })

  // Validation and auth errors arrive as plain JSON before the stream starts
  if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
    if (res.status === 401 && token) clearAuth()
    const data = await res.json().catch(() => ({})) as Partial<ChatResponse> & { error?: string | boolean }
    return {
      answer:        data.answer || (typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.'),
      reasoning:     null,
      suggestions:   data.suggestions || [],
      foundInKB:     false,
      usedWebSearch: false,
      error:         true,
    }
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let end
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const event = frame.match(/^event: (.*)$/m)?.[1]
      const data  = frame.match(/^data: (.*)$/m)?.[1]
      if (!event || data === undefined) continue
      const payload = JSON.parse(data)
      if (event === 'reasoning') handlers.onReasoning?.(payload.d)
      else if (event === 'answer') handlers.onAnswer?.(payload.d)
      else if (event === 'done') return payload as ChatResponse
      else if (event === 'error') return { ...payload, reasoning: null, foundInKB: false, usedWebSearch: false, error: true }
    }
  }
  throw new Error('The reply was cut off')
}

export const sendFeedback = (id: string, value: Feedback) =>
  api.post('/chat/feedback', { id, value }).then(r => r.data)

// ── Saved conversations ───────────────────────────────────────────
export interface ConversationExchange {
  public_id:   string
  question:    string
  answer:      string
  reasoning:   string | null
  suggestions: string[] | null
  sources:     Source[] | null
  unanswered:  boolean | null
  feedback:    Feedback | null
  created_at:  string
}

export const getConversations = () =>
  api.get<{ conversations: Conversation[] }>('/conversations').then(r => r.data.conversations)

export const getConversation = (id: string) =>
  api.get<{ conversation: Conversation; exchanges: ConversationExchange[] }>(`/conversations/${id}`).then(r => r.data)

export const deleteConversation = (id: string) =>
  api.delete(`/conversations/${id}`).then(r => r.data)

// ── Announcements ─────────────────────────────────────────────────
export interface AnnouncementInput {
  title:       string
  body:        string
  category:    string
  pinned:      boolean
  expires_at:  string | null
}

export const getAnnouncements = () =>
  api.get<{ announcements: Announcement[] }>('/announcements').then(r => r.data.announcements)

export const getAllAnnouncements = () =>
  api.get<{ announcements: Announcement[] }>('/announcements/all').then(r => r.data.announcements)

export const createAnnouncement = (data: AnnouncementInput) =>
  api.post<{ announcement: Announcement }>('/announcements', data).then(r => r.data.announcement)

export const updateAnnouncement = (id: number, data: Partial<AnnouncementInput>) =>
  api.patch<{ announcement: Announcement }>(`/announcements/${id}`, data).then(r => r.data.announcement)

export const deleteAnnouncement = (id: number) =>
  api.delete(`/announcements/${id}`).then(r => r.data)

// ── Documents ─────────────────────────────────────────────────────
export const getDocuments = (params?: { category?: string; search?: string }) =>
  api.get<{ documents: Document[] }>('/documents', { params }).then(r => r.data.documents)

export const uploadDocument = (formData: FormData) =>
  api.post<{ success: boolean; document: Document }>('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const deleteDocument = (id: string) =>
  api.delete(`/documents/${id}`).then(r => r.data)

export const updateDocument = (id: string, data: Partial<Document>) =>
  api.patch(`/documents/${id}`, data).then(r => r.data)

export function getDownloadUrl(doc: Document): string {
  if (doc.cloudinary_url) return doc.cloudinary_url
  return `/api/documents/${doc.id}/download`
}

// ── Auth ──────────────────────────────────────────────────────────
interface AuthResponse { token: string; user: User }

// Admin login (credentials from server .env)
export const login = (username: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { username, password }).then(r => r.data)

// Students (matric number) and staff (work email)
export const userLogin = (role: 'student' | 'staff', identifier: string, password: string) =>
  api.post<AuthResponse>('/user/login', { role, identifier, password }).then(r => r.data)

export const userRegister = (data: { role: 'student' | 'staff'; name: string; identifier: string; password: string }) =>
  api.post<AuthResponse>('/user/register', data).then(r => r.data)

// ── Admin ─────────────────────────────────────────────────────────
export const getStats = () =>
  api.get<AdminStats>('/admin/stats').then(r => r.data)

export const getChatLogs = (page = 1) =>
  api.get<{ logs: ChatLog[] }>('/admin/logs', { params: { page } }).then(r => r.data.logs)

export const getTopQuestions = () =>
  api.get<{ questions: TopQuestion[] }>('/admin/top-questions').then(r => r.data.questions)

export const getKnowledgeBase = () =>
  api.get<{ entries: KBEntry[] }>('/admin/knowledge-base').then(r => r.data.entries)

export const addKBEntry = (entry: { question: string; answer: string; category: string }) =>
  api.post('/admin/knowledge-base', entry).then(r => r.data)

export const deleteKBEntry = (id: number) =>
  api.delete(`/admin/knowledge-base/${id}`).then(r => r.data)

export const getSettings = () =>
  api.get<SystemSettings>('/admin/settings').then(r => r.data)

// Persists to system_config table in PostgreSQL
export const saveSettings = (settings: Partial<SystemSettings>) =>
  api.post<{ success: boolean; message: string }>('/admin/settings', settings).then(r => r.data)

// ── Inbox (staff and admin) ───────────────────────────────────────
export const getInbox = () =>
  api.get<{ items: InboxItem[] }>('/admin/inbox').then(r => r.data.items)

/** Marks a question resolved; with `kb`, also adds the answer to the knowledge base. */
export const resolveInboxItem = (key: string, kb?: { question: string; answer: string; category: string }) =>
  api.post<{ success: boolean; resolved: number }>('/admin/inbox/resolve', { key, kb }).then(r => r.data)

// ── Analytics (admin) ─────────────────────────────────────────────
export const getAnalytics = (days: 7 | 30 | 90) =>
  api.get<Analytics>('/admin/analytics', { params: { days } }).then(r => r.data)
