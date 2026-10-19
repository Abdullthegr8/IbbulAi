import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from '../database/init.js';
import { ALLOWED_MIMETYPES } from '../middleware/upload.js';
import { cloudinaryEnabled, uploadBuffer, deleteFile } from '../services/cloudinary.js';
import { extractText } from '../services/textExtract.js';
import { indexDocument, removeFromIndex } from '../services/kbIndex.js';

const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

// `searchable`: has extracted text, so the chatbot can answer questions about it
const PUBLIC_COLUMNS = "id, name, category, description, cloudinary_url, mimetype, size, created_at, updated_at, (content IS NOT NULL AND content <> '') AS searchable";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export async function listDocuments(req, res) {
  const category = cleanText(req.query.category, 100);
  const search   = cleanText(req.query.search, 200);
  const params = [];
  const where  = [];
  if (category && category !== 'All') {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length} OR content ILIKE $${params.length})`);
  }
  const result = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM documents ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC LIMIT 500`,
    params
  );
  res.json({ documents: result.rows });
}

export async function uploadDocument(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { originalname, mimetype, buffer, size } = req.file;
  const name        = cleanText(req.body.name || originalname, 255) || 'Untitled';
  const category    = cleanText(req.body.category || 'General', 100);
  const description = cleanText(req.body.description, 2000);
  const content     = await extractText(buffer, mimetype);

  let cloudinaryPublicId = null, cloudinaryUrl = null, filePath = null;
  if (cloudinaryEnabled()) {
    const uploaded = await uploadBuffer(buffer, { filename: originalname, mimetype });
    cloudinaryPublicId = uploaded.publicId;
    cloudinaryUrl      = uploaded.url;
  } else {
    // Generated filename — never trust the uploaded name on disk
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    filePath = `${crypto.randomUUID()}${ALLOWED_MIMETYPES[mimetype]}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filePath), buffer);
  }

  const result = await db.query(
    `INSERT INTO documents (name, category, description, cloudinary_public_id, cloudinary_url, file_path, mimetype, size, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${PUBLIC_COLUMNS}`,
    [name, category, description, cloudinaryPublicId, cloudinaryUrl, filePath, mimetype, size, content]
  );
  if (content) await indexDocument({ ...result.rows[0], content });
  res.status(201).json({ success: true, document: result.rows[0], searchable: content.length > 0 });
}

export async function updateDocument(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid document id' });
  const fields = {};
  if (req.body.name !== undefined)        fields.name        = cleanText(req.body.name, 255);
  if (req.body.category !== undefined)    fields.category    = cleanText(req.body.category, 100);
  if (req.body.description !== undefined) fields.description = cleanText(req.body.description, 2000);
  const keys = Object.keys(fields);
  if (keys.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const result = await db.query(
    `UPDATE documents SET ${sets}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING ${PUBLIC_COLUMNS}`,
    [...keys.map(k => fields[k]), req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
  // Name, category and description are searched too, so re-index
  const full = await db.query('SELECT id, name, category, description, content, created_at FROM documents WHERE id = $1', [req.params.id]);
  if (full.rows[0]?.content) await indexDocument(full.rows[0]);
  res.json({ success: true, document: result.rows[0] });
}

export async function deleteDocument(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid document id' });
  const result = await db.query(
    'DELETE FROM documents WHERE id = $1 RETURNING cloudinary_public_id, file_path, mimetype',
    [req.params.id]
  );
  const doc = result.rows[0];
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  await removeFromIndex('document', req.params.id);

  try {
    if (doc.cloudinary_public_id) await deleteFile(doc.cloudinary_public_id, doc.mimetype);
    if (doc.file_path) await fs.unlink(path.join(UPLOAD_DIR, path.basename(doc.file_path)));
  } catch (err) {
    console.warn('[Documents] Stored file could not be removed:', err.message);
  }
  res.json({ success: true });
}

export async function downloadDocument(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid document id' });
  const result = await db.query(
    'SELECT name, cloudinary_url, file_path, mimetype FROM documents WHERE id = $1',
    [req.params.id]
  );
  const doc = result.rows[0];
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.cloudinary_url) return res.redirect(doc.cloudinary_url);
  if (!doc.file_path) return res.status(404).json({ error: 'File not available' });

  // Download name keeps the stored extension so the file opens correctly
  const ext = path.extname(doc.file_path);
  const downloadName = doc.name.toLowerCase().endsWith(ext) ? doc.name : doc.name + ext;
  res.download(path.join(UPLOAD_DIR, path.basename(doc.file_path)), downloadName, err => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not available' });
  });
}
