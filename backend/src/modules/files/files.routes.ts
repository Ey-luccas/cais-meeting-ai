import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { createUploader, documentMimeTypes } from '../../shared/upload';
import { filesController } from './files.controller';

const filesUpload = createUploader('documents', documentMimeTypes);

export const filesRouter = Router();

filesRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

filesRouter.get('/projects/:id/files', asyncHandler((req, res) => filesController.list(req, res)));
filesRouter.post(
  '/projects/:id/files',
  filesUpload.single('file'),
  asyncHandler((req, res) => filesController.upload(req, res))
);
filesRouter.delete(
  '/projects/:id/files/:fileId',
  asyncHandler((req, res) => filesController.remove(req, res))
);
