import type { OrganizationRole } from '@prisma/client';
import type { CookieOptions, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { AppError } from './app-error';

export type AuthTokenPayload = {
  userId: string;
  organizationId: string;
  memberId: string;
  role: OrganizationRole;
};

const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: env.AUTH_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
};

const isValidRole = (role: unknown): role is OrganizationRole => {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER';
};

export const getAuthCookieName = (): string => env.AUTH_COOKIE_NAME;

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(getAuthCookieName(), token, authCookieOptions);
};

export const clearAuthCookie = (res: Response): void => {
  res.clearCookie(getAuthCookieName(), authCookieOptions);
};

export const hashPassword = async (value: string): Promise<string> => {
  return bcrypt.hash(value, 12);
};

export const verifyPassword = async (value: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(value, hash);
};

export const signAuthToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!decoded || typeof decoded !== 'object') {
      throw new AppError(401, 'Token inválido.');
    }

    const payload = decoded as Partial<AuthTokenPayload>;

    if (!payload.userId || !payload.organizationId || !payload.memberId || !isValidRole(payload.role)) {
      throw new AppError(401, 'Token inválido.');
    }

    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      memberId: payload.memberId,
      role: payload.role
    };
  } catch {
    throw new AppError(401, 'Não autorizado.');
  }
};
