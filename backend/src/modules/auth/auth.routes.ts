import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { createUploader, profileImageMimeTypes } from '../../shared/upload';
import { authController } from './auth.controller';

export const authRouter = Router();
const profileUpload = createUploader('avatars', profileImageMimeTypes);

authRouter.post('/auth/register', asyncHandler((req, res) => authController.register(req, res)));
authRouter.post('/auth/login', asyncHandler((req, res) => authController.login(req, res)));
authRouter.get(
  '/auth/me',
  asyncHandler(async (req, res, next) => requireAuth(req, res, next)),
  asyncHandler((req, res) => authController.getSession(req, res))
);
authRouter.get(
  '/auth/session',
  asyncHandler(async (req, res, next) => requireAuth(req, res, next)),
  asyncHandler((req, res) => authController.getSession(req, res))
);
authRouter.patch(
  '/auth/profile',
  asyncHandler(async (req, res, next) => requireAuth(req, res, next)),
  profileUpload.single('avatar'),
  asyncHandler((req, res) => authController.updateProfile(req, res))
);
authRouter.post('/auth/logout', asyncHandler((req, res) => authController.logout(req, res)));
