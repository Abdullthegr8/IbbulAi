import { db } from '../database/init.js';
import { indexAnnouncement, removeFromIndex } from '../services/kbIndex.js';

const COLUMNS = 'id, title, body, category, pinned, expires_at, created_by, created_at';

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Validates the editable fields; returns { fields } or { error }. Only fields present are returned. */
function readFields(body = {}, { requireAll = false } = {}) {
  const fields = {};
  if (body.title !== undefined || requireAll) {
    fields.title = String(body.title ?? '').trim().slice(0, 200);
    if (!fields.title) return { error: 'Title is required' };
  }
  if (body.body !== undefined || requireAll) {
    fields.body = String(body.body ?? '').trim().slice(0, 5000);
    if (!fields.body) return { error: 'Announcement text is required' };
  }
  if (body.category !== undefined) fields.category = String(body.category).trim().slice(0, 100) || 'General';
  if (body.pinned !== undefined)   fields.pinned   = body.pinned === true;
  if (body.expires_at !== undefined) {
    if (body.expires_at === null || body.expires_at === '') {
      fields.expires_at = null;
    } else {
      const date = new Date(body.expires_at);
      if (Number.isNaN(date.getTime())) return { error: 'Invalid expiry date' };
      fields.expires_at = date;
    }
  }
  return { fields };
}

export async function listActiveAnnouncements(req, res) {
  const result = await db.query(
    `SELECT ${COLUMNS} FROM announcements
     WHERE expires_at IS NULL OR expires_at > NOW()
     ORDER BY pinned DESC, created_at DESC LIMIT 20`
  );
  res.json({ announcements: result.rows });
}

export async function listAllAnnouncements(req, res) {
  const result = await db.query(`SELECT ${COLUMNS} FROM announcements ORDER BY created_at DESC LIMIT 200`);
  res.json({ announcements: result.rows });
}

export async function createAnnouncement(req, res) {
  const { fields, error } = readFields(req.body, { requireAll: true });
  if (error) return res.status(400).json({ error });
  const result = await db.query(
    `INSERT INTO announcements (title, body, category, pinned, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [fields.title, fields.body, fields.category || 'General', fields.pinned ?? false, fields.expires_at ?? null, req.user.name || req.user.identifier]
  );
  await indexAnnouncement(result.rows[0]);
  res.status(201).json({ announcement: result.rows[0] });
}

export async function updateAnnouncement(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid announcement id' });
  const { fields, error } = readFields(req.body);
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(fields);
  if (keys.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const result = await db.query(
    `UPDATE announcements SET ${sets} WHERE id = $${keys.length + 1} RETURNING ${COLUMNS}`,
    [...keys.map(k => fields[k]), id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Announcement not found' });
  await indexAnnouncement(result.rows[0]);
  res.json({ announcement: result.rows[0] });
}

export async function deleteAnnouncement(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid announcement id' });
  const result = await db.query('DELETE FROM announcements WHERE id = $1', [id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Announcement not found' });
  await removeFromIndex('announcement', id);
  res.json({ success: true });
}
