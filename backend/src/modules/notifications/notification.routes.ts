import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { notificationController } from './notification.controller';

export const notificationRouter = Router();

notificationRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

notificationRouter.get('/notifications', asyncHandler((req, res) => notificationController.list(req, res)));
notificationRouter.get(
  '/notifications/unread-count',
  asyncHandler((req, res) => notificationController.unreadCount(req, res))
);
notificationRouter.patch(
  '/notifications/read-all',
  asyncHandler((req, res) => notificationController.markAllAsRead(req, res))
);
notificationRouter.patch(
  '/notifications/:id/read',
  asyncHandler((req, res) => notificationController.markAsRead(req, res))
);
notificationRouter.delete('/notifications/:id', asyncHandler((req, res) => notificationController.remove(req, res)));
