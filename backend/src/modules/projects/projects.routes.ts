import { Router } from 'express';
import { OrganizationRole } from '@prisma/client';

import { requireAuth, requireRoles } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { projectsController } from './projects.controller';

export const projectsRouter = Router();

projectsRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

projectsRouter.get('/projects', asyncHandler((req, res) => projectsController.list(req, res)));
projectsRouter.post(
  '/projects',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER),
  asyncHandler((req, res) => projectsController.create(req, res))
);
projectsRouter.get('/projects/:id', asyncHandler((req, res) => projectsController.getById(req, res)));
projectsRouter.patch(
  '/projects/:id',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER),
  asyncHandler((req, res) => projectsController.update(req, res))
);
projectsRouter.delete(
  '/projects/:id',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => projectsController.remove(req, res))
);

projectsRouter.get(
  '/projects/:id/members',
  asyncHandler((req, res) => projectsController.listMembers(req, res))
);
projectsRouter.post(
  '/projects/:id/members',
  asyncHandler((req, res) => projectsController.addMember(req, res))
);
projectsRouter.patch(
  '/projects/:id/members/:memberId',
  asyncHandler((req, res) => projectsController.updateMemberRole(req, res))
);
projectsRouter.delete(
  '/projects/:id/members/:memberId',
  asyncHandler((req, res) => projectsController.removeMember(req, res))
);
