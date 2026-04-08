import { access, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';

export const uploadDirAbsolutePath = path.resolve(process.cwd(), env.UPLOAD_DIR);

export const ensureUploadDir = async (): Promise<void> => {
  await mkdir(uploadDirAbsolutePath, { recursive: true });
};

export const resolveAudioFilePath = (fileName: string): string => {
  return path.join(uploadDirAbsolutePath, path.basename(fileName));
};

export const publicAudioUrl = (fileName: string | null, baseUrl: string): string | null => {
  if (!fileName) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, '')}/uploads/${path.basename(fileName)}`;
};

export const fileExists = async (fileName: string): Promise<boolean> => {
  try {
    await access(resolveAudioFilePath(fileName));
    return true;
  } catch {
    return false;
  }
};

export const deleteFileIfExists = async (fileName: string): Promise<void> => {
  const targetPath = resolveAudioFilePath(fileName);

  try {
    await unlink(targetPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw error;
    }
  }
};
