import multer from 'multer';
import { getConfig } from '../services/configService.js';

export const ALLOWED_MIMETYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

/**
 * Single-file upload held in memory. The size limit is read per request so
 * the admin "Max Upload Size" setting applies without a restart.
 */
export function uploadSingle(req, res, next) {
  const maxMb = Number(getConfig('max_file_size_mb')) || 50;
  multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter(req, file, cb) {
      if (ALLOWED_MIMETYPES[file.mimetype]) return cb(null, true);
      const err = new Error('Unsupported file type. Upload PDF, DOCX, DOC, TXT, PNG or JPG.');
      err.status = 400;
      cb(err);
    },
  }).single('file')(req, res, next);
}
