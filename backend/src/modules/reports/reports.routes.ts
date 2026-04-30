import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { reportsController } from './reports.controller';

export const reportsRouter = Router();

reportsRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

reportsRouter.get('/projects/:id/reports', asyncHandler((req, res) => reportsController.getProjectReport(req, res)));
