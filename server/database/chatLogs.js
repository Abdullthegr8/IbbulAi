import { db } from './init.js';

/**
 * Records a chat exchange. Logging must never break a chat reply,
 * so failures are reported and swallowed.
 */
export async function logChat({ userId = null, sessionId = 'anonymous', question, answer, source, provider, usedWebSearch = false }) {
  try {
    await db.query(
      `INSERT INTO chat_logs (user_id, session_id, question, answer, source, provider, used_web_search)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, sessionId, question, answer, source, provider, usedWebSearch]
    );
  } catch (err) {
    console.warn('[ChatLogs] Could not save chat log:', err.message);
  }
}
