/**
 * Text embeddings for semantic search.
 *
 * Computed by the "embed" Supabase Edge Function (supabase/functions/embed),
 * which runs Supabase's built-in gte-small model — 384 dimensions, no extra
 * API key or cost, and nothing heavy bundled into the server. Needs
 * SUPABASE_URL and EMBED_SECRET; without them (or if the function fails)
 * semantic search is skipped and keyword search still works.
 */

export const EMBEDDING_MODEL = 'supabase/gte-small';
export const EMBEDDING_DIMS  = 384;

const BATCH_SIZE = 32;      // the function's per-request limit
const TIMEOUT_MS = 20_000;  // a cold function can take a few seconds

export function embeddingsConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.EMBED_SECRET);
}

let warned = false;

async function embed(texts) {
  if (!embeddingsConfigured()) return null;
  const url = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/embed`;
  try {
    const vectors = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-embed-secret': process.env.EMBED_SECRET },
        body:    JSON.stringify({ input: texts.slice(i, i + BATCH_SIZE).map(t => String(t).trim() || '.') }),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`embed function returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const { embeddings } = await res.json();
      if (!Array.isArray(embeddings) || embeddings[0]?.length !== EMBEDDING_DIMS) throw new Error('unexpected response shape');
      vectors.push(...embeddings);
    }
    warned = false;
    return vectors;
  } catch (err) {
    // Log once per outage, not on every question
    if (!warned) console.warn('[Embeddings] Unavailable — using keyword search only:', err.message);
    warned = true;
    return null;
  }
}

/** Vectors for passages being indexed, or null if embeddings are unavailable. */
export const embedPassages = texts => embed(texts);

/** Vector for a search query, or null if embeddings are unavailable. */
export async function embedQuery(text) {
  return (await embed([text]))?.[0] ?? null;
}

/** pgvector's text format: [0.1,0.2,…] */
export function toPgVector(vector) {
  return `[${vector.map(x => Number(x).toFixed(6)).join(',')}]`;
}
