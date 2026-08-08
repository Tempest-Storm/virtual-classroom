import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const UPLOAD_DIR = path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/zip', 'video/mp4', 'video/webm',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^\w.\-]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported file type: ${file.mimetype}`)),
});

export { UPLOAD_DIR };
