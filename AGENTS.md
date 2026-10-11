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
│   Step 1: Local KB Search   │  Keyword match against 16
│   (searchLocalKB)           │  IBBU knowledge base entries
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
│   Step 2: Groq LLM Call     │  qwen/qwen3-32b
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

**`qwen/qwen3-32b`** (Groq) — replaced `llama-3.3-70b-versatile` which was decommissioned by Groq on August 16, 2026.

The active model is read from the `system_config` database table at runtime, so it can be changed from the admin dashboard without restarting the server.

---

## Knowledge Base Agent

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
const model = getConfig('groq_model') || 'qwen/qwen3-32b'
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
