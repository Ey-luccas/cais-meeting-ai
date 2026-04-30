import { Router } from 'express';

import { OrganizationRole } from '@prisma/client';

import { requireAuth, requireRoles } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { organizationsController } from './organizations.controller';

export const organizationsRouter = Router();

organizationsRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

organizationsRouter.get(
  '/organization',
  asyncHandler((req, res) => organizationsController.getCurrent(req, res))
);
organizationsRouter.patch(
  '/organization',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.updateCurrent(req, res))
);
organizationsRouter.get(
  '/organization/members',
  asyncHandler((req, res) => organizationsController.listMembers(req, res))
);
organizationsRouter.post(
  '/organization/members',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.addMember(req, res))
);
organizationsRouter.patch(
  '/organization/members/:id',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.updateMemberRole(req, res))
);
organizationsRouter.delete(
  '/organization/members/:id',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.removeMember(req, res))
);

organizationsRouter.get(
  '/organizations/current',
  asyncHandler((req, res) => organizationsController.getCurrent(req, res))
);
organizationsRouter.patch(
  '/organizations/current',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.updateCurrent(req, res))
);
organizationsRouter.get(
  '/organizations/current/dashboard',
  asyncHandler((req, res) => organizationsController.getDashboard(req, res))
);
organizationsRouter.get(
  '/organizations/current/members',
  asyncHandler((req, res) => organizationsController.listMembers(req, res))
);
organizationsRouter.post(
  '/organizations/current/members',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.addMember(req, res))
);
organizationsRouter.patch(
  '/organizations/current/members/:memberId/role',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.updateMemberRole(req, res))
);
organizationsRouter.delete(
  '/organizations/current/members/:memberId',
  requireRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN),
  asyncHandler((req, res) => organizationsController.removeMember(req, res))
);
