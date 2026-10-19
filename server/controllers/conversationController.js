import { db } from '../database/init.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Admin tokens issued before v1.8 have no users row, so no saved conversations
function ownerId(req) {
  return UUID_RE.test(String(req.user.id)) ? req.user.id : null;
}

export async function listConversations(req, res) {
  const userId = ownerId(req);
  if (!userId) return res.json({ conversations: [] });
  const result = await db.query(
    `SELECT c.id, c.title, c.document_id, d.name AS document_name, c.created_at, c.updated_at
     FROM conversations c LEFT JOIN documents d ON d.id = c.document_id
     WHERE c.user_id = $1 ORDER BY c.updated_at DESC LIMIT 100`,
    [userId]
  );
  res.json({ conversations: result.rows });
}

export async function getConversation(req, res) {
  const userId = ownerId(req);
  if (!userId || !UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Conversation not found' });
  const conv = await db.query(
    `SELECT c.id, c.title, c.document_id, d.name AS document_name, c.created_at, c.updated_at
     FROM conversations c LEFT JOIN documents d ON d.id = c.document_id
     WHERE c.id = $1 AND c.user_id = $2`,
    [req.params.id, userId]
  );
  if (!conv.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

  const logs = await db.query(
    `SELECT public_id, question, answer, reasoning, suggestions, sources, unanswered, feedback, created_at
     FROM chat_logs WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500`,
    [req.params.id]
  );
  res.json({ conversation: conv.rows[0], exchanges: logs.rows });
}

export async function deleteConversation(req, res) {
  const userId = ownerId(req);
  if (!userId || !UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Conversation not found' });
  // Chat logs stay (conversation_id is set to NULL) so admin analytics remain accurate
  const result = await db.query('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Conversation not found' });
  res.json({ success: true });
}
