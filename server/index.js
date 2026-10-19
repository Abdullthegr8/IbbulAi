import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import chatRoutes     from './routes/chat.js';
import documentRoutes from './routes/documents.js';
import authRoutes     from './routes/auth.js';
import userAuthRoutes from './routes/userAuth.js';
import adminRoutes    from './routes/admin.js';
import conversationRoutes from './routes/conversations.js';
import announcementRoutes from './routes/announcements.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initDB } from './database/init.js';
import { loadConfig } from './services/configService.js';
import { activeModel } from './providers/llm.js';
import { rebuildIndex, ensureIndex, backfillEmbeddings } from './services/kbIndex.js';

const app  = express();
const PORT = process.env.PORT || 5000;
const ON_VERCEL = Boolean(process.env.VERCEL);

// ── Refuse to run in production with placeholder secrets ──────────
if (process.env.NODE_ENV === 'production') {
  const weak = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('change_this'))
    weak.push('JWT_SECRET (use 32+ random characters)');
  if (!process.env.ADMIN_PASSWORD || ['admin123', 'change_me'].includes(process.env.ADMIN_PASSWORD) || process.env.ADMIN_PASSWORD.length < 12)
    weak.push('ADMIN_PASSWORD (use 12+ characters)');
  if (weak.length) {
    console.error(`\n❌ Insecure configuration — set these in server/.env:\n   - ${weak.join('\n   - ')}\n`);
    process.exit(1);
  }
} else if (!process.env.JWT_SECRET) {
  // Dev convenience: tokens stop working when the server restarts
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('[Auth] JWT_SECRET not set — using a temporary random secret (development only)');
}

// ── Security ──────────────────────────────────────────────────────
// Vercel's proxy sets X-Forwarded-For; trust it so rate limits see the real client IP
if (ON_VERCEL) app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use('/api/chat', rateLimit({ windowMs: 60 * 1000, max: 30 }));
// Slow down password guessing on login endpoints
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth/login', loginLimiter);
app.use('/api/user/login', loginLimiter);

// ── Middleware ────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' })); // file uploads use multipart, not JSON
app.use(express.urlencoded({ extended: true }));

// Every request waits for startup (DB tables, settings, search index) to finish
app.use(async (req, res, next) => {
  try { await init(); next(); } catch (err) { next(err); }
});

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/user',      userAuthRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/announcements', announcementRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    app:       'IbbulAI',
    provider:  'groq',
    model:     activeModel(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────
// Runs once per process. On Vercel each instance starts cold, so the full
// index rebuild only runs when the built-in entries have changed.
let _init;
function init() {
  _init ??= (async () => {
    await initDB();
    await loadConfig(); // Load settings from system_config table into memory
    await (ON_VERCEL ? ensureIndex() : rebuildIndex()); // Knowledge base search index (kb_chunks)
    await backfillEmbeddings(); // semantic search vectors for any passages still without one
  })().catch(err => { _init = null; throw err; });
  return _init;
}

// Vercel imports the app from api/index.js and handles requests itself
export default app;

if (!ON_VERCEL) {
  init().then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 IbbulAI server running on port ${PORT}`);
      console.log(`   LLM  : ${activeModel()}`);
      console.log(`   Env  : ${process.env.NODE_ENV || 'development'}\n`);
    });
  }).catch(err => {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  });
}
