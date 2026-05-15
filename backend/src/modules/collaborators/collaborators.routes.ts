import { Router } from 'express';
import { OrganizationRole } from '@prisma/client';

import { requireAuth, requireRoles } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { collaboratorsController } from './collaborators.controller';

export const collaboratorsRouter = Router();

collaboratorsRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

collaboratorsRouter.get(
  '/collaborators/invitations',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => collaboratorsController.listPendingInvitations(req, res))
);

collaboratorsRouter.post(
  '/collaborators/invite',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => collaboratorsController.invite(req, res))
);
