import { Router } from 'express';
import { requireAdmin, requireStaffOrAdmin } from '../middleware/auth.js';
import {
  getStats,
  getChatLogs,
  getTopQuestions,
  getKnowledgeBase,
  addKBEntry,
  deleteKBEntry,
  getSettings,
  saveSettings,
  getInbox,
  resolveInboxItem,
  getAnalytics,
} from '../controllers/adminController.js';

const router = Router();

// Staff panel: knowledge base management
router.get('/knowledge-base',        requireStaffOrAdmin, getKnowledgeBase);
router.post('/knowledge-base',       requireStaffOrAdmin, addKBEntry);
router.delete('/knowledge-base/:id', requireStaffOrAdmin, deleteKBEntry);

// Staff panel: unanswered / unhelpful questions inbox
router.get('/inbox',          requireStaffOrAdmin, getInbox);
router.post('/inbox/resolve', requireStaffOrAdmin, resolveInboxItem);

// Admin only
router.get('/stats',         requireAdmin, getStats);
router.get('/logs',          requireAdmin, getChatLogs);
router.get('/top-questions', requireAdmin, getTopQuestions);
router.get('/analytics',     requireAdmin, getAnalytics);
router.get('/settings',      requireAdmin, getSettings);
router.post('/settings',     requireAdmin, saveSettings);  // ← persists to DB

export default router;
