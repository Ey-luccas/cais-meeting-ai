import crypto from 'node:crypto';
import path from 'node:path';

import multer from 'multer';

import { env } from '../config/env';
import { AppError } from './app-error';
import { uploadDirAbsolutePath } from './file-storage';

const allowedMimeTypes = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg'
]);

export const uploadAudio = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, uploadDirAbsolutePath);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname) || '.audio';
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
  }),
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, 'Formato de áudio não suportado.'));
      return;
    }

    callback(null, true);
  }
});
