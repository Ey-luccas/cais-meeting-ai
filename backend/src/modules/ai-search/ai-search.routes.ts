import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { aiSearchController } from './ai-search.controller';

export const aiSearchRouter = Router();

aiSearchRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

aiSearchRouter.post('/ai-search/threads', asyncHandler((req, res) => aiSearchController.createThread(req, res)));
aiSearchRouter.get('/ai-search/threads', asyncHandler((req, res) => aiSearchController.listThreads(req, res)));
aiSearchRouter.get('/ai-search/threads/:id', asyncHandler((req, res) => aiSearchController.getThread(req, res)));
aiSearchRouter.post(
  '/ai-search/threads/:id/messages',
  asyncHandler((req, res) => aiSearchController.askInThread(req, res))
);
aiSearchRouter.patch(
  '/ai-search/threads/:id/archive',
  asyncHandler((req, res) => aiSearchController.archiveThread(req, res))
);
aiSearchRouter.delete('/ai-search/threads/:id', asyncHandler((req, res) => aiSearchController.deleteThread(req, res)));

aiSearchRouter.post('/ai-search/reindex', asyncHandler((req, res) => aiSearchController.reindexOrganization(req, res)));
aiSearchRouter.post(
  '/projects/:projectId/ai-search/reindex',
  asyncHandler((req, res) => aiSearchController.reindexProject(req, res))
);
aiSearchRouter.get('/ai-search/suggestions', asyncHandler((req, res) => aiSearchController.getSuggestions(req, res)));
