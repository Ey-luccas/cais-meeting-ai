import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { audioMimeTypes, createUploader } from '../../shared/upload';
import { meetingsController } from './meetings.controller';

const audioUpload = createUploader('audio', audioMimeTypes);

export const meetingsRouter = Router();

meetingsRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

meetingsRouter.post(
  '/projects/:id/meetings',
  audioUpload.single('audio'),
  asyncHandler((req, res) => meetingsController.create(req, res))
);

meetingsRouter.get(
  '/projects/:id/meetings',
  asyncHandler((req, res) => meetingsController.listByProject(req, res))
);

meetingsRouter.get(
  '/meetings/:meetingId',
  asyncHandler((req, res) => meetingsController.getById(req, res))
);

meetingsRouter.delete(
  '/meetings/:meetingId',
  asyncHandler((req, res) => meetingsController.remove(req, res))
);

meetingsRouter.post(
  '/meetings/:meetingId/upload',
  audioUpload.single('audio'),
  asyncHandler((req, res) => meetingsController.upload(req, res))
);

meetingsRouter.post(
  '/meetings/:meetingId/observations',
  asyncHandler((req, res) => meetingsController.createObservation(req, res))
);

meetingsRouter.post(
  '/meetings/:meetingId/process',
  asyncHandler((req, res) => meetingsController.process(req, res))
);
