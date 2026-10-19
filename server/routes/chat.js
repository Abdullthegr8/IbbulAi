import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { handleChat, handleChatStream, handleFeedback } from '../controllers/chatController.js';

const router = Router();

// Guests can chat; signed-in users are identified for chat logs and saved conversations
router.post('/',         optionalAuth, handleChat);
router.post('/stream',   optionalAuth, handleChatStream);
router.post('/feedback', handleFeedback);

export default router;
