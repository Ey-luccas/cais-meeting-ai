import type { Request, Response } from 'express';
import { ProjectRole as PrismaProjectRole } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { projectsService } from './projects.service';

const projectIdParamsSchema = z.object({
  id: z.string().uuid('ID de projeto inválido.')
});

const projectMemberParamsSchema = z.object({
  id: z.string().uuid('ID de projeto inválido.'),
  memberId: z.string().uuid('ID de membro de projeto inválido.')
});

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  color: z.string().trim().regex(/^#([A-Fa-f0-9]{6})$/, 'Cor inválida no formato HEX.').optional()
});

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    color: z
      .string()
      .trim()
      .regex(/^#([A-Fa-f0-9]{6})$/, 'Cor inválida no formato HEX.')
      .nullable()
      .optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualização.'
  });

const createProjectMemberSchema = z.object({
  organizationMemberId: z.string().uuid('ID de membro da organização inválido.'),
  role: z.nativeEnum(PrismaProjectRole).optional()
});

const updateProjectMemberSchema = z.object({
  role: z.nativeEnum(PrismaProjectRole)
});

export class ProjectsController {
  async list(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const projects = await projectsService.listProjects(req.auth.organizationId);

    res.json({ projects });
  }

  async create(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const parsed = createProjectSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, 'Payload inválido para criação de projeto.', parsed.error.flatten());
    }

    const project = await projectsService.createProject({
      organizationId: req.auth.organizationId,
      createdByUserId: req.auth.userId,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color
    });

    res.status(201).json(project);
  }

  async getById(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'ID de projeto inválido.', params.error.flatten());
    }

    const project = await projectsService.getProjectById(req.auth.organizationId, params.data.id);

    res.json(project);
  }

  async update(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'ID de projeto inválido.', params.error.flatten());
    }

    const payload = updateProjectSchema.safeParse(req.body);

    if (!payload.success) {
      throw new AppError(400, 'Payload inválido para atualização de projeto.', payload.error.flatten());
    }

    const project = await projectsService.updateProject({
      organizationId: req.auth.organizationId,
      projectId: params.data.id,
      name: payload.data.name,
      description: payload.data.description,
      color: payload.data.color
    });

    res.json(project);
  }

  async remove(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'ID de projeto inválido.', params.error.flatten());
    }

    await projectsService.deleteProject(req.auth.organizationId, params.data.id);

    res.status(204).send();
  }

  async listMembers(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'ID de projeto inválido.', params.error.flatten());
    }

    const members = await projectsService.listProjectMembers({
      organizationId: req.auth.organizationId,
      projectId: params.data.id
    });

    res.json({ members });
  }

  async addMember(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'ID de projeto inválido.', params.error.flatten());
    }

    const body = createProjectMemberSchema.safeParse(req.body);

    if (!body.success) {
      throw new AppError(400, 'Payload inválido para adicionar membro ao projeto.', body.error.flatten());
    }

    const member = await projectsService.addProjectMember({
      organizationId: req.auth.organizationId,
      projectId: params.data.id,
      actorUserId: req.auth.userId,
      actorOrganizationRole: req.auth.role,
      organizationMemberId: body.data.organizationMemberId,
      role: body.data.role ?? PrismaProjectRole.MEMBER
    });

    res.status(201).json(member);
  }

  async updateMemberRole(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectMemberParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos.', params.error.flatten());
    }

    const body = updateProjectMemberSchema.safeParse(req.body);

    if (!body.success) {
      throw new AppError(400, 'Payload inválido para atualização de papel.', body.error.flatten());
    }

    const member = await projectsService.updateProjectMemberRole({
      organizationId: req.auth.organizationId,
      projectId: params.data.id,
      memberId: params.data.memberId,
      actorUserId: req.auth.userId,
      actorOrganizationRole: req.auth.role,
      role: body.data.role
    });

    res.json(member);
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectMemberParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos.', params.error.flatten());
    }

    await projectsService.removeProjectMember({
      organizationId: req.auth.organizationId,
      projectId: params.data.id,
      memberId: params.data.memberId,
      actorUserId: req.auth.userId,
      actorOrganizationRole: req.auth.role
    });

    res.status(204).send();
  }
}

export const projectsController = new ProjectsController();
