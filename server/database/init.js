import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const LOCAL_HOST_RE = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;

/**
 * SSL for hosted databases (e.g. Supabase); off for a local database.
 * DB_SSL=true|false overrides the automatic choice. Certificates are verified —
 * for Supabase, download the project's CA certificate (Dashboard → Database
 * settings → SSL configuration) and set DB_SSL_CA to its path, or to the
 * certificate text itself (for hosts like Vercel that only have env variables).
 */
function readCA(value) {
  if (!value) return undefined;
  if (value.includes('BEGIN CERTIFICATE')) return value.replace(/\\n/g, '\n');
  return fs.readFileSync(value, 'utf8');
}

function sslConfig(url) {
  const mode = process.env.DB_SSL;
  if (mode === 'false' || (mode !== 'true' && LOCAL_HOST_RE.test(url))) return false;
  return {
    ca: readCA(process.env.DB_SSL_CA),
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

// ?sslmode=… in the URL would override the ssl settings above, so drop it
const url = (process.env.DATABASE_URL || '').replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');

export const db = new Pool({
  connectionString: url,
  ssl: sslConfig(url),
  max: Number(process.env.DB_POOL_MAX) || 10,  // Supabase's pooler limits connections per project
});

/**
 * Semantic search needs the pgvector extension (built into Supabase). Without it
 * the app still runs, with keyword search only. `schema` is where the extension
 * lives (Supabase puts extensions in "extensions"), used to qualify its type and operator.
 */
export const vectorInfo = { ready: false, schema: null };

async function setupVector() {
  try {
    const hasExtSchema = (await db.query("SELECT 1 FROM pg_namespace WHERE nspname = 'extensions'")).rowCount > 0;
    await db.query(`CREATE EXTENSION IF NOT EXISTS vector${hasExtSchema ? ' WITH SCHEMA extensions' : ''}`);
    const { rows } = await db.query("SELECT extnamespace::regnamespace::text AS schema FROM pg_extension WHERE extname = 'vector'");
    const s = rows[0].schema;
    await db.query(`
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding    ${s}.vector(384);
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS content_hash TEXT;  -- reuse embeddings for unchanged passages
      CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON kb_chunks USING hnsw (embedding ${s}.vector_cosine_ops);
    `);
    Object.assign(vectorInfo, { ready: true, schema: s });
    console.log(`[DB] pgvector ready (schema "${s}") — semantic search on`);
  } catch (err) {
    console.warn('[DB] pgvector not available — keyword search only:', err.message);
  }
}

export async function initDB() {
  try {
    const client = await db.connect();
    client.release();
    await createTables();
    await setupVector();
    console.log('[DB] PostgreSQL connected and tables ready');
  } catch (err) {
    console.warn('[DB] PostgreSQL not available:', err.message);
  }
}

async function createTables() {
  await db.query(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier    TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('student', 'staff', 'admin')),
      password_hash TEXT NOT NULL,
      last_login    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    -- Documents table
    CREATE TABLE IF NOT EXISTS documents (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name                 TEXT NOT NULL,
      category             TEXT DEFAULT 'General',
      description          TEXT DEFAULT '',
      cloudinary_public_id TEXT,
      cloudinary_url       TEXT,
      mimetype             TEXT NOT NULL,
      size                 INTEGER DEFAULT 0,
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    );

    -- Chat logs table
    CREATE TABLE IF NOT EXISTS chat_logs (
      id              SERIAL PRIMARY KEY,
      user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
      session_id      TEXT DEFAULT 'anonymous',
      question        TEXT NOT NULL,
      answer          TEXT NOT NULL,
      source          TEXT,
      provider        TEXT DEFAULT 'Groq',
      used_web_search BOOLEAN DEFAULT FALSE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    -- Knowledge base table
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id         SERIAL PRIMARY KEY,
      question   TEXT NOT NULL,
      answer     TEXT NOT NULL,
      category   TEXT DEFAULT 'General',
      active     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- System config table (persists admin settings)
    CREATE TABLE IF NOT EXISTS system_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Saved conversations (signed-in students and staff)
    CREATE TABLE IF NOT EXISTS conversations (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      document_id UUID REFERENCES documents(id) ON DELETE SET NULL,  -- set for "ask about this document" chats
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    -- Announcements posted by staff; shown to users and searched by the chatbot
    CREATE TABLE IF NOT EXISTS announcements (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      category   TEXT DEFAULT 'General',
      pinned     BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Upgrades for databases created by earlier versions
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT;  -- local storage when Cloudinary isn't configured
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS content   TEXT;  -- extracted text, searched by the chatbot

    -- v1.7: conversations, feedback, unanswered inbox, analytics
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS public_id       UUID DEFAULT gen_random_uuid();  -- unguessable id given to the client
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS document_id     UUID REFERENCES documents(id) ON DELETE SET NULL;
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS reasoning       TEXT;
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS suggestions     JSONB;
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS topic           TEXT;
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS user_role       TEXT;
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS unanswered      BOOLEAN DEFAULT FALSE;
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS feedback        SMALLINT;  -- 1 helpful, -1 not helpful
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS resolved        BOOLEAN DEFAULT FALSE;  -- handled from the inbox
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS latency_ms      INTEGER;

    -- v1.8: the admin gets a users row (so admin chats are saved like everyone else's);
    -- the model is fixed in .env, so drop the old model-switching settings
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'staff', 'admin'));
    DELETE FROM system_config WHERE key IN ('llm_provider', 'groq_model', 'openai_model', 'anthropic_model');

    -- v1.8: knowledge base search index — passages from every source, with weighted full-text search
    -- (title and keywords weigh more than the passage text). Rebuilt on server start.
    CREATE TABLE IF NOT EXISTS kb_chunks (
      id          SERIAL PRIMARY KEY,
      source_type TEXT NOT NULL CHECK (source_type IN ('builtin', 'kb', 'document', 'announcement')),
      source_id   TEXT NOT NULL,
      title       TEXT NOT NULL,
      keywords    TEXT NOT NULL DEFAULT '',
      topic       TEXT,
      url         TEXT,
      heading     TEXT,
      content     TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      expires_at  TIMESTAMPTZ,
      source_date TIMESTAMPTZ,
      search      TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', title || ' ' || keywords), 'A') ||
        setweight(to_tsvector('english', coalesce(heading, '')), 'B') ||
        setweight(to_tsvector('english', content), 'C')
      ) STORED
    );
    CREATE INDEX IF NOT EXISTS idx_kb_chunks_search ON kb_chunks USING GIN (search);
    CREATE INDEX IF NOT EXISTS idx_kb_chunks_source ON kb_chunks (source_type, source_id);
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS sources JSONB;  -- knowledge base sources the answer was based on

    -- Supabase exposes the public schema through its REST API; with row level security on
    -- and no policies, that API can't read these tables. The server connects as the
    -- tables' owner, which isn't affected.
    ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
    ALTER TABLE documents      ENABLE ROW LEVEL SECURITY;
    ALTER TABLE chat_logs      ENABLE ROW LEVEL SECURITY;
    ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
    ALTER TABLE system_config  ENABLE ROW LEVEL SECURITY;
    ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
    ALTER TABLE announcements  ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kb_chunks      ENABLE ROW LEVEL SECURITY;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_identifier   ON users(identifier);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_chat_logs_created  ON chat_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_logs_user     ON chat_logs(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_logs_public ON chat_logs(public_id);
    CREATE INDEX IF NOT EXISTS idx_chat_logs_conversation  ON chat_logs(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_user      ON conversations(user_id, updated_at DESC);
  `);
}
