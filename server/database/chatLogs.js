import { db } from './init.js';

/**
 * Records a chat exchange and returns its public id (used for feedback),
 * or null if it couldn't be saved. Logging must never break a chat reply,
 * so failures are reported and swallowed.
 */
export async function logChat({
  userId = null, userRole = 'guest', sessionId = 'anonymous', conversationId = null, documentId = null,
  question, answer, reasoning = null, suggestions = [], source, sources = [], topic = null,
  provider, usedWebSearch = false, unanswered = false, latencyMs = null,
}) {
  try {
    const result = await db.query(
      `INSERT INTO chat_logs (user_id, user_role, session_id, conversation_id, document_id, question, answer,
                              reasoning, suggestions, source, sources, topic, provider, used_web_search, unanswered, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING public_id`,
      [userId, userRole, sessionId, conversationId, documentId, question, answer,
       reasoning, JSON.stringify(suggestions), source, JSON.stringify(sources), topic, provider, usedWebSearch, unanswered, latencyMs]
    );
    return result.rows[0].public_id;
  } catch (err) {
    console.warn('[ChatLogs] Could not save chat log:', err.message);
    return null;
  }
}
