import crypto from 'node:crypto';
import path from 'node:path';

import multer from 'multer';

import { env } from '../config/env';
import { AppError } from './app-error';
import { storageDirectories } from './storage';

export const audioMimeTypes = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
  'audio/aac',
  'audio/flac'
]);

export const documentMimeTypes = new Set([
  ...audioMimeTypes,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp'
]);

export const profileImageMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp'
]);

const destinationByTarget = {
  audio: storageDirectories.audio,
  documents: storageDirectories.documents,
  attachments: storageDirectories.attachments,
  avatars: storageDirectories.avatars
} as const;

type UploadTarget = keyof typeof destinationByTarget;

export const createUploader = (target: UploadTarget, allowedMimeTypes: Set<string>) => {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        callback(null, destinationByTarget[target]);
      },
      filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname) || '.bin';
        callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
      }
    }),
    limits: {
      fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(new AppError(400, `Tipo de arquivo não suportado: ${file.mimetype}`));
        return;
      }

      callback(null, true);
    }
  });
};

export const toRelativeStoragePath = (
  target: UploadTarget,
  fileName: string
): string => `${target}/${fileName}`;
