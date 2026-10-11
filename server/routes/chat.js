import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { handleChat } from '../controllers/chatController.js';

const router = Router();

// Guests can chat; signed-in users are identified for chat logs
router.post('/', optionalAuth, handleChat);

export default router;
