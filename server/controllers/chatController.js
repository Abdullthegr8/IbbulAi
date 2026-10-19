import { db } from '../database/init.js';
import { searchKnowledgeBase, searchDocument, formatContext, publicSources } from '../services/rag.js';
import { logChat } from '../database/chatLogs.js';
import { chat } from '../providers/llm.js';
import { webSearch, webSearchAvailable } from '../services/webSearch.js';

const SYSTEM_PROMPT = `You are IbbulAI, the official intelligent assistant for Ibrahim Badamasi Babangida University (IBBU), Lapai, Niger State, Nigeria.

Your role is to help students, staff, lecturers, and prospective students with accurate information about IBBU.

## PERSONALITY & TONE
- Friendly yet professional — like a knowledgeable senior student or academic advisor
- Warm, clear, and encouraging
- Always refer to the university as "IBBU" or "Ibrahim Badamasi Babangida University, Lapai"

## RESPONSE FORMATTING RULES
You MUST format your responses properly using markdown:

- Use **bold** for important terms, deadlines, amounts, and key phrases
- Use numbered lists (1. 2. 3.) for steps, processes, and sequential instructions
- Use bullet points (- item) for non-sequential lists of items
- Use ### headers for major sections when the response covers multiple topics
- Use > blockquote for important notes or warnings
- Keep paragraphs short — 2-3 sentences maximum
- Always add a blank line between sections

### Example of good formatting:
When asked "How do I register my courses?", respond like:

### Course Registration Steps

1. **Log in** to the student portal at portal.ibbu.edu.ng using your matric number
2. **Navigate** to the Course Registration section
3. **Select** your courses for the semester
4. **Submit** your registration before the deadline

> **Important:** You must pay your school fees before you can register courses. Late registration attracts a penalty fee.

**Deadline:** Registration closes 3 weeks after resumption.

---

## TOPICS YOU HANDLE
- Admission requirements, JAMB, Post-UTME, screening
- School fees, payment procedures, Bursary
- Course registration and student portal
- Examination timetables, rules, and results
- Hostel and accommodation
- Academic calendar and semester dates
- Faculties, departments, and programmes
- Scholarships, bursaries, and financial aid
- Transcript, clearance, and graduation
- University facilities (library, ICT centre, clinic)
- General student life at IBBU

## RULES
- Respond in English only
- If context from the knowledge base is provided, use it as your primary source
- Each knowledge base source is numbered, e.g. [1]. When a sentence uses information from a source, end it with that number in square brackets, e.g. "Fees are paid online [2]." or "[1][3]". Only cite numbers that appear in the context; never cite general advice
- Context marked ANNOUNCEMENT is the newest official information — it overrides any other source
- Format ALL responses with proper markdown — never respond with a wall of plain text
- For completely off-topic questions, gently redirect to university matters
- Always end with the <suggestions> block

## WHEN YOU DON'T KNOW
- Only state specific facts — amounts, dates, deadlines, cut-off marks, names, phone numbers, emails — if they appear in the provided context. Never invent them.
- If the question is about IBBU and the context does not answer it, say plainly that you don't have verified information on that. Give any general guidance that is safe, then tell the user which office to contact (see OFFICES below).
- In that case, put the tag <unanswered/> on its own line just before the <suggestions> block.
- Do not use <unanswered/> for greetings, thanks, or off-topic questions.

## OFFICES
- **Admissions Office** — admission, Post-UTME, screening, clearance of new students
- **Bursary Department** — school fees, payments, receipts, refunds
- **Academic Affairs** — course registration, academic calendar, programmes, graduation
- **Examination Unit** (or your faculty's exams officer) — timetables, results
- **Student Affairs Division** — hostels, scholarships, student welfare, ID cards
- **Registry (Registrar's Office)** — transcripts, certificates, statements of result
- **ICT Centre** — student portal, passwords, university email, internet
- **University Library** — library registration, borrowing, e-resources
- **Postgraduate School** — PGD, Master's and PhD programmes
- The official IBBU website for announcements and contact details

## SUGGESTIONS FORMAT
Always end EVERY response with exactly this format:
<suggestions>
["Follow-up question 1?", "Follow-up question 2?", "Follow-up question 3?"]
</suggestions>`;

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 4000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_SUGGESTIONS = [
  'What are the admission requirements for IBBU?',
  'How do I pay my school fees?',
  'How do I register my courses?',
];
const CONNECTION_ERROR = "I'm having trouble connecting right now. Please try again in a moment.";

function clientError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * Validates the request and builds everything the LLM call needs:
 * conversation history, retrieved context and the final message list.
 * Throws an error with a 4xx `status` for bad requests.
 */
async function prepareChat(req) {
  const { message, history = [], conversationId, documentId } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    throw clientError(400, 'Message is required');
  }
  const trimmed = message.trim().slice(0, MAX_MESSAGE_CHARS);

  // Signed-in users get saved conversations (admin tokens issued before v1.8 have no users row)
  const canSave = !!req.user && UUID_RE.test(String(req.user.id));

  let conversation = null;
  if (conversationId != null) {
    if (!canSave) throw clientError(401, 'Sign in to continue a saved conversation');
    if (!UUID_RE.test(String(conversationId))) throw clientError(400, 'Invalid conversation id');
    const found = await db.query(
      'SELECT id, document_id FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );
    if (!found.rows[0]) throw clientError(404, 'Conversation not found');
    conversation = found.rows[0];
  }

  // A saved conversation keeps the document it was started with
  const scopedDocId = conversation ? conversation.document_id : (documentId ?? null);
  if (scopedDocId != null && !UUID_RE.test(String(scopedDocId))) {
    throw clientError(400, 'Invalid document id');
  }

  // History: from the database for saved conversations, otherwise from the
  // client — which we don't trust, so bound its size and shape
  let conversationHistory;
  if (conversation) {
    const past = await db.query(
      `SELECT question, answer FROM chat_logs WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [conversation.id, MAX_HISTORY_TURNS / 2]
    );
    conversationHistory = past.rows.reverse().flatMap(r => [
      { role: 'user',      content: r.question.slice(0, MAX_HISTORY_CHARS) },
      { role: 'assistant', content: r.answer.slice(0, MAX_HISTORY_CHARS) },
    ]);
  } else {
    conversationHistory = (Array.isArray(history) ? history : [])
      .filter(h => h && typeof h === 'object' && (h.role === 'user' || h.role === 'assistant'))
      .slice(-MAX_HISTORY_TURNS)
      .map(h => ({
        role:    h.role,
        content: String(h.content ?? '').slice(0, MAX_HISTORY_CHARS),
      }))
      .filter(h => h.content.trim());
  }

  const retrieval = { sources: [], topic: null, foundInKB: false, usedWebSearch: false, documentName: null };
  const previousQuestion = [...conversationHistory].reverse().find(h => h.role === 'user')?.content;
  let userContent;

  if (scopedDocId) {
    // "Ask about this document" — answer from that document only
    const doc = await searchDocument(scopedDocId, trimmed);
    if (!doc) throw clientError(400, 'That document has no searchable text');
    retrieval.sources      = [{ n: 1, type: 'document', title: doc.name, detail: null, url: `/api/documents/${scopedDocId}/download`, date: null }];
    retrieval.topic        = 'Document Q&A';
    retrieval.foundInKB    = true;
    retrieval.documentName = doc.name;
    userContent = `${trimmed}\n\n[CONTEXT FROM DOCUMENT "${doc.name}" — the user is asking about this document. Answer ONLY from it; if the answer isn't in it, say so and use <unanswered/>.]\n${doc.context}\n[END DOCUMENT]`;
  } else {
    // Step 1: search the IBBU knowledge base first
    const kb = await searchKnowledgeBase(trimmed, { previousQuestion });
    Object.assign(retrieval, { sources: publicSources(kb.sources), topic: kb.topic, foundInKB: kb.foundInKB });

    // Step 1b: Web search fallback (only when enabled and configured)
    let webResults = [];
    if (!kb.foundInKB && webSearchAvailable()) {
      try {
        webResults = await webSearch(trimmed);
      } catch (err) {
        console.warn('[Chat] Web search failed:', err.message);
      }
    }
    retrieval.usedWebSearch = webResults.length > 0;

    if (kb.foundInKB) {
      userContent = `${trimmed}\n\n[CONTEXT FROM IBBU KNOWLEDGE BASE — numbered sources; cite them as [n]. If they don't answer the question, say so and use <unanswered/>.]\n${formatContext(kb.sources)}\n[END CONTEXT]`;
    } else if (retrieval.usedWebSearch) {
      retrieval.sources = webResults.map((r, i) => ({ n: i + 1, type: 'web', title: r.title || r.url, detail: null, url: r.url, date: null }));
      const web = webResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n');
      userContent = `${trimmed}\n\n[WEB SEARCH RESULTS — may be unofficial, cite sources and advise verifying with IBBU]\n${web}\n[END RESULTS]`;
    } else {
      userContent = `${trimmed}\n\n[NO MATCHING ENTRIES IN THE IBBU KNOWLEDGE BASE — do not guess specific facts]`;
    }
  }

  return {
    trimmed,
    canSave,
    conversation,
    documentId: scopedDocId,
    retrieval,
    startedAt: Date.now(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userContent },
    ],
  };
}

/** Splits the model's raw reply into the answer, suggestions and the unanswered flag. */
function parseAnswer(rawAnswer, question) {
  let answer = rawAnswer.trim();
  let suggestions = [];

  const suggMatch = answer.match(/<suggestions>\s*([\s\S]*?)\s*<\/suggestions>/);
  if (suggMatch) {
    try { suggestions = JSON.parse(suggMatch[1].trim()); } catch { /* use fallbacks */ }
  }
  // Also drops an unclosed block when the model ran out of tokens mid-way
  answer = answer.replace(/<suggestions>[\s\S]*?(<\/suggestions>|$)/, '');

  const unanswered = /<unanswered\s*\/?>/i.test(answer);
  answer = answer.replace(/<unanswered\s*\/?>/gi, '').trim();

  // The model can run out of tokens while still reasoning
  if (!answer) {
    answer = "Sorry, I couldn't finish my answer. Please try asking again, or rephrase your question.";
  }
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    suggestions = getFallbackSuggestions(question);
  }
  return { answer, unanswered, suggestions: suggestions.slice(0, 3).map(s => String(s)) };
}

/** Saves the exchange (conversation + chat log) and builds the response body. */
async function finishChat(req, ctx, { text, reasoning, provider, model }) {
  const { answer, unanswered, suggestions } = parseAnswer(text, ctx.trimmed);
  const { retrieval } = ctx;

  let conversationId = ctx.conversation?.id ?? null;
  if (ctx.canSave) {
    try {
      if (conversationId) {
        await db.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
      } else {
        const created = await db.query(
          'INSERT INTO conversations (user_id, title, document_id) VALUES ($1, $2, $3) RETURNING id',
          [req.user.id, ctx.trimmed.replace(/\s+/g, ' ').slice(0, 80), ctx.documentId]
        );
        conversationId = created.rows[0].id;
      }
    } catch (err) {
      console.warn('[Chat] Could not save conversation:', err.message);
    }
  }

  const logId = await logChat({
    userId:         ctx.canSave ? req.user.id : null,
    userRole:       req.user?.role || 'guest',
    conversationId,
    documentId:     ctx.documentId,
    question:       ctx.trimmed,
    answer,
    reasoning:      reasoning || null,
    suggestions,
    source:         retrieval.foundInKB ? (retrieval.sources[0]?.title || 'Knowledge base') : retrieval.usedWebSearch ? 'Web search' : `${provider} LLM`,
    sources:        retrieval.sources,
    topic:          retrieval.topic,
    provider,
    usedWebSearch:  retrieval.usedWebSearch,
    unanswered,
    latencyMs:      Date.now() - ctx.startedAt,
  });

  return {
    answer,
    reasoning:      reasoning || null,
    suggestions,
    unanswered,
    foundInKB:      retrieval.foundInKB,
    usedWebSearch:  retrieval.usedWebSearch,
    sources:        retrieval.sources,
    logId,
    conversationId,
    meta:           { model, provider },
  };
}

function sendClientError(res, err) {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error('[Chat] Error:', err);
  return res.status(500).json({ answer: CONNECTION_ERROR, suggestions: DEFAULT_SUGGESTIONS, error: true });
}

export async function handleChat(req, res) {
  let ctx;
  try {
    ctx = await prepareChat(req);
  } catch (err) {
    return sendClientError(res, err);
  }

  try {
    const result = await chat(ctx.messages);
    return res.json(await finishChat(req, ctx, result));
  } catch (err) {
    console.error('[Chat] Error:', err);
    return res.status(500).json({ answer: CONNECTION_ERROR, suggestions: DEFAULT_SUGGESTIONS, error: true });
  }
}

/**
 * Same as handleChat, but streams the reply as server-sent events:
 *   start     { documentName }        retrieval finished, model starting
 *   reasoning { d }                   piece of the model's thought process
 *   answer    { d }                   piece of the answer (may include the raw
 *                                     <suggestions> / <unanswered/> tags — the
 *                                     client hides them; `done` has the clean text)
 *   done      { ...handleChat body }  final answer, suggestions, logId, conversationId
 *   error     { answer, suggestions }
 */
export async function handleChatStream(req, res) {
  let ctx;
  try {
    ctx = await prepareChat(req);
  } catch (err) {
    return sendClientError(res, err); // plain JSON — the stream hasn't started
  }

  res.writeHead(200, {
    'Content-Type':      'text/event-stream; charset=utf-8',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no', // stop nginx-style proxies from buffering the stream
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Stop generating (and paying for tokens) when the user presses Stop or leaves
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  send('start', { documentName: ctx.retrieval.documentName });
  try {
    const result = await chat(ctx.messages, {
      signal:      abort.signal,
      onReasoning: d => send('reasoning', { d }),
      onContent:   d => send('answer', { d }),
    });
    send('done', await finishChat(req, ctx, result));
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error('[Chat] Stream error:', err);
    send('error', { answer: CONNECTION_ERROR, suggestions: DEFAULT_SUGGESTIONS });
  }
  res.end();
}

/** POST /api/chat/feedback { id, value: 1 | -1 | 0 } — 0 clears the rating. */
export async function handleFeedback(req, res) {
  const { id, value } = req.body ?? {};
  if (!UUID_RE.test(String(id))) return res.status(400).json({ error: 'Invalid message id' });
  if (![1, -1, 0].includes(value)) return res.status(400).json({ error: 'Feedback must be 1, -1 or 0' });

  // The public id is unguessable and only given to whoever received the answer
  const result = await db.query(
    'UPDATE chat_logs SET feedback = $2 WHERE public_id = $1',
    [id, value === 0 ? null : value]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Message not found' });
  res.json({ success: true });
}

function getFallbackSuggestions(query) {
  const q = query.toLowerCase();
  if (q.includes('admission') || q.includes('apply') || q.includes('jamb'))
    return ['What documents do I need for IBBU admission?', 'What is the JAMB cut-off mark for IBBU?', 'How do I complete my clearance after admission?'];
  if (q.includes('fee') || q.includes('pay') || q.includes('bursary'))
    return ['How do I generate a fee payment invoice?', 'Can I pay school fees in instalments?', 'What is the deadline for fee payment?'];
  if (q.includes('register') || q.includes('course') || q.includes('portal'))
    return ['What is the deadline for course registration?', 'How many units can I register per semester?', 'What happens if I miss registration?'];
  if (q.includes('hostel') || q.includes('accommodation'))
    return ['What is the hostel fee at IBBU?', 'How is hostel allocation done?', 'Are there off-campus housing options near IBBU?'];
  if (q.includes('exam') || q.includes('result') || q.includes('timetable'))
    return ['How do I check my examination results?', 'What are the rules during examinations?', 'What happens if I miss an exam?'];
  return DEFAULT_SUGGESTIONS;
}
