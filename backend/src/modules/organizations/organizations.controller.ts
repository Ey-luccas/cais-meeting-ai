import type { Request, Response } from 'express';
import { OrganizationRole } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { organizationsService } from './organizations.service';

const memberAnyIdParamsSchema = z
  .object({
    memberId: z.string().uuid('ID de membro inválido.').optional(),
    id: z.string().uuid('ID de membro inválido.').optional()
  })
  .refine((payload) => Boolean(payload.memberId ?? payload.id), {
    message: 'ID de membro inválido.'
  });

const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(48)
      .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen.')
      .optional(),
    email: z.string().trim().email().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualização.'
  });

const createMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72).optional(),
  role: z.nativeEnum(OrganizationRole).optional()
});

const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(OrganizationRole)
});

const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional()
});

export class OrganizationsController {
  async getCurrent(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const organization = await organizationsService.getCurrentOrganization(req.auth.organizationId);

    res.json(organization);
  }

  async getDashboard(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const query = dashboardQuerySchema.safeParse(req.query);

    if (!query.success) {
      throw new AppError(400, 'Parâmetros inválidos para dashboard.', query.error.flatten());
    }

    const dashboard = await organizationsService.getOrganizationDashboard({
      organizationId: req.auth.organizationId,
      days: query.data.days ?? 30
    });

    res.json(dashboard);
  }

  async updateCurrent(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const payload = updateOrganizationSchema.safeParse(req.body);

    if (!payload.success) {
      throw new AppError(400, 'Payload inválido para atualização da organização.', payload.error.flatten());
    }

    const organization = await organizationsService.updateCurrentOrganization({
      organizationId: req.auth.organizationId,
      actorRole: req.auth.role,
      name: payload.data.name,
      slug: payload.data.slug,
      email: payload.data.email
    });

    res.json(organization);
  }

  async listMembers(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const members = await organizationsService.listMembers(req.auth.organizationId);

    res.json({ members });
  }

  async addMember(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const parsed = createMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, 'Payload inválido para novo membro.', parsed.error.flatten());
    }

    const targetRole = parsed.data.role ?? OrganizationRole.MEMBER;

    const member = await organizationsService.addMember({
      organizationId: req.auth.organizationId,
      actorRole: req.auth.role,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
      role: targetRole
    });

    res.status(201).json(member);
  }

  async updateMemberRole(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const paramsParsed = memberAnyIdParamsSchema.safeParse(req.params);

    if (!paramsParsed.success) {
      throw new AppError(400, 'Parâmetros inválidos.', paramsParsed.error.flatten());
    }

    const bodyParsed = updateMemberRoleSchema.safeParse(req.body);

    if (!bodyParsed.success) {
      throw new AppError(400, 'Payload inválido para atualização de papel.', bodyParsed.error.flatten());
    }

    const member = await organizationsService.updateMemberRole({
      organizationId: req.auth.organizationId,
      actorRole: req.auth.role,
      actorMemberId: req.auth.memberId,
      memberId: paramsParsed.data.memberId ?? paramsParsed.data.id!,
      role: bodyParsed.data.role
    });

    res.json(member);
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const paramsParsed = memberAnyIdParamsSchema.safeParse(req.params);

    if (!paramsParsed.success) {
      throw new AppError(400, 'Parâmetros inválidos.', paramsParsed.error.flatten());
    }

    await organizationsService.removeMember({
      organizationId: req.auth.organizationId,
      actorRole: req.auth.role,
      actorMemberId: req.auth.memberId,
      memberId: paramsParsed.data.memberId ?? paramsParsed.data.id!
    });

    res.status(204).send();
  }
}

export const organizationsController = new OrganizationsController();
