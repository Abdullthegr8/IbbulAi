import { db } from '../database/init.js';
import { getProviderInfo } from '../providers/llm.js';
import { getAllConfig, setManyConfig } from '../services/configService.js';
import { indexKBEntry, removeFromIndex } from '../services/kbIndex.js';

export async function getStats(req, res) {
  try {
    const [docs, chats, users, today] = await Promise.all([
      db.query('SELECT COUNT(*) FROM documents'),
      db.query('SELECT COUNT(*) FROM chat_logs'),
      db.query("SELECT COUNT(DISTINCT user_id) FROM chat_logs WHERE user_id IS NOT NULL AND user_role IS DISTINCT FROM 'admin'"),
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
      `SELECT id, question, answer, source, provider, used_web_search, unanswered, feedback, user_role, created_at
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
    await indexKBEntry(result.rows[0]);
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
    await removeFromIndex('kb', id);
    res.json({ success: true });
  } catch (err) {
    console.error('[KB] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
}

// ── Inbox — questions the bot couldn't answer, or answers rated unhelpful ──
// Repeats of the same question are grouped so staff fix each gap once.
const NEEDS_ATTENTION = '(unanswered OR feedback = -1) AND NOT resolved';

export async function getInbox(req, res) {
  const result = await db.query(
    `SELECT lower(trim(question))                                 AS key,
            (array_agg(question ORDER BY created_at DESC))[1]     AS question,
            (array_agg(answer   ORDER BY created_at DESC))[1]     AS last_answer,
            COUNT(*)::int                                         AS count,
            COUNT(*) FILTER (WHERE unanswered)::int               AS unanswered_count,
            COUNT(*) FILTER (WHERE feedback = -1)::int            AS thumbs_down,
            MAX(created_at)                                       AS last_asked
     FROM chat_logs WHERE ${NEEDS_ATTENTION}
     GROUP BY lower(trim(question))
     ORDER BY count DESC, last_asked DESC LIMIT 100`
  );
  res.json({ items: result.rows });
}

/**
 * POST /admin/inbox/resolve { key, kb?: { question, answer, category } }
 * Optionally adds a knowledge base entry, then marks every log of that question resolved.
 */
export async function resolveInboxItem(req, res) {
  const key = String(req.body?.key ?? '').trim().toLowerCase();
  if (!key) return res.status(400).json({ error: 'Question key is required' });

  const kb = req.body?.kb;
  let entry = null;
  if (kb) {
    const question = String(kb.question ?? '').trim().slice(0, 500);
    const answer   = String(kb.answer ?? '').trim().slice(0, 10000);
    const category = String(kb.category ?? '').trim().slice(0, 100) || 'General';
    if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });
    const inserted = await db.query(
      'INSERT INTO knowledge_base (question, answer, category) VALUES ($1, $2, $3) RETURNING *',
      [question, answer, category]
    );
    entry = inserted.rows[0];
    await indexKBEntry(entry);
  }

  const result = await db.query(
    `UPDATE chat_logs SET resolved = TRUE WHERE lower(trim(question)) = $1 AND ${NEEDS_ATTENTION}`,
    [key]
  );
  res.json({ success: true, resolved: result.rowCount, entry });
}

// ── Analytics ─────────────────────────────────────────────────────
const TIMEZONE = 'Africa/Lagos';

export async function getAnalytics(req, res) {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = `NOW() - make_interval(days => ${days})`;

  const [daily, hours, topics, roles, totals] = await Promise.all([
    db.query(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE '${TIMEZONE}'), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS questions,
              COUNT(*) FILTER (WHERE unanswered)::int AS unanswered
       FROM chat_logs WHERE created_at > ${since}
       GROUP BY 1 ORDER BY 1`
    ),
    db.query(
      `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE '${TIMEZONE}')::int AS hour, COUNT(*)::int AS questions
       FROM chat_logs WHERE created_at > ${since} GROUP BY 1 ORDER BY 1`
    ),
    db.query(
      `SELECT COALESCE(topic, 'Other') AS topic, COUNT(*)::int AS questions
       FROM chat_logs WHERE created_at > ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`
    ),
    db.query(
      `SELECT COALESCE(user_role, 'guest') AS role, COUNT(*)::int AS questions
       FROM chat_logs WHERE created_at > ${since} GROUP BY 1 ORDER BY 2 DESC`
    ),
    db.query(
      `SELECT COUNT(*)::int                                 AS questions,
              COUNT(*) FILTER (WHERE unanswered)::int       AS unanswered,
              COUNT(*) FILTER (WHERE feedback = 1)::int     AS helpful,
              COUNT(*) FILTER (WHERE feedback = -1)::int    AS not_helpful,
              ROUND(AVG(latency_ms))::int                   AS avg_latency_ms
       FROM chat_logs WHERE created_at > ${since}`
    ),
  ]);

  // Fill in days and hours with no questions so charts have no gaps
  const byDay = new Map(daily.rows.map(r => [r.day, r]));
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    series.push(byDay.get(day) ?? { day, questions: 0, unanswered: 0 });
  }
  const byHour = new Map(hours.rows.map(r => [r.hour, r.questions]));

  res.json({
    days,
    totals:  totals.rows[0],
    daily:   series,
    hours:   Array.from({ length: 24 }, (_, hour) => ({ hour, questions: byHour.get(hour) ?? 0 })),
    topics:  topics.rows,
    roles:   roles.rows,
  });
}

// ── Settings — reads from system_config table ─────────────────────
export async function getSettings(req, res) {
  const config = getAllConfig();
  res.json({
    web_search_enabled: config.web_search_enabled,
    rag_top_k:          config.rag_top_k,
    max_file_size_mb:   config.max_file_size_mb,
  });
}

// ── Save settings → persists to system_config table ──────────────
// Each setting's validator; a bad value would otherwise be saved and break chat
const SETTING_RULES = {
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
