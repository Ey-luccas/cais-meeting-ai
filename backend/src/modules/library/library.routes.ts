import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { createUploader, documentMimeTypes } from '../../shared/upload';
import { libraryController } from './library.controller';

const libraryUpload = createUploader('documents', documentMimeTypes);

export const libraryRouter = Router();

libraryRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

libraryRouter.get('/projects/:projectId/library', asyncHandler((req, res) => libraryController.listItems(req, res)));

libraryRouter.get(
  '/projects/:projectId/library/folders',
  asyncHandler((req, res) => libraryController.listFolders(req, res))
);
libraryRouter.post(
  '/projects/:projectId/library/folders',
  asyncHandler((req, res) => libraryController.createFolder(req, res))
);
libraryRouter.patch(
  '/projects/:projectId/library/folders/:folderId',
  asyncHandler((req, res) => libraryController.updateFolder(req, res))
);
libraryRouter.delete(
  '/projects/:projectId/library/folders/:folderId',
  asyncHandler((req, res) => libraryController.deleteFolder(req, res))
);

libraryRouter.get('/projects/:projectId/library/tags', asyncHandler((req, res) => libraryController.listTags(req, res)));
libraryRouter.post('/projects/:projectId/library/tags', asyncHandler((req, res) => libraryController.createTag(req, res)));
libraryRouter.patch(
  '/projects/:projectId/library/tags/:tagId',
  asyncHandler((req, res) => libraryController.updateTag(req, res))
);
libraryRouter.delete(
  '/projects/:projectId/library/tags/:tagId',
  asyncHandler((req, res) => libraryController.deleteTag(req, res))
);

libraryRouter.post(
  '/projects/:projectId/library/documents',
  asyncHandler((req, res) => libraryController.createDocument(req, res))
);
libraryRouter.post(
  '/projects/:projectId/library/files',
  libraryUpload.single('file'),
  asyncHandler((req, res) => libraryController.createFile(req, res))
);

libraryRouter.get(
  '/projects/:projectId/library/items/:itemId',
  asyncHandler((req, res) => libraryController.getItem(req, res))
);
libraryRouter.patch(
  '/projects/:projectId/library/items/:itemId',
  asyncHandler((req, res) => libraryController.updateItem(req, res))
);
libraryRouter.patch(
  '/projects/:projectId/library/items/:itemId/archive',
  asyncHandler((req, res) => libraryController.archiveItem(req, res))
);
libraryRouter.delete(
  '/projects/:projectId/library/items/:itemId',
  asyncHandler((req, res) => libraryController.deleteItem(req, res))
);

libraryRouter.post(
  '/projects/:projectId/library/items/:itemId/tags/:tagId',
  asyncHandler((req, res) => libraryController.attachTagToItem(req, res))
);
libraryRouter.delete(
  '/projects/:projectId/library/items/:itemId/tags/:tagId',
  asyncHandler((req, res) => libraryController.detachTagFromItem(req, res))
);

libraryRouter.get(
  '/projects/:projectId/library/items/:itemId/export',
  asyncHandler((req, res) => libraryController.exportItem(req, res))
);

libraryRouter.post(
  '/projects/:projectId/meetings/:meetingId/library/generate-minutes',
  asyncHandler((req, res) => libraryController.generateMeetingMinutes(req, res))
);
