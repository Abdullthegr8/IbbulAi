export type Role = 'student' | 'staff' | 'admin'

export interface User {
  id:         string
  name:       string
  role:       Role
  identifier: string   // matric number, work email, or admin username
}

export interface MessageDocument {
  id?:             string
  name:            string
  cloudinary_url?: string | null
}

export interface Message {
  id:           string
  role:         'user' | 'assistant'
  content:      string
  timestamp:    Date
  reasoning?:   string | null
  suggestions?: string[]
  document?:    MessageDocument
  isNudge?:     boolean
  error?:       boolean
}

export interface AdminStats {
  totalDocuments: number
  totalChats:     number
  totalUsers:     number
  questionsToday: number
  provider:       { provider: string; model: string }
}

export interface ChatLog {
  id:              number
  question:        string
  answer:          string
  source:          string | null
  provider:        string | null
  used_web_search: boolean
  created_at:      string
}

export interface KBEntry {
  id:         number
  question:   string
  answer:     string
  category:   string
  active:     boolean
  created_at: string
}

export interface TopQuestion {
  question: string
  count:    number | string   // Postgres COUNT(*) arrives as a string
}
