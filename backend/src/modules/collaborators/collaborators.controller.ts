import type { Request, Response } from 'express';
import { OrganizationRole } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { collaboratorsService } from './collaborators.service';

const inviteCollaboratorSchema = z.object({
  email: z.string().trim().email(),
  role: z.nativeEnum(OrganizationRole),
  projectIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um projeto.')
});

export class CollaboratorsController {
  async invite(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const parsed = inviteCollaboratorSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, 'Payload inválido para convite de colaborador.', parsed.error.flatten());
    }

    const result = await collaboratorsService.invite({
      organizationId: req.auth.organizationId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      email: parsed.data.email,
      role: parsed.data.role,
      projectIds: parsed.data.projectIds
    });

    res.status(201).json(result);
  }

  async listPendingInvitations(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const invitations = await collaboratorsService.listPendingInvitations({
      organizationId: req.auth.organizationId,
      actorRole: req.auth.role
    });

    res.json({ invitations });
  }
}

export const collaboratorsController = new CollaboratorsController();
