import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listConversations,
  getConversation,
  deleteConversation,
} from '../controllers/conversationController.js';

const router = Router();

// A user's own saved conversations
router.get('/',       requireAuth, listConversations);
router.get('/:id',    requireAuth, getConversation);
router.delete('/:id', requireAuth, deleteConversation);

export default router;
