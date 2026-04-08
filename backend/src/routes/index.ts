import { Router } from 'express';

import { healthRouter } from './health.routes';
import { meetingsRouter } from './meetings.routes';

export const appRouter = Router();

appRouter.use(healthRouter);
appRouter.use(meetingsRouter);
