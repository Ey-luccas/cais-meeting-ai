import type { OrganizationRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../config/prisma';
import { AppError } from '../shared/app-error';
import { getAuthCookieName, verifyAuthToken } from '../shared/security';

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.length > 0)
    .reduce<Record<string, string>>((accumulator, pair) => {
      const separatorIndex = pair.indexOf('=');

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = pair.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(pair.slice(separatorIndex + 1));

      if (key) {
        accumulator[key] = value;
      }

      return accumulator;
    }, {});
};

const getTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[getAuthCookieName()] ?? null;
};

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = getTokenFromRequest(req);

  if (!token) {
    throw new AppError(401, 'Token de autenticação não informado.');
  }

  const payload = verifyAuthToken(token);

  const member = await prisma.organizationMember.findFirst({
    where: {
      id: payload.memberId,
      organizationId: payload.organizationId,
      userId: payload.userId
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
      userId: true
    }
  });

  if (!member) {
    throw new AppError(401, 'Sessão inválida para esta organização.');
  }

  req.auth = {
    userId: member.userId,
    organizationId: member.organizationId,
    memberId: member.id,
    role: member.role
  };

  next();
};

export const requireRoles = (...allowedRoles: OrganizationRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    if (!allowedRoles.includes(req.auth.role)) {
      throw new AppError(403, 'Acesso negado para o perfil atual.');
    }

    next();
  };
};
