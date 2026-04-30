import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { getBaseUrl } from '../../shared/http';
import { clearAuthCookie, setAuthCookie } from '../../shared/security';
import { toPublicFileUrl } from '../../shared/storage';
import { toRelativeStoragePath } from '../../shared/upload';
import { authService } from './auth.service';

const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen.'),
  organizationEmail: z.string().trim().email().optional(),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email(),
  ownerPassword: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  organizationSlug: z.string().trim().min(2).max(48).optional()
});

const updateProfileSchema = z.object({
  phone: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const normalized = value.trim();
      return normalized.length === 0 ? null : normalized;
    },
    z.string().max(32).nullable().optional()
  ),
  removeAvatar: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const normalized = value.trim().toLowerCase();

      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false' || normalized.length === 0) {
        return false;
      }

      return value;
    },
    z.boolean().optional()
  )
});

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, 'Payload inválido para cadastro de organização.', parsed.error.flatten());
    }

    const session = await authService.registerOrganization(parsed.data);

    setAuthCookie(res, session.token);
    res.status(201).json(session);
  }

  async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, 'Payload inválido para login.', parsed.error.flatten());
    }

    const session = await authService.login(parsed.data);

    setAuthCookie(res, session.token);
    res.json(session);
  }

  async getSession(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const session = await authService.getSession(
      req.auth.userId,
      req.auth.organizationId,
      req.auth.memberId
    );

    setAuthCookie(res, session.token);
    res.json(session);
  }

  async logout(_req: Request, res: Response): Promise<void> {
    clearAuthCookie(res);
    res.status(204).send();
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const parsed = updateProfileSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      throw new AppError(400, 'Payload inválido para atualização de perfil.', parsed.error.flatten());
    }

    const avatarUrl = req.file
      ? toPublicFileUrl(
          getBaseUrl(req),
          toRelativeStoragePath('avatars', req.file.filename)
        )
      : undefined;

    const session = await authService.updateProfile({
      userId: req.auth.userId,
      organizationId: req.auth.organizationId,
      memberId: req.auth.memberId,
      phone: parsed.data.phone,
      avatarUrl,
      removeAvatar: parsed.data.removeAvatar
    });

    setAuthCookie(res, session.token);
    res.json(session);
  }
}

export const authController = new AuthController();
