# Changelog — IbbulAI

All notable changes to IbbulAI are documented here.

---

## [1.8.0] — 2026

### Added
- **RAG retrieval rebuilt** — all sources are split into passages and indexed in `kb_chunks` (weighted PostgreSQL full-text search, GIN index) when they're written instead of being scanned on every question; rarity-weighted ranking with a relevance gate; follow-up questions are searched with the previous question's context
- **Citations** — answers cite numbered sources (`[1]`), shown as source chips under each answer (documents link to their download) and saved in `chat_logs.sources`
- **Vercel deployment** — `vercel.json` and `api/index.js` run the client and server as one Vercel project; `DB_SSL_CA` accepts the certificate text as well as a file path; uploads are capped at 4 MB on Vercel

### Changed
- **Claude-style layout** — one collapsible sidebar for every role (student, staff, admin, guest) with New chat, navigation, date-grouped chat history and an account menu; collapses to an icon rail on desktop and becomes a drawer on mobile
- **Chat** — centred greeting and composer on a new chat, soft user bubbles, always-visible copy / feedback actions (work on touch screens), larger reading text, safe-area padding on phones
- **Admin chats are saved** — the admin gets a `users` row on login, so admin conversations appear in history like everyone else's

### Removed
- **Model switching** — the LLM provider / model settings are gone from the dashboard and API; the model is fixed by `GROQ_MODEL` in `server/.env`

### Fixed
- Visiting `/admin` while signed out now goes to the admin sign-in (it went to the staff sign-in, which rejects admin credentials)

---

## [1.7.0] — 2026

### Added
- **Streaming replies** — answers appear word by word (`POST /api/chat/stream`, server-sent events), with a Stop button that also stops generation on the server
- **Saved conversations** — students and staff get a history sidebar (drawer on mobile); each conversation has its own URL (`/chat/:id`) and continues with server-side history
- **Answer feedback** — thumbs up / down under each answer, stored on the chat log
- **"I don't know" handling** — when the knowledge base has no answer, IbbulAI says so, points to the right university office, and flags the question as unanswered
- **Ask about a document** — "Ask" on the Documents page starts a chat answered only from that document
- **Announcements** — staff post notices (optional pin and expiry); shown on Home and above the chat, and searched by the bot ahead of older information
- **Inbox** (staff + admin) — unanswered and thumbs-down questions, grouped; add the answer to the knowledge base in one step, or dismiss
- **Analytics** (admin) — questions per day, busiest hours, top topics, user types, verified-answer rate, helpful rate, response time
- Chat Logs show "No verified answer" / "Helpful" / "Not helpful" badges

### Changed
- Default model is now `qwen/qwen3.8-27b`; admin model list is Qwen3.8 27B, GPT-OSS 120B and GPT-OSS 20B (Groq retired `qwen/qwen3-32b`, `llama-3.1-8b-instant` and `compound-beta`)
- Chat history for signed-in users is stored in PostgreSQL instead of browser storage
- New tables `conversations` and `announcements`; new `chat_logs` columns (created automatically on startup)

---

## [1.6.0] — 2026

### Added
- **Reasoning panel** — a collapsible "Thought process" panel above each bot answer shows the model's reasoning (Qwen3 via Groq `reasoning_format: 'parsed'`)
- `POST /api/chat` now returns `reasoning` alongside `answer`
- Server refuses to start in production with a weak `JWT_SECRET` or `ADMIN_PASSWORD`

### Fixed
- **Security:** chat markdown renderer now escapes all model output (XSS via `dangerouslySetInnerHTML`)
- Qwen3 `<think>` blocks no longer leak into answers; `max_tokens` raised to 4096 so reasoning doesn't truncate replies
- Blank lines in answers no longer collapse the layout (`<div/>` is not self-closing in HTML)
- `* item` bullet lists no longer mangled by the italic rule
- Document download link used the document name instead of its id
- Selecting an unimplemented provider (OpenAI / Claude) no longer breaks chat; those options are disabled for now
- Admin settings are validated before being saved
- Chat logs record `user_id`, the real provider, and no longer claim web search was used
- Chat history from the client is size-limited and validated; whitespace-only messages rejected
- Chat log paging is clamped; knowledge base ids validated; DB errors no longer leaked to clients
- Production database TLS certificates are verified (opt out with `DB_SSL_REJECT_UNAUTHORIZED=false`)
- Admin dashboard no longer shows fabricated trends / sample data; Top Questions bars scale to real counts
- Unauthenticated visitors to `/admin` go to staff login; students go to chat

---

## [1.5.0] — 2026

### Added
- **Settings persistence** — admin settings now saved to `system_config` PostgreSQL table
- New `configService.js` — in-memory cache with DB read/write, falls back to `.env`
- New `POST /api/admin/settings` endpoint — writes settings to DB instantly
- `system_config` table created automatically on server startup
- Settings changes apply immediately — no server restart needed
- Admin settings UI now shows current active value and saves via Save button

### Changed
- **Renamed: UniBot → IbbulAI** — updated everywhere: sidebar, landing page, chat header, about page, admin page, login pages, register pages, browser title, favicon alt text, markdown docs
- **LLM model updated: `llama-3.3-70b-versatile` → `qwen/qwen3-32b`** (Groq decommissioned llama-3.3-70b on Aug 16 2026)
- **Chat responses now use rich markdown formatting** — headers (##/###), numbered lists, bullet points, bold, blockquotes, horizontal rules
- System prompt completely rewritten with explicit formatting instructions and examples
- `MessageBubble.tsx` — custom markdown renderer (no external library) handles all markdown elements
- `providers/llm.js` — now reads active model from `configService` instead of `.env` directly
- LLM `max_tokens` increased from 1200 to 2048 for better formatted responses

### Fixed
- Admin settings reverting to default after page refresh — now persisted to DB
- Other settings (web search, RAG top-K, file size) also now persist correctly

---

## [1.4.0] — 2026

### Added
- Separate Staff Register page at `/staff/register`
- Separate Staff Login page at `/staff/login`
- Staff portal link in sidebar under Administration section
- Role-based admin panel — staff sees only Documents and Knowledge Base tabs
- Admin sees full dashboard: Overview, Chat Logs, Documents, Knowledge Base, Settings

### Changed
- `/register` and `/login` are now student-only pages (matric number)
- `/staff/register` and `/staff/login` are staff-only pages (work email)
- Sidebar hides Admin/Staff links from logged-in students
- LandingPage has separate Student and Staff registration buttons

---

## [1.3.0] — 2026

### Added
- Landing page with hero animation, features section, how-it-works, and CTA
- Student registration with matric number validation (`U22/FNS/MCB/1000` format)
- Staff registration with work email
- Guest access to chatbot — soft signup nudge after 3 messages
- Time-based greeting on empty chat state
- Copy button on bot responses
- Claude-style chat layout — prose messages, no bubble borders on bot

### Changed
- Chat interface redesigned — empty state with centered greeting, fades on first message
- Quick prompt chips removed from input area
- Scrollbar refined — 4px, smooth

---

## [1.2.0] — 2026

### Added
- Cloudinary V2 integration for document storage
- Document upload, preview, and download from admin dashboard
- Text extraction from PDF/DOCX for automatic KB embedding

### Fixed
- Cloudinary V1/V2 dependency conflict — removed `multer-storage-cloudinary`

---

## [1.1.0] — 2026

### Added
- Functional Groq LLM integration
- Local IBBU knowledge base (16 entries)
- Follow-up question suggestions after every bot response
- Conversation memory (last 10 turns)

---

## [1.0.0] — 2026

### Added
- Initial project scaffold
- React + TypeScript + Tailwind CSS frontend
- Node.js + Express backend
- PostgreSQL with auto-migration
- Admin JWT login
- IBBU green `#1A6B1A` color scheme
- Mobile responsive sidebar
- Light mode only
