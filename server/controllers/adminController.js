import { db } from '../database/init.js';
import { getProviderInfo, SUPPORTED_PROVIDERS, GROQ_MODELS } from '../providers/llm.js';
import { getAllConfig, setManyConfig } from '../services/configService.js';

export async function getStats(req, res) {
  try {
    const [docs, chats, users, today] = await Promise.all([
      db.query('SELECT COUNT(*) FROM documents'),
      db.query('SELECT COUNT(*) FROM chat_logs'),
      db.query('SELECT COUNT(DISTINCT user_id) FROM chat_logs WHERE user_id IS NOT NULL'),
      db.query("SELECT COUNT(*) FROM chat_logs WHERE created_at > NOW() - INTERVAL '1 day'"),
    ]);
    res.json({
      totalDocuments: parseInt(docs.rows[0].count),
      totalChats:     parseInt(chats.rows[0].count),
      totalUsers:     parseInt(users.rows[0].count),
      questionsToday: parseInt(today.rows[0].count),
      provider:       getProviderInfo(),
    });
  } catch {
    res.json({ totalDocuments: 0, totalChats: 0, totalUsers: 0, questionsToday: 0, provider: getProviderInfo() });
  }
}

export async function getChatLogs(req, res) {
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  try {
    const result = await db.query(
      `SELECT id, question, answer, source, provider, used_web_search, created_at
       FROM chat_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ logs: result.rows });
  } catch {
    res.json({ logs: [] });
  }
}

export async function getTopQuestions(req, res) {
  try {
    const result = await db.query(
      `SELECT question, COUNT(*) as count FROM chat_logs GROUP BY question ORDER BY count DESC LIMIT 10`
    );
    res.json({ questions: result.rows });
  } catch {
    res.json({ questions: [] });
  }
}

export async function getKnowledgeBase(req, res) {
  try {
    const result = await db.query('SELECT * FROM knowledge_base ORDER BY created_at DESC');
    res.json({ entries: result.rows });
  } catch {
    res.json({ entries: [] });
  }
}

export async function addKBEntry(req, res) {
  const { question, answer, category } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });
  try {
    const result = await db.query(
      'INSERT INTO knowledge_base (question, answer, category) VALUES ($1, $2, $3) RETURNING *',
      [question, answer, category || 'General']
    );
    res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('[KB] Add error:', err.message);
    res.status(500).json({ error: 'Failed to add entry' });
  }
}

export async function deleteKBEntry(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid entry id' });
  try {
    await db.query('DELETE FROM knowledge_base WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[KB] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
}

// ── Settings — reads from system_config table ─────────────────────
export async function getSettings(req, res) {
  const config = getAllConfig();
  res.json({
    llm_provider:       config.llm_provider,
    groq_model:         config.groq_model,
    openai_model:       config.openai_model,
    anthropic_model:    config.anthropic_model,
    web_search_enabled: config.web_search_enabled,
    rag_top_k:          config.rag_top_k,
    max_file_size_mb:   config.max_file_size_mb,
  });
}

// ── Save settings → persists to system_config table ──────────────
// Each setting's validator; a bad value would otherwise be saved and break chat
const SETTING_RULES = {
  llm_provider:       v => SUPPORTED_PROVIDERS.includes(v),
  groq_model:         v => GROQ_MODELS.includes(v),
  openai_model:       v => /^[\w.\-]{1,64}$/.test(v),
  anthropic_model:    v => /^[\w.\-]{1,64}$/.test(v),
  web_search_enabled: v => v === 'true' || v === 'false',
  rag_top_k:          v => ['3', '5', '10'].includes(v),
  max_file_size_mb:   v => ['25', '50', '100'].includes(v),
};

export async function saveSettings(req, res) {
  const updates = {};
  for (const [key, isValid] of Object.entries(SETTING_RULES)) {
    if (req.body[key] === undefined) continue;
    const value = String(req.body[key]);
    if (!isValid(value)) {
      return res.status(400).json({ error: `Invalid value for ${key}: "${value}"` });
    }
    updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid settings provided' });
  }

  try {
    await setManyConfig(updates);
    res.json({
      success:  true,
      message:  'Settings saved successfully',
      settings: updates,
    });
  } catch (err) {
    console.error('[Settings] Save error:', err.message);
    res.status(500).json({ error: 'Failed to save settings' });
  }
}
