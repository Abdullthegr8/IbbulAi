/**
 * Config Service
 * Reads and writes system settings from the system_config table.
 * Falls back to .env values if DB is unavailable or key not set.
 */

import { db } from '../database/init.js';

// In-memory cache so every chat request doesn't hit the DB
let _cache = {};
let _cacheLoaded = false;

const DEFAULTS = {
  llm_provider:       process.env.LLM_PROVIDER       || 'groq',
  groq_model:         process.env.GROQ_MODEL         || 'qwen/qwen3-32b',
  openai_model:       process.env.OPENAI_MODEL        || 'gpt-4o',
  anthropic_model:    process.env.ANTHROPIC_MODEL     || 'claude-sonnet-4-6',
  web_search_enabled: process.env.WEB_SEARCH_ENABLED  || 'false',
  rag_top_k:          process.env.RAG_TOP_K           || '5',
  max_file_size_mb:   process.env.MAX_FILE_SIZE_MB    || '50',
};

export async function loadConfig() {
  try {
    const result = await db.query('SELECT key, value FROM system_config');
    _cache = {};
    for (const row of result.rows) {
      _cache[row.key] = row.value;
    }
    _cacheLoaded = true;
    console.log('[Config] Loaded settings from database');
  } catch (err) {
    console.warn('[Config] Could not load from DB, using .env defaults:', err.message);
    _cache = { ...DEFAULTS };
    _cacheLoaded = true;
  }
}

export function getConfig(key) {
  if (!_cacheLoaded) return DEFAULTS[key] ?? null;
  return _cache[key] ?? DEFAULTS[key] ?? null;
}

export function getAllConfig() {
  return { ...DEFAULTS, ..._cache };
}

export async function setConfig(key, value) {
  // Update DB
  await db.query(
    `INSERT INTO system_config (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, String(value)]
  );
  // Update cache immediately
  _cache[key] = String(value);
}

export async function setManyConfig(entries) {
  for (const [key, value] of Object.entries(entries)) {
    await setConfig(key, value);
  }
}
