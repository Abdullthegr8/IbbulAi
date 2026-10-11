import { Router } from 'express';
import { requireStaffOrAdmin } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
  listDocuments,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
} from '../controllers/documentController.js';

const router = Router();

// Public: browse and download official documents (download links are plain <a> tags, so no auth header)
router.get('/',             listDocuments);
router.get('/:id/download', downloadDocument);

// Staff and admin manage documents
router.post('/',      requireStaffOrAdmin, uploadSingle, uploadDocument);
router.patch('/:id',  requireStaffOrAdmin, updateDocument);
router.delete('/:id', requireStaffOrAdmin, deleteDocument);

export default router;
