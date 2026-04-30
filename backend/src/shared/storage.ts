import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

export const storageDirectories = {
  root: uploadRoot,
  audio: path.join(uploadRoot, 'audio'),
  documents: path.join(uploadRoot, 'documents'),
  attachments: path.join(uploadRoot, 'attachments'),
  avatars: path.join(uploadRoot, 'avatars')
} as const;

export const ensureStorageDirectories = async (): Promise<void> => {
  await Promise.all(
    Object.values(storageDirectories).map((directoryPath) =>
      mkdir(directoryPath, { recursive: true })
    )
  );
};

export const resolveStoredFilePath = (relativePath: string): string => {
  return path.join(storageDirectories.root, relativePath);
};

export const toPublicFileUrl = (baseUrl: string, relativePath: string): string => {
  const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${baseUrl.replace(/\/$/, '')}/uploads/${normalizedPath}`;
};
