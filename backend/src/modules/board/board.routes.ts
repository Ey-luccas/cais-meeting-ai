import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../shared/async-handler';
import { createUploader, documentMimeTypes } from '../../shared/upload';
import { boardController } from './board.controller';

const attachmentUpload = createUploader('attachments', documentMimeTypes);

export const boardRouter = Router();

boardRouter.use(asyncHandler(async (req, res, next) => requireAuth(req, res, next)));

boardRouter.get('/projects/:projectId/board', asyncHandler((req, res) => boardController.getBoard(req, res)));
boardRouter.post(
  '/projects/:projectId/board/columns',
  asyncHandler((req, res) => boardController.createColumn(req, res))
);
boardRouter.patch(
  '/projects/:projectId/board/columns/reorder',
  asyncHandler((req, res) => boardController.reorderColumns(req, res))
);
boardRouter.patch(
  '/projects/:projectId/board/columns/:columnId',
  asyncHandler((req, res) => boardController.updateColumn(req, res))
);
boardRouter.delete(
  '/projects/:projectId/board/columns/:columnId',
  asyncHandler((req, res) => boardController.removeColumn(req, res))
);
boardRouter.post('/projects/:projectId/board/cards', asyncHandler((req, res) => boardController.createCard(req, res)));
boardRouter.patch(
  '/projects/:projectId/board/cards/reorder',
  asyncHandler((req, res) => boardController.reorderCards(req, res))
);
boardRouter.patch(
  '/projects/:projectId/board/cards/:cardId',
  asyncHandler((req, res) => boardController.updateCard(req, res))
);
boardRouter.delete(
  '/projects/:projectId/board/cards/:cardId',
  asyncHandler((req, res) => boardController.removeCard(req, res))
);

boardRouter.post(
  '/projects/:projectId/board/cards/:cardId/checklists',
  asyncHandler((req, res) => boardController.addChecklist(req, res))
);
boardRouter.patch(
  '/projects/:projectId/board/checklists/:checklistId',
  asyncHandler((req, res) => boardController.updateChecklist(req, res))
);
boardRouter.delete(
  '/projects/:projectId/board/checklists/:checklistId',
  asyncHandler((req, res) => boardController.removeChecklist(req, res))
);
boardRouter.post(
  '/projects/:projectId/board/checklists/:checklistId/items',
  asyncHandler((req, res) => boardController.addChecklistItem(req, res))
);
boardRouter.patch(
  '/projects/:projectId/board/checklists/:checklistId/items/reorder',
  asyncHandler((req, res) => boardController.reorderChecklistItems(req, res))
);
boardRouter.patch(
  '/projects/:projectId/board/checklist-items/:itemId',
  asyncHandler((req, res) => boardController.updateChecklistItem(req, res))
);
boardRouter.delete(
  '/projects/:projectId/board/checklist-items/:itemId',
  asyncHandler((req, res) => boardController.removeChecklistItem(req, res))
);

boardRouter.post(
  '/projects/:projectId/board/cards/:cardId/comments',
  asyncHandler((req, res) => boardController.addComment(req, res))
);
boardRouter.post(
  '/projects/:projectId/board/cards/:cardId/links',
  asyncHandler((req, res) => boardController.addLink(req, res))
);
boardRouter.patch(
  '/projects/:projectId/board/links/:linkId',
  asyncHandler((req, res) => boardController.updateLink(req, res))
);
boardRouter.delete(
  '/projects/:projectId/board/links/:linkId',
  asyncHandler((req, res) => boardController.removeLink(req, res))
);
boardRouter.post(
  '/projects/:projectId/board/cards/:cardId/attachments',
  attachmentUpload.single('file'),
  asyncHandler((req, res) => boardController.addAttachment(req, res))
);
boardRouter.delete(
  '/projects/:projectId/board/attachments/:attachmentId',
  asyncHandler((req, res) => boardController.removeAttachment(req, res))
);

boardRouter.post('/projects/:projectId/board/labels', asyncHandler((req, res) => boardController.createLabel(req, res)));
boardRouter.patch('/projects/:projectId/board/labels/:labelId', asyncHandler((req, res) => boardController.updateLabel(req, res)));
boardRouter.delete('/projects/:projectId/board/labels/:labelId', asyncHandler((req, res) => boardController.removeLabel(req, res)));

boardRouter.patch('/board/cards/:id', asyncHandler((req, res) => boardController.updateCardById(req, res)));
boardRouter.delete('/board/cards/:id', asyncHandler((req, res) => boardController.removeCardById(req, res)));
boardRouter.post('/board/cards/:id/checklists', asyncHandler((req, res) => boardController.addChecklistByCardId(req, res)));
boardRouter.post(
  '/board/checklist-items/:id/toggle',
  asyncHandler((req, res) => boardController.toggleChecklistItem(req, res))
);
boardRouter.post('/board/cards/:id/comments', asyncHandler((req, res) => boardController.addCommentByCardId(req, res)));
boardRouter.post('/board/cards/:id/links', asyncHandler((req, res) => boardController.addLinkByCardId(req, res)));
boardRouter.post(
  '/board/cards/:id/attachments',
  attachmentUpload.single('file'),
  asyncHandler((req, res) => boardController.addAttachmentByCardId(req, res))
);
boardRouter.post('/board/cards/:id/assignees', asyncHandler((req, res) => boardController.addAssigneesByCardId(req, res)));
boardRouter.post('/board/cards/:id/labels', asyncHandler((req, res) => boardController.addLabelsByCardId(req, res)));
