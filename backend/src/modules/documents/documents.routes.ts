import { Router } from 'express';
import { MemberRole } from '@prisma/client';

import { requireAuth, requireRoles } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { createUploader, documentMimeTypes } from '../../shared/upload';
import { documentsController } from './documents.controller';

const documentsUpload = createUploader('documents', documentMimeTypes);

export const documentsRouter = Router();
const writeRoles = [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER] as const;

documentsRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

documentsRouter.get(
  '/projects/:projectId/documents',
  asyncHandler((req, res) => documentsController.list(req, res))
);
documentsRouter.post(
  '/projects/:projectId/documents',
  requireRoles(...writeRoles),
  documentsUpload.single('file'),
  asyncHandler((req, res) => documentsController.upload(req, res))
);
