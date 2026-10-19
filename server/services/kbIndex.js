/**
 * Knowledge base index.
 *
 * Every searchable source — built-in entries, knowledge base entries, uploaded
 * documents and announcements — is split into passages ("chunks") and stored
 * in the kb_chunks table, which has a weighted full-text search column and a
 * GIN index. Sources are indexed when they are written, not on every question.
 *
 * With pgvector and the embed function available, each passage also gets an
 * embedding (384 numbers capturing its meaning) for semantic search. Embeddings
 * are keyed by a hash of the text, so unchanged passages keep theirs instead of
 * being re-embedded; backfillEmbeddings() fills in any that are missing.
 *
 * The whole index is rebuilt on server start, which also repairs any drift
 * (e.g. if indexing a single source failed). On Vercel, where every instance
 * starts cold, ensureIndex() rebuilds only when the built-in entries change.
 */

import crypto from 'node:crypto';
import { db, vectorInfo } from '../database/init.js';
import { LOCAL_KB } from './localKB.js';
import { EMBEDDING_MODEL, embeddingsConfigured, embedPassages, toPgVector } from './embeddings.js';

const CHUNK_CHARS   = 1000;  // target passage size
const OVERLAP_CHARS = 150;   // carried into the next passage so facts at a boundary aren't cut in half
const MAX_CHUNKS    = 400;   // per source (documents are capped at 200k characters anyway)

// ── Chunking ──────────────────────────────────────────────────────

function looksLikeHeading(line) {
  const t = line.trim();
  if (t.length < 3 || t.length > 80 || /[.,;:]$/.test(t)) return false;
  return /^#{1,6}\s+\S/.test(t)                          // markdown heading
      || /^(\d+(\.\d+)*\.?|[IVX]+\.|[A-Z]\.)\s+\S/.test(t) // "2.1 Fees", "IV. Hostels", "A. Rules"
      || (/[A-Z]/.test(t) && t === t.toUpperCase());     // "SCHOOL FEES"
}

function sentences(text) {
  const parts = text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) || [text];
  // A "sentence" longer than a chunk (tables, lists without full stops) is split on words
  return parts.flatMap(p => {
    if (p.length <= CHUNK_CHARS) return [p];
    const out = [];
    let cur = '';
    for (const w of p.split(/(\s+)/)) {
      if (cur.length + w.length > CHUNK_CHARS && cur.trim()) { out.push(cur); cur = ''; }
      cur += w;
    }
    if (cur.trim()) out.push(cur);
    return out;
  });
}

// End of a passage, cut at a word boundary, to start the next passage with
function overlapTail(text) {
  if (text.length <= OVERLAP_CHARS) return '';
  const tail = text.slice(-OVERLAP_CHARS);
  const space = tail.indexOf(' ');
  return space >= 0 ? tail.slice(space + 1) : tail;
}

/**
 * Splits text into ~CHUNK_CHARS passages that follow paragraph and section
 * boundaries. Each passage remembers the section heading it falls under.
 */
export function chunkText(text) {
  const clean = String(text ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  const chunks = [];
  let heading = null, chunkHeading = null, buf = '';
  let added = false;  // new text since the last flush (not just the carried-over overlap)

  const flush = () => {
    if (added && buf.trim()) chunks.push({ heading: chunkHeading, content: buf.trim() });
    buf = overlapTail(buf);
    chunkHeading = heading;
    added = false;
  };

  for (const para of clean.split(/\n\s*\n/)) {
    const lines = para.split('\n');
    // A heading starts a new section: don't let a passage span two sections
    if (looksLikeHeading(lines[0])) {
      flush();
      heading = lines[0].replace(/^#+\s*/, '').trim();
      chunkHeading = heading;
      buf = '';
      lines.shift();
      if (lines.length === 0) continue;
    }
    for (const s of sentences(lines.join(' '))) {
      if (buf.length + s.length > CHUNK_CHARS && added) flush();
      buf += s;
      added = true;
    }
    buf += '\n\n';
  }
  flush();
  return chunks.slice(0, MAX_CHUNKS);
}

// ── Writing to the index ──────────────────────────────────────────

// What gets embedded for a passage: its source title and section give it context
const embedText = (meta, c) => [meta.title, c.heading, c.content].filter(Boolean).join('\n');
const hashOf    = text => crypto.createHash('sha1').update(`${EMBEDDING_MODEL}\n${text}`).digest('hex');
const useVectors = () => vectorInfo.ready && embeddingsConfigured();

/** Embeddings already stored, by content hash — `where` limits which rows are read. */
async function storedEmbeddings(client, where = 'TRUE', params = []) {
  if (!vectorInfo.ready) return new Map();
  const { rows } = await client.query(
    `SELECT content_hash, embedding::text AS embedding FROM kb_chunks
     WHERE embedding IS NOT NULL AND content_hash IS NOT NULL AND ${where}`, params);
  return new Map(rows.map(r => [r.content_hash, r.embedding]));
}

/** Embeddings (pgvector text, or null) and hashes for passages, reusing `cache` where the text is unchanged. */
async function embeddingsFor(meta, chunks, cache) {
  const hashes  = chunks.map(c => hashOf(embedText(meta, c)));
  const vectors = hashes.map(h => cache.get(h) ?? null);
  const missing = vectors.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (missing.length && useVectors()) {
    const fresh = await embedPassages(missing.map(i => embedText(meta, chunks[i])));
    if (fresh) missing.forEach((idx, k) => { vectors[idx] = toPgVector(fresh[k]); });
  }
  return { hashes, vectors };
}

/**
 * Replaces all passages of one source. `meta` is shared by every passage:
 * { title, keywords, topic, url, expiresAt, sourceDate }. `cache` holds
 * reusable embeddings; by default, this source's current ones.
 */
async function replaceSource(type, id, meta, chunks, client = db, cache = null) {
  const vec = vectorInfo.ready;
  let hashes = [], vectors = [];
  if (vec) {
    cache ??= await storedEmbeddings(client, 'source_type = $1 AND source_id = $2', [type, String(id)]);
    ({ hashes, vectors } = await embeddingsFor(meta, chunks, cache));
  }

  await client.query('DELETE FROM kb_chunks WHERE source_type = $1 AND source_id = $2', [type, String(id)]);
  if (chunks.length === 0) return;
  await client.query(
    `INSERT INTO kb_chunks (source_type, source_id, title, keywords, topic, url, expires_at, source_date,
                            heading, content, position${vec ? ', content_hash, embedding' : ''})
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, t.heading, t.content, t.position
            ${vec ? `, t.hash, t.embedding::${vectorInfo.schema}.vector` : ''}
     FROM unnest($9::text[], $10::text[], $11::int[]${vec ? ', $12::text[], $13::text[]' : ''})
          AS t(heading, content, position${vec ? ', hash, embedding' : ''})`,
    [type, String(id), meta.title, meta.keywords ?? '', meta.topic ?? null, meta.url ?? null,
     meta.expiresAt ?? null, meta.sourceDate ?? null,
     chunks.map(c => c.heading), chunks.map(c => c.content), chunks.map((_, i) => i),
     ...(vec ? [hashes, vectors] : [])]
  );
}

// Indexing must never break the write that triggered it — the next server
// start rebuilds the index anyway
async function safely(label, fn) {
  try { await fn(); } catch (err) { console.warn(`[KB Index] Could not index ${label}:`, err.message); }
}

function kbEntryArgs(e) {
  return ['kb', e.id, { title: e.question, keywords: e.category, topic: e.category, sourceDate: e.created_at },
          e.active === false ? [] : chunkText(e.answer)];
}

function documentArgs(d) {
  return ['document', d.id, {
    title: d.name, keywords: `${d.category ?? ''} ${d.description ?? ''}`, topic: d.category,
    url: `/api/documents/${d.id}/download`, sourceDate: d.created_at,
  }, chunkText(d.content)];
}

function announcementArgs(a) {
  return ['announcement', a.id, {
    title: a.title, keywords: a.category, topic: a.category, expiresAt: a.expires_at, sourceDate: a.created_at,
  }, chunkText(a.body)];
}

export const indexKBEntry      = e => safely(`knowledge base entry ${e.id}`, () => replaceSource(...kbEntryArgs(e)));
export const indexDocument     = d => safely(`document ${d.id}`,             () => replaceSource(...documentArgs(d)));
export const indexAnnouncement = a => safely(`announcement ${a.id}`,         () => replaceSource(...announcementArgs(a)));

export function removeFromIndex(type, id) {
  return safely(`${type} ${id} (remove)`, () =>
    db.query('DELETE FROM kb_chunks WHERE source_type = $1 AND source_id = $2', [type, String(id)]));
}

/** Rebuilds the whole index from the source tables, in one transaction. */
export async function rebuildIndex() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Instances starting at the same time rebuild one after another
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['kb_index_rebuild']);
    const cache = await storedEmbeddings(client);  // keep embeddings of passages that haven't changed
    await client.query('DELETE FROM kb_chunks');
    for (const [i, e] of LOCAL_KB.entries()) {
      await replaceSource('builtin', i, { title: e.topic, keywords: e.keywords.join(' '), topic: e.topic },
                          [{ heading: e.source, content: e.answer }], client, cache);
    }
    // One connection runs one query at a time, so these go in sequence
    const kb   = await client.query('SELECT id, question, answer, category, active, created_at FROM knowledge_base');
    const docs = await client.query("SELECT id, name, category, description, content, created_at FROM documents WHERE content IS NOT NULL AND content <> ''");
    const anns = await client.query('SELECT id, title, body, category, expires_at, created_at FROM announcements');
    for (const e of kb.rows)   await replaceSource(...kbEntryArgs(e), client, cache);
    for (const d of docs.rows) await replaceSource(...documentArgs(d), client, cache);
    for (const a of anns.rows) await replaceSource(...announcementArgs(a), client, cache);
    await client.query('COMMIT');
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n${vectorInfo.ready ? ', COUNT(embedding)::int AS e' : ''} FROM kb_chunks`);
    const embedded = vectorInfo.ready ? ` (${rows[0].e} with embeddings)` : '';
    console.log(`[KB Index] ${rows[0].n} passages${embedded} from ${LOCAL_KB.length} built-in entries, ${kb.rows.length} KB entries, ${docs.rows.length} documents, ${anns.rows.length} announcements`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn('[KB Index] Rebuild failed:', err.message);
    return false;
  } finally {
    client.release();
  }
}

/** Rebuilds the index only if it was built from different built-in entries (or never built). */
export async function ensureIndex() {
  // Changing the built-in entries or the embedding model triggers a rebuild
  const version = crypto.createHash('sha256').update(JSON.stringify(LOCAL_KB) + EMBEDDING_MODEL).digest('hex').slice(0, 16);
  try {
    const { rows } = await db.query("SELECT value FROM system_config WHERE key = 'kb_index_version'");
    if (rows[0]?.value === version) return;
    if (await rebuildIndex()) {
      await db.query(
        `INSERT INTO system_config (key, value) VALUES ('kb_index_version', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [version]
      );
    }
  } catch (err) {
    console.warn('[KB Index] Check failed:', err.message);
  }
}

/**
 * Embeds passages that don't have an embedding yet — e.g. indexed while the
 * embed function was down, or before semantic search was set up. Cheap when
 * there is nothing to do; runs on startup.
 */
export async function backfillEmbeddings({ batch = 64, maxBatches = 20 } = {}) {
  if (!useVectors()) return;
  let filled = 0;
  try {
    for (let n = 0; n < maxBatches; n++) {
      const { rows } = await db.query(
        `SELECT id, title, heading, content FROM kb_chunks WHERE embedding IS NULL ORDER BY id LIMIT $1`, [batch]);
      if (rows.length === 0) break;
      const texts = rows.map(r => embedText({ title: r.title }, r));
      const vectors = await embedPassages(texts);
      if (!vectors) break;  // function unavailable — try again next start
      await db.query(
        `UPDATE kb_chunks c SET embedding = t.embedding::${vectorInfo.schema}.vector, content_hash = t.hash
         FROM unnest($1::int[], $2::text[], $3::text[]) AS t(id, embedding, hash) WHERE c.id = t.id`,
        [rows.map(r => r.id), vectors.map(toPgVector), texts.map(hashOf)]
      );
      filled += rows.length;
    }
    if (filled) console.log(`[KB Index] Embedded ${filled} passages that were missing embeddings`);
  } catch (err) {
    console.warn('[KB Index] Embedding backfill failed:', err.message);
  }
}
