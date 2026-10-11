import bcrypt from 'bcryptjs';
import { db } from '../database/init.js';
import { signToken } from '../middleware/auth.js';

// IBBU matric number, e.g. U22/FNS/MCB/1000
export const MATRIC_RE = /^U\d{2}\/[A-Z]{2,5}\/[A-Z]{2,5}\/\d{3,5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when an account doesn't exist, so timing doesn't reveal valid accounts
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function staffDomain() {
  return (process.env.STAFF_EMAIL_DOMAIN || 'ibbu.edu.ng').toLowerCase();
}

function publicUser(row) {
  return { id: row.id, name: row.name, role: row.role, identifier: row.identifier };
}

function issue(res, row, status = 200) {
  const user = publicUser(row);
  const token = signToken({ sub: user.id, role: user.role, name: user.name, identifier: user.identifier });
  res.status(status).json({ token, user });
}

function normalizeIdentifier(role, identifier) {
  const raw = String(identifier ?? '').trim();
  return role === 'student' ? raw.toUpperCase() : raw.toLowerCase();
}

export async function register(req, res) {
  const { name, password } = req.body || {};
  const role = req.body?.role === 'staff' ? 'staff' : 'student';
  const identifier = normalizeIdentifier(role, req.body?.identifier);
  const cleanName = String(name ?? '').trim().slice(0, 100);

  if (cleanName.length < 2) return res.status(400).json({ error: 'Please enter your full name' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (password.length > 72) return res.status(400).json({ error: 'Password must be at most 72 characters' });

  if (role === 'student' && !MATRIC_RE.test(identifier)) {
    return res.status(400).json({ error: 'Enter a valid matric number, e.g. U22/FNS/MCB/1000' });
  }
  if (role === 'staff') {
    if (!EMAIL_RE.test(identifier)) return res.status(400).json({ error: 'Enter a valid work email address' });
    // Staff can manage documents and the knowledge base, so restrict to the university domain
    if (!identifier.endsWith('@' + staffDomain())) {
      return res.status(400).json({ error: `Staff must register with an @${staffDomain()} email address` });
    }
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await db.query(
      `INSERT INTO users (identifier, name, role, password_hash, last_login)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id, identifier, name, role`,
      [identifier, cleanName, role, hash]
    );
    issue(res, result.rows[0], 201);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this ' + (role === 'student' ? 'matric number' : 'email') + ' already exists' });
    }
    throw err;
  }
}

export async function login(req, res) {
  const { password } = req.body || {};
  const role = req.body?.role === 'staff' ? 'staff' : 'student';
  const identifier = normalizeIdentifier(role, req.body?.identifier);
  if (!identifier || typeof password !== 'string') {
    return res.status(400).json({ error: 'Identifier and password are required' });
  }

  const result = await db.query(
    'SELECT id, identifier, name, role, password_hash FROM users WHERE identifier = $1 AND role = $2',
    [identifier, role]
  );
  const row = result.rows[0];
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    return res.status(401).json({ error: 'Invalid ' + (role === 'student' ? 'matric number' : 'email') + ' or password' });
  }

  await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [row.id]);
  issue(res, row);
}

export async function me(req, res) {
  if (req.user.role === 'admin') {
    return res.json({ user: { id: req.user.id, name: req.user.name, role: 'admin', identifier: req.user.identifier } });
  }
  const result = await db.query('SELECT id, identifier, name, role FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows[0]) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: publicUser(result.rows[0]) });
}
