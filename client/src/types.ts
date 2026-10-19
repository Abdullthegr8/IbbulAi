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

export type Feedback = 1 | -1 | 0

/** A knowledge base source an answer was based on; answers cite it as [n]. */
export interface Source {
  n:      number
  type:   'builtin' | 'kb' | 'document' | 'announcement' | 'web'
  title:  string
  detail: string | null   // office, document section or KB category
  url:    string | null   // document download or web page
  date:   string | null
}

export interface Message {
  id:           string
  role:         'user' | 'assistant'
  content:      string
  timestamp:    Date
  reasoning?:   string | null
  suggestions?: string[]
  sources?:     Source[]
  document?:    MessageDocument
  isNudge?:     boolean
  error?:       boolean
  logId?:       string | null   // server id of the exchange, used for feedback
  feedback?:    Feedback | null
  unanswered?:  boolean         // the bot had no verified answer — sent to the staff inbox
  streaming?:   boolean         // reply still arriving
  stopped?:     boolean         // user pressed Stop before the reply finished
}

export interface Conversation {
  id:            string
  title:         string
  document_id:   string | null
  document_name: string | null
  created_at:    string
  updated_at:    string
}

export interface Announcement {
  id:         number
  title:      string
  body:       string
  category:   string
  pinned:     boolean
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export interface InboxItem {
  key:              string
  question:         string
  last_answer:      string
  count:            number
  unanswered_count: number
  thumbs_down:      number
  last_asked:       string
}

export interface Analytics {
  days:   number
  totals: { questions: number; unanswered: number; helpful: number; not_helpful: number; avg_latency_ms: number | null }
  daily:  { day: string; questions: number; unanswered: number }[]
  hours:  { hour: number; questions: number }[]
  topics: { topic: string; questions: number }[]
  roles:  { role: string; questions: number }[]
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
  unanswered:      boolean | null
  feedback:        number | null
  user_role:       string | null
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
