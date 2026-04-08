import { Router } from 'express';

import { meetingsController } from '../controllers';
import { asyncHandler, uploadAudio } from '../utils';

export const meetingsRouter = Router();

meetingsRouter.post(
  '/meetings',
  asyncHandler(async (req, res) => meetingsController.createMeeting(req, res))
);

meetingsRouter.get(
  '/meetings',
  asyncHandler(async (req, res) => meetingsController.listMeetings(req, res))
);

meetingsRouter.get(
  '/meetings/:id',
  asyncHandler(async (req, res) => meetingsController.getMeetingById(req, res))
);

meetingsRouter.delete(
  '/meetings/:id',
  asyncHandler(async (req, res) => meetingsController.deleteMeeting(req, res))
);

meetingsRouter.post(
  '/meetings/:id/upload',
  uploadAudio.single('audio'),
  asyncHandler(async (req, res) => meetingsController.uploadMeetingAudio(req, res))
);

meetingsRouter.post(
  '/meetings/:id/transcribe',
  asyncHandler(async (req, res) => meetingsController.transcribeMeeting(req, res))
);

meetingsRouter.post(
  '/meetings/:id/generate-notes',
  asyncHandler(async (req, res) => meetingsController.generateMeetingNotes(req, res))
);

meetingsRouter.post(
  '/meetings/:id/process',
  asyncHandler(async (req, res) => meetingsController.processMeeting(req, res))
);
