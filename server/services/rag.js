/**
 * Knowledge base search (retrieval for RAG).
 *
 * searchKnowledgeBase() runs a weighted full-text search over kb_chunks —
 * passages from the built-in entries, the knowledge_base table, uploaded
 * documents and current announcements (see kbIndex.js) — and returns the best
 * sources, numbered for citation. A passage is only used when it matches
 * enough of the question's terms, so weak matches fall through to the honest
 * "no verified answer" path instead of giving the model loosely related text.
 *
 * searchDocument() instead searches inside a single document, for
 * "ask about this document" conversations.
 */

import { db } from '../database/init.js';
import { getConfig } from './configService.js';
import { LOCAL_KB } from './localKB.js';


const STOPWORDS = new Set(('a an the is are was were be been to of in on at for and or but how what when where which who why do does did can could i my me you your we our it its this that with from by as about please tell know get want need ibbu university').split(' '));

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9'\-]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// Matches "fee" ↔ "fees", "register" ↔ "registration" etc. without a stemmer
function matches(token, word) {
  if (token === word) return true;
  const min = Math.min(token.length, word.length);
  return min >= 4 && (token.startsWith(word.slice(0, min)) || word.startsWith(token.slice(0, min))) &&
         Math.abs(token.length - word.length) <= 5;
}

function score(queryTokens, words) {
  let s = 0;
  for (const q of queryTokens) if (words.some(w => matches(q, w))) s++;
  return s;
}

const MAX_TERMS  = 10;
const PER_SOURCE = 2;  // passages per source, so one long document can't crowd out the rest
const SOURCE_BONUS = { announcement: 0.15, kb: 0.1, document: 0, builtin: 0 };  // newest / curated first on ties
const RELATIVE_CUTOFF = 0.6;  // keep passages scoring at least 60% of the best match
const EMPTY = { sources: [], topic: null, foundInKB: false };

// Question terms for full-text search: lowercase words, no stopwords
function searchTerms(text) {
  // "post-utme" → post, utme (Postgres splits hyphenated words the same way)
  return [...new Set(tokenize(text).flatMap(t => t.split(/[^a-z0-9]+/)).filter(t => t.length > 1 && !STOPWORDS.has(t)))].slice(0, MAX_TERMS);
}

// Longer words also match as a prefix of the stem: "register" finds "registration"
const tsTerm = t => (t.length >= 5 ? `${t}:*` : t);

// How many of the question's terms a passage must contain to count as relevant
const minMatched = n => (n <= 2 ? 1 : Math.ceil(n * 0.4));

async function rankPassages(terms) {
  const params  = [terms.map(tsTerm).join(' | '), ...terms.map(tsTerm), ...terms.map(t => `${tsTerm(t)}A`)];
  const each    = terms.map((_, i) => `to_tsquery('english', $${i + 2})`);
  // Same terms, restricted to weight A (the source's title and keywords)
  const inTitle = terms.map((_, i) => `to_tsquery('english', $${i + 2 + terms.length})`);
  const byTerm  = terms.map((_, i) => `to_tsquery('english', $${i + 1})`);  // for the stats query's own parameters

  const [passages, stats] = await Promise.all([
    db.query(
      `SELECT source_type, source_id, title, topic, url, heading, content, position, source_date,
              ts_rank_cd(search, query, 32) AS rank,
              ARRAY[${each.map(q => `search @@ ${q}`).join(', ')}] AS hits,
              ARRAY[${inTitle.map(q => `search @@ ${q}`).join(', ')}] AS title_hits
       FROM kb_chunks, to_tsquery('english', $1) AS query
       WHERE search @@ query AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY rank DESC
       LIMIT 100`,
      params
    ),
    // How many passages contain each term, for rarity weighting; `valid` is false
    // for words Postgres treats as stopwords
    db.query(
      `SELECT COUNT(*)::int AS total,
              ARRAY[${byTerm.map(q => `COUNT(*) FILTER (WHERE search @@ ${q})::int`).join(', ')}] AS df,
              ARRAY[${byTerm.map(q => `numnode(${q}) > 0`).join(', ')}] AS valid
       FROM kb_chunks`,
      terms.map(tsTerm)
    ),
  ]);

  // Rare words ("zorbatron", "transcript") say more about a match than common ones ("hours", "students")
  const { total, df, valid } = stats.rows[0];
  const idf = terms.map((_, i) => (valid[i] ? Math.log(1 + total / (1 + df[i])) : 0));
  const idfSum = idf.reduce((a, b) => a + b, 0) || 1;
  const n = valid.filter(Boolean).length || terms.length;
  const weigh = flags => flags.reduce((sum, hit, i) => sum + (hit ? idf[i] : 0), 0) / idfSum;
  const count = flags => flags.filter(Boolean).length;

  const ranked = passages.rows
    // Relevant if it covers enough of the question, or the question names the source's subject
    .filter(r => count(r.hits) >= minMatched(n) || count(r.title_hits) >= Math.ceil(n / 3))
    // Weighted coverage of the question, plus a boost when the terms are in the title —
    // a passage *about* course registration beats one that merely mentions it
    .map(r => ({ ...r, score: weigh(r.hits) + 0.75 * weigh(r.title_hits) + Number(r.rank) + SOURCE_BONUS[r.source_type] }))
    .sort((a, b) => b.score - a.score);
  // Drop passages far weaker than the best one — they add noise, not answers
  const best = ranked[0]?.score ?? 0;
  return ranked.filter(r => r.score >= best * RELATIVE_CUTOFF);
}

// Database unavailable: keyword-match the built-in entries in memory
function rankBuiltinFallback(terms) {
  return LOCAL_KB
    .map((e, i) => ({
      source_type: 'builtin', source_id: String(i), title: e.topic, topic: e.topic, url: null,
      heading: e.source, content: e.answer, position: 0, source_date: null,
      score: score(terms, [...e.keywords, ...tokenize(e.topic)]),
    }))
    .filter(r => r.score >= minMatched(terms.length))
    .sort((a, b) => b.score - a.score);
}

/** Groups ranked passages into numbered sources, best first. */
function toSources(passages) {
  const topK = Number(getConfig('rag_top_k')) || 5;
  const bySource = new Map();
  let used = 0;
  for (const p of passages) {
    if (used >= topK) break;
    const key = `${p.source_type}:${p.source_id}`;
    let src = bySource.get(key);
    if (!src) {
      src = {
        n: bySource.size + 1, type: p.source_type, id: p.source_id, title: p.title, topic: p.topic,
        url: p.url, date: p.source_date, passages: [],
      };
      bySource.set(key, src);
    }
    if (src.passages.length >= PER_SOURCE) continue;
    src.passages.push({ heading: p.heading, content: p.content, position: p.position });
    used++;
  }
  const sources = [...bySource.values()];
  for (const s of sources) s.passages.sort((a, b) => a.position - b.position);
  return sources;
}

async function search(terms) {
  if (terms.length === 0) return EMPTY;
  let passages;
  try {
    passages = await rankPassages(terms);
  } catch (err) {
    console.warn('[RAG] Search failed, using built-in entries only:', err.message);
    passages = rankBuiltinFallback(terms);
  }
  const sources = toSources(passages);
  return sources.length ? { sources, topic: sources[0].topic, foundInKB: true } : EMPTY;
}

/**
 * Finds the knowledge base sources for a question. Follow-ups ("what about
 * direct entry?") don't say what they're about, so when the question is short
 * or finds nothing, the previous question's terms are added and the search
 * runs again — no extra LLM call needed.
 */
export async function searchKnowledgeBase(question, { previousQuestion } = {}) {
  const terms = searchTerms(question);
  let result = await search(terms);
  if (previousQuestion && (!result.foundInKB || terms.length <= 3)) {
    // Current terms first, so they survive the MAX_TERMS cut
    const withContext = await search(searchTerms(`${question} ${previousQuestion}`));
    if (withContext.foundInKB) result = withContext;
  }
  return result;
}

/** Context block for the model: each source with its citation number. */
export function formatContext(sources) {
  return sources.map(s => {
    const label =
      s.type === 'announcement' ? `ANNOUNCEMENT: ${s.title}${s.date ? ` (posted ${new Date(s.date).toISOString().slice(0, 10)})` : ''}` :
      s.type === 'document'     ? `Document "${s.title}"` :
      s.type === 'kb'           ? `IBBU Knowledge Base — ${s.title}` :
                                  `${s.title} (source: ${s.passages[0]?.heading ?? 'IBBU'})`;
    const body = s.passages
      .map(p => (s.type === 'document' && p.heading ? `(${p.heading}) ` : '') + p.content)
      .join('\n[…]\n');
    return `[${s.n}] ${label}\n${body}`;
  }).join('\n\n');
}

/** What the client is shown for each source (no passage text). */
export function publicSources(sources) {
  return sources.map(s => ({
    n:      s.n,
    type:   s.type,
    title:  s.title,
    detail: s.type === 'builtin' ? (s.passages[0]?.heading ?? null)
          : s.type === 'document' ? (s.passages[0]?.heading ?? null)
          : s.type === 'kb' ? s.topic : null,
    url:    s.url ?? null,
    date:   s.date ?? null,
  }));
}

const DOC_CHUNK_CHARS   = 1200;
const DOC_CONTEXT_CHARS = 9000;

/**
 * Picks the parts of one document most relevant to the query, kept in
 * document order. Short documents are sent whole. Returns null if the
 * document doesn't exist or has no extracted text.
 */
export async function searchDocument(documentId, query) {
  const result = await db.query('SELECT id, name, content FROM documents WHERE id = $1', [documentId]);
  const doc = result.rows[0];
  if (!doc || !doc.content?.trim()) return null;

  const text = doc.content.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length <= DOC_CONTEXT_CHARS) return { name: doc.name, context: text };

  // Split on paragraph breaks, packing paragraphs into ~DOC_CHUNK_CHARS chunks
  const chunks = [];
  let current = '';
  for (const para of text.split(/\n\n/)) {
    if (current && current.length + para.length > DOC_CHUNK_CHARS) { chunks.push(current); current = ''; }
    current += (current ? '\n\n' : '') + para;
    while (current.length > DOC_CHUNK_CHARS * 2) { chunks.push(current.slice(0, DOC_CHUNK_CHARS)); current = current.slice(DOC_CHUNK_CHARS); }
  }
  if (current) chunks.push(current);

  const queryTokens = tokenize(query);
  const picked = new Set([0]); // the opening usually says what the document is
  let used = chunks[0].length;
  const ranked = chunks
    .map((c, i) => ({ i, s: score(queryTokens, tokenize(c)) }))
    .filter(c => c.s > 0)
    .sort((a, b) => b.s - a.s);
  for (const { i } of ranked) {
    if (used + chunks[i].length > DOC_CONTEXT_CHARS) continue;
    picked.add(i);
    used += chunks[i].length;
  }

  const context = [...picked].sort((a, b) => a - b)
    .map((i, n, arr) => (n > 0 && arr[n - 1] !== i - 1 ? '[…]\n' : '') + chunks[i])
    .join('\n\n');
  return { name: doc.name, context };
}
