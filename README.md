# IbbulAI — IBBU Intelligent University Assistant

> **Final Year Project** — Design and Implementation of an Intelligent Chatbot System Powered by a Large Language Model for University Information and Document Retrieval
>
> Ibrahim Badamasi Babangida University, Lapai, Niger State, Nigeria

---

## Overview

**IbbulAI** is the official AI-powered conversational assistant for Ibrahim Badamasi Babangida University (IBBU). It enables students, staff, and prospective students to retrieve official university information and documents through natural language — available 24/7.

---

## Features

- **Natural language chat** — ask questions in plain English, receive formatted markdown responses
- **IBBU knowledge base** — 16 verified university-specific entries, searched before calling the LLM
- **Rich markdown responses** — headers, numbered steps, bullet points, bold, blockquotes
- **Groq LLM** — powered by `qwen/qwen3-32b` (Qwen3 32B)
- **Document retrieval** — upload, search, preview, and download documents via Cloudinary
- **Persistent settings** — admin settings saved to PostgreSQL `system_config` table, applied instantly
- **Guest access** — prospective students can use the chatbot without an account
- **Student auth** — register with IBBU matric number (`U22/FNS/MCB/1000`)
- **Staff auth** — register with work email
- **Role-based access** — students chat; staff manage documents and KB; admin has full access
- **Model reasoning** — a collapsible "Thought process" panel shows the model's reasoning above each answer
- **Pluggable LLM layer** — Groq is implemented; OpenAI / Claude providers are planned

---

## User Roles

| Role | How to Register | Access |
|---|---|---|
| Student | `/register` — matric number | Chat, documents, download |
| Staff | `/staff/register` — work email | Chat, documents, KB management |
| Admin | Manual via `.env` | Full dashboard + settings |
| Guest | No registration | Chat (nudge after 3 messages) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| LLM | Groq (`qwen/qwen3-32b`) |
| Storage | Cloudinary V2 |
| Auth | JWT |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Groq API key — [console.groq.com](https://console.groq.com)
- Cloudinary account — [cloudinary.com](https://cloudinary.com)

### Installation

```bash
# 1. Install all dependencies
npm run install:all

# 2. Configure environment
cp server/.env.example server/.env
# Fill in your credentials

# 3. Start development servers
npm run dev
```

Client: **http://localhost:3000** · Server: **http://localhost:5001** (5000 is used by AirPlay Receiver on macOS)

---

## Environment Variables

```env
# LLM
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=qwen/qwen3-32b
LLM_PROVIDER=groq

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/unibot

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Auth
JWT_SECRET=your_long_random_secret   # 32+ characters
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me             # 12+ characters; required in production

# Server
PORT=5001
CLIENT_URL=http://localhost:3000
```

---

## Settings Persistence

Admin settings are stored in the `system_config` PostgreSQL table. Changes made in the admin dashboard take effect **immediately** without restarting the server. The server loads settings from DB on startup and falls back to `.env` defaults if the DB has no value for a key.

```sql
-- system_config table structure
CREATE TABLE system_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Configurable settings:
- LLM provider (`groq` | `openai` | `claude`)
- Groq model (default: `qwen/qwen3-32b`)
- Web search fallback (enabled/disabled)
- RAG top-K results (3 / 5 / 10)
- Max file upload size

---

## Database Setup

Tables are created automatically on first server start. If upgrading from a previous version, run:

```sql
-- Add system_config table
CREATE TABLE IF NOT EXISTS system_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id to chat_logs if missing
ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
```

---

## Project Structure

```
ibbulai/
├── client/                  # React frontend
│   └── src/
│       ├── pages/           # Landing, Login, Register, Chat, Documents, Admin
│       ├── components/      # Layout, Sidebar, MessageBubble, TypingIndicator
│       ├── hooks/           # useChat, useAuth
│       └── services/        # API calls including saveSettings
│
├── server/                  # Node.js backend
│   ├── controllers/         # Chat, documents, auth, user auth, admin
│   ├── routes/              # Express routes
│   ├── services/            # RAG, Cloudinary, configService
│   ├── middleware/          # Auth, upload, error handling
│   ├── providers/           # LLM abstraction (Groq/OpenAI/Claude)
│   └── database/            # PostgreSQL init + chatLogs
│
├── README.md
├── CHANGELOG.md
├── AGENTS.md
└── DESIGN.md
```
