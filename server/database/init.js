import pg from 'pg';
const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Certificates are verified in production unless explicitly disabled
  // (some managed hosts use self-signed certs: set DB_SSL_REJECT_UNAUTHORIZED=false)
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

export async function initDB() {
  try {
    const client = await db.connect();
    client.release();
    await createTables();
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
      role          TEXT NOT NULL CHECK (role IN ('student', 'staff')),
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

    -- Upgrades for databases created by earlier versions
    ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT;  -- local storage when Cloudinary isn't configured
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS content   TEXT;  -- extracted text, searched by the chatbot

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_identifier   ON users(identifier);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_chat_logs_created  ON chat_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_logs_user     ON chat_logs(user_id);
  `);
}
