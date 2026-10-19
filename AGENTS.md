# Agents — IbbulAI AI Architecture

This document describes how IbbulAI's AI pipeline works.

---

## Overview

IbbulAI uses a multi-step retrieval pipeline before calling the LLM. The goal is to give the most accurate, IBBU-specific answer possible.

```
User Message
     │
     ▼
┌─────────────────────────────┐
│   Step 1: KB Search         │  Full-text search over kb_chunks:
│   (searchKnowledgeBase)     │  built-in, KB, documents, announcements
└─────────────┬───────────────┘
              │
      Found? ─┤
     YES      │      NO
      │        │       │
      ▼        │       ▼
  Enrich    ◄──┘   Send raw
  prompt          question
  with KB         to LLM
  context
      │
      ▼
┌─────────────────────────────┐
│   Step 2: Groq LLM Call     │  qwen/qwen3.8-27b
│   (configService → model)   │  System prompt enforces markdown
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   Step 3: Parse Response    │  Extract main answer +
│                             │  <suggestions> block
└─────────────┬───────────────┘
              │
              ▼
        Return to client
     { answer, suggestions,
       foundInKB, meta }
```

---

## Active Model

**`qwen/qwen3.8-27b`** (Groq) — replaced `qwen/qwen3-32b`, which Groq retired in October 2026 (it had replaced `llama-3.3-70b-versatile`, decommissioned August 16, 2026).

The model is fixed by `GROQ_MODEL` in `server/.env` (default `qwen/qwen3.8-27b`); it is not changeable from the admin dashboard.

---

## Knowledge Base Agent (RAG retrieval)

**Files:** `server/services/kbIndex.js` (indexing), `server/services/rag.js` (search), `server/services/localKB.js` (built-in entries)

1. **Index at write time.** Built-in entries, knowledge base entries, uploaded documents and announcements are split into ~1,000-character passages (150-character overlap, following section headings) and stored in `kb_chunks`, which has a weighted `tsvector` column (title/keywords > heading > text) and a GIN index. Each create / update / delete re-indexes that source; the whole index is rebuilt on server start.
2. **Search.** The question's terms are matched with PostgreSQL full-text search (English stemming, prefix matching for longer words). Passages are scored by rarity-weighted coverage of the question (IDF), a boost for matches in the source's title, `ts_rank_cd`, and a small bonus for announcements and curated KB entries.
3. **Relevance gate.** A passage counts only if it matches enough of the question's terms (or the question names the source's subject); passages scoring under 60% of the best are dropped; at most 2 passages per source, `rag_top_k` passages in total. No match → the model is told there is no verified information (→ `<unanswered/>` → staff inbox).
4. **Follow-ups.** Short or unmatched questions are searched again together with the previous question, so "what about direct entry?" finds the admissions entry.
5. **Citations.** Sources are numbered in the context; the model cites them as `[n]`. The response and `chat_logs.sources` carry the source list, shown under each answer.


**File:** `server/services/rag.js`

16 verified IBBU entries covering:

| Topic | Source |
|---|---|
| Admission requirements | IBBU Admissions Guide |
| School fees | Bursary Department |
| Course registration | Academic Affairs |
| Examinations | Examination Unit |
| Hostel accommodation | Student Affairs |
| Transcript | Registrar Office |
| Scholarships | Student Affairs |
| Clearance documents | Admissions Office |
| Student portal | ICT Centre |
| Library | University Library |
| ICT Centre | ICT Centre |
| Graduation | Academic Affairs |
| Academic calendar | Academic Affairs |
| Faculties & departments | Academic Affairs |
| General university info | University Overview |
| Postgraduate programmes | Postgraduate School |

---

## LLM Agent

**File:** `server/providers/llm.js`

Reads active provider and model from `configService` (which reads from `system_config` DB table):

```js
const model = getConfig('groq_model') || 'qwen/qwen3.8-27b'
```

Supports three providers (switch via admin settings):
- `groq` — default
- `openai` — GPT-4o
- `claude` — Anthropic Claude

---

## Config Agent

**File:** `server/services/configService.js`

- Loads all settings from `system_config` table into memory on server startup
- Provides `getConfig(key)` for fast in-memory reads (no DB hit per request)
- `setConfig(key, value)` writes to DB and updates cache immediately
- Falls back to `.env` defaults if DB has no value for a key

---

## Response Formatting

The system prompt explicitly instructs the LLM to use markdown:
- `###` headers for major sections
- `1. 2. 3.` numbered lists for steps
- `- item` bullet points for non-sequential lists
- `**bold**` for important terms and amounts
- `> blockquote` for important notes
- `---` horizontal rules between sections

`MessageBubble.tsx` renders this markdown using a custom line-by-line parser (no external library).

---

## Conversation Memory

Last **10 turns** sent with each request for follow-up context.

---

## Guest Agent

Guest users get full chatbot access. After 3rd message, a signup nudge card is injected — non-blocking, encourages account creation.

---

## Suggestion Agent

After each LLM response, `<suggestions>["Q1","Q2","Q3"]</suggestions>` is parsed and returned separately. Falls back to `getFallbackSuggestions()` if LLM doesn't include them.


---

## Document Agent

**File:** `server/services/rag.js` → `searchDocument()`

For "ask about this document" chats, only the chosen document is searched: short documents are sent whole, longer ones as the most relevant ~1,200-character chunks (up to ~9,000 characters, in document order).

---

## Unanswered Questions

The system prompt tells the model to state specific facts only when they appear in the provided context. When it can't answer an IBBU question, it says so, names the office to contact, and emits `<unanswered/>`. The server strips the tag and sets `chat_logs.unanswered`. These questions, together with answers rated unhelpful, appear in the staff **Inbox**.

---

## Streaming

`POST /api/chat/stream` returns server-sent events: `start`, `reasoning` / `answer` deltas, then `done` with the cleaned answer, suggestions, `logId` (for feedback) and `conversationId`. When the client disconnects, the Groq request is aborted and nothing is logged.
