import { createHash, randomBytes } from 'node:crypto';

export const generateSecureToken = (size = 32): string => {
  return randomBytes(size).toString('hex');
};

export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};
