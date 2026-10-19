import { Router } from 'express';
import { requireStaffOrAdmin } from '../middleware/auth.js';
import {
  listActiveAnnouncements,
  listAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';

const router = Router();

// Public: current announcements
router.get('/', listActiveAnnouncements);

// Staff and admin manage announcements
router.get('/all',    requireStaffOrAdmin, listAllAnnouncements);
router.post('/',      requireStaffOrAdmin, createAnnouncement);
router.patch('/:id',  requireStaffOrAdmin, updateAnnouncement);
router.delete('/:id', requireStaffOrAdmin, deleteAnnouncement);

export default router;
