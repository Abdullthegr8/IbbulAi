import axios from 'axios'
import type { AdminStats, ChatLog, KBEntry, TopQuestion, User } from '../types'
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
}

export interface SystemSettings {
  llm_provider:       string
  groq_model:         string
  openai_model:       string
  anthropic_model:    string
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
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data
  return data?.error || fallback
}

// ── Chat ──────────────────────────────────────────────────────────
export interface ChatResponse {
  answer:        string
  reasoning:     string | null   // model's thought process, shown above the answer
  suggestions:   string[]
  foundInKB:     boolean
  usedWebSearch: boolean
  meta?:         { model: string; provider: string }
  error?:        boolean
}

export const sendChat = (message: string, history: { role: string; content: string }[]) =>
  api.post<ChatResponse>('/chat', { message, history }).then(r => r.data)

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
