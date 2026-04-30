import { Router } from 'express';

import { authRouter } from './modules/auth/auth.routes';
import { aiSearchRouter } from './modules/ai-search/ai-search.routes';
import { boardRouter } from './modules/board/board.routes';
import { filesRouter } from './modules/files/files.routes';
import { healthRouter } from './modules/health.routes';
import { libraryRouter } from './modules/library/library.routes';
import { meetingsRouter } from './modules/meetings/meetings.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { organizationsRouter } from './modules/organizations/organizations.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { reportsRouter } from './modules/reports/reports.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(aiSearchRouter);
apiRouter.use(organizationsRouter);
apiRouter.use(projectsRouter);
apiRouter.use(boardRouter);
apiRouter.use(filesRouter);
apiRouter.use(libraryRouter);
apiRouter.use(reportsRouter);
apiRouter.use(meetingsRouter);
apiRouter.use(notificationRouter);
