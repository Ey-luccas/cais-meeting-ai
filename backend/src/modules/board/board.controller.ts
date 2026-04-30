import { CardPriority, CardSourceType } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { getBaseUrl } from '../../shared/http';
import { toRelativeStoragePath } from '../../shared/upload';
import { boardService } from './board.service';

const projectParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.')
});

const cardParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  cardId: z.string().uuid('ID de card inválido.')
});

const columnParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  columnId: z.string().uuid('ID de coluna inválido.')
});

const checklistParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  checklistId: z.string().uuid('ID de checklist inválido.')
});

const checklistItemParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  itemId: z.string().uuid('ID de item inválido.')
});

const linkParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  linkId: z.string().uuid('ID de link inválido.')
});

const attachmentParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  attachmentId: z.string().uuid('ID de anexo inválido.')
});

const labelParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  labelId: z.string().uuid('ID de etiqueta inválido.')
});

const cardByIdParamsSchema = z.object({
  id: z.string().uuid('ID de card inválido.')
});

const checklistItemByIdParamsSchema = z.object({
  id: z.string().uuid('ID de item inválido.')
});

const createColumnSchema = z.object({
  title: z.string().trim().min(2).max(120)
});

const reorderColumnsSchema = z.object({
  orderedColumnIds: z.array(z.string().uuid()).min(1)
});

const reorderCardsSchema = z.object({
  cardId: z.string().uuid('ID de card inválido.'),
  sourceColumnId: z.string().uuid('ID de coluna de origem inválido.'),
  destinationColumnId: z.string().uuid('ID de coluna de destino inválido.'),
  sourceOrderedCardIds: z.array(z.string().uuid()).min(0),
  destinationOrderedCardIds: z.array(z.string().uuid()).min(1)
});

const createCardSchema = z.object({
  boardColumnId: z.string().uuid('ID de coluna inválido.'),
  meetingId: z.string().uuid('ID de reunião inválido.').optional(),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(10000).optional(),
  sourceType: z.nativeEnum(CardSourceType).optional(),
  priority: z.nativeEnum(CardPriority).nullable().optional(),
  dueDate: z.string().trim().min(1).nullable().optional(),
  assigneeUserIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional()
});

const updateCardSchema = z
  .object({
    boardColumnId: z.string().uuid('ID de coluna inválido.').optional(),
    meetingId: z.string().uuid('ID de reunião inválido.').nullable().optional(),
    title: z.string().trim().min(2).max(240).optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    sourceType: z.nativeEnum(CardSourceType).optional(),
    priority: z.nativeEnum(CardPriority).nullable().optional(),
    dueDate: z.string().trim().min(1).nullable().optional(),
    assigneeUserIds: z.array(z.string().uuid()).optional(),
    labelIds: z.array(z.string().uuid()).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualizar o card.'
  });

const createChecklistSchema = z.object({
  title: z.string().trim().min(1).max(120)
});

const updateChecklistSchema = z.object({
  title: z.string().trim().min(1).max(120)
});

const createChecklistItemSchema = z.object({
  content: z.string().trim().min(1).max(300)
});

const reorderChecklistItemsSchema = z.object({
  orderedItemIds: z.array(z.string().uuid()).min(1)
});

const updateChecklistItemSchema = z
  .object({
    content: z.string().trim().min(1).max(300).optional(),
    isCompleted: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualizar o item do checklist.'
  });

const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(3000)
});

const createLinkSchema = z.object({
  title: z.string().trim().min(1).max(180),
  url: z.string().url('URL inválida.')
});

const updateLinkSchema = z.object({
  title: z.string().trim().min(1).max(180),
  url: z.string().url('URL inválida.')
});

const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/)
});

const updateLabelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/)
});

const toggleChecklistItemSchema = z.object({
  isCompleted: z.boolean().optional()
});

const assignAssigneesSchema = z
  .object({
    userIds: z.array(z.string().uuid()).optional(),
    assigneeUserIds: z.array(z.string().uuid()).optional(),
    mode: z.enum(['append', 'replace']).optional()
  })
  .refine((payload) => (payload.userIds?.length ?? payload.assigneeUserIds?.length ?? 0) > 0, {
    message: 'Informe ao menos um responsável para atribuição.'
  });

const assignLabelsSchema = z
  .object({
    labelIds: z.array(z.string().uuid()).min(1),
    mode: z.enum(['append', 'replace']).optional()
  })
  .refine((payload) => payload.labelIds.length > 0, {
    message: 'Informe ao menos uma etiqueta para vincular.'
  });

export class BoardController {
  async getBoard(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para board.');

    const board = await boardService.getBoard({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json(board);
  }

  async createColumn(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para coluna.');
    const payload = this.parse(createColumnSchema, req.body, 'Payload inválido para coluna.');

    const column = await boardService.createColumn({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      title: payload.title
    });

    res.status(201).json(column);
  }

  async updateColumn(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(columnParamsSchema, req.params, 'Parâmetros inválidos para coluna.');
    const payload = this.parse(createColumnSchema, req.body, 'Payload inválido para coluna.');

    const column = await boardService.updateColumn({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      columnId: params.columnId,
      title: payload.title
    });

    res.json(column);
  }

  async removeColumn(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(columnParamsSchema, req.params, 'Parâmetros inválidos para coluna.');

    await boardService.deleteColumn({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      columnId: params.columnId
    });

    res.status(204).send();
  }

  async reorderColumns(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para coluna.');
    const payload = this.parse(reorderColumnsSchema, req.body, 'Payload inválido para ordenação de colunas.');

    await boardService.reorderColumns({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      orderedColumnIds: payload.orderedColumnIds
    });

    res.status(204).send();
  }

  async createCard(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para criação de card.');
    const payload = this.parse(createCardSchema, req.body, 'Payload inválido para criação de card.');

    const card = await boardService.createCard({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      boardColumnId: payload.boardColumnId,
      meetingId: payload.meetingId,
      title: payload.title,
      description: payload.description,
      sourceType: payload.sourceType,
      priority: payload.priority,
      dueDate: payload.dueDate,
      assigneeUserIds: payload.assigneeUserIds,
      labelIds: payload.labelIds,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async reorderCards(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para ordenação de cards.');
    const payload = this.parse(reorderCardsSchema, req.body, 'Payload inválido para ordenação de cards.');

    await boardService.reorderCards({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: payload.cardId,
      sourceColumnId: payload.sourceColumnId,
      destinationColumnId: payload.destinationColumnId,
      sourceOrderedCardIds: payload.sourceOrderedCardIds,
      destinationOrderedCardIds: payload.destinationOrderedCardIds
    });

    res.status(204).send();
  }

  async updateCard(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardParamsSchema, req.params, 'Parâmetros inválidos para atualização de card.');
    const payload = this.parse(updateCardSchema, req.body, 'Payload inválido para atualização de card.');

    const card = await boardService.updateCard({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.cardId,
      boardColumnId: payload.boardColumnId,
      meetingId: payload.meetingId,
      title: payload.title,
      description: payload.description,
      sourceType: payload.sourceType,
      priority: payload.priority,
      dueDate: payload.dueDate,
      assigneeUserIds: payload.assigneeUserIds,
      labelIds: payload.labelIds,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async updateCardById(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para atualização de card.');
    const payload = this.parse(updateCardSchema, req.body, 'Payload inválido para atualização de card.');

    const card = await boardService.updateCardById({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id,
      boardColumnId: payload.boardColumnId,
      meetingId: payload.meetingId,
      title: payload.title,
      description: payload.description,
      sourceType: payload.sourceType,
      priority: payload.priority,
      dueDate: payload.dueDate,
      assigneeUserIds: payload.assigneeUserIds,
      labelIds: payload.labelIds,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async removeCard(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardParamsSchema, req.params, 'Parâmetros inválidos para exclusão de card.');

    await boardService.deleteCard({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.cardId
    });

    res.status(204).send();
  }

  async removeCardById(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para exclusão de card.');

    await boardService.deleteCardById({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id
    });

    res.status(204).send();
  }

  async addChecklist(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardParamsSchema, req.params, 'Parâmetros inválidos para checklist.');
    const payload = this.parse(createChecklistSchema, req.body, 'Payload inválido para checklist.');

    const card = await boardService.addChecklist({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.cardId,
      title: payload.title,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async addChecklistByCardId(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para checklist.');
    const payload = this.parse(createChecklistSchema, req.body, 'Payload inválido para checklist.');

    const card = await boardService.addChecklistByCardId({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id,
      title: payload.title,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async updateChecklist(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(checklistParamsSchema, req.params, 'Parâmetros inválidos para checklist.');
    const payload = this.parse(updateChecklistSchema, req.body, 'Payload inválido para checklist.');

    const card = await boardService.updateChecklist({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      checklistId: params.checklistId,
      title: payload.title,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async removeChecklist(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(checklistParamsSchema, req.params, 'Parâmetros inválidos para checklist.');

    const card = await boardService.removeChecklist({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      checklistId: params.checklistId,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async addChecklistItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(checklistParamsSchema, req.params, 'Parâmetros inválidos para item de checklist.');
    const payload = this.parse(createChecklistItemSchema, req.body, 'Payload inválido para item de checklist.');

    const card = await boardService.addChecklistItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      checklistId: params.checklistId,
      content: payload.content,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async reorderChecklistItems(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(checklistParamsSchema, req.params, 'Parâmetros inválidos para item de checklist.');
    const payload = this.parse(
      reorderChecklistItemsSchema,
      req.body,
      'Payload inválido para ordenação de item de checklist.'
    );

    const card = await boardService.reorderChecklistItems({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      checklistId: params.checklistId,
      orderedItemIds: payload.orderedItemIds,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async updateChecklistItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(
      checklistItemParamsSchema,
      req.params,
      'Parâmetros inválidos para atualização de item.'
    );
    const payload = this.parse(
      updateChecklistItemSchema,
      req.body,
      'Payload inválido para atualização do item.'
    );

    const card = await boardService.updateChecklistItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      itemId: params.itemId,
      isCompleted: payload.isCompleted,
      content: payload.content,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async removeChecklistItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(
      checklistItemParamsSchema,
      req.params,
      'Parâmetros inválidos para remoção de item.'
    );

    const card = await boardService.removeChecklistItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      itemId: params.itemId,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async toggleChecklistItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(
      checklistItemByIdParamsSchema,
      req.params,
      'Parâmetros inválidos para atualização de item.'
    );
    const payload = this.parse(
      toggleChecklistItemSchema,
      req.body ?? {},
      'Payload inválido para atualização do item.'
    );

    const card = await boardService.toggleChecklistItemById({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      itemId: params.id,
      isCompleted: payload.isCompleted,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async addComment(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardParamsSchema, req.params, 'Parâmetros inválidos para comentário.');
    const payload = this.parse(createCommentSchema, req.body, 'Payload inválido para comentário.');

    const card = await boardService.addComment({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.cardId,
      content: payload.content,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async addCommentByCardId(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para comentário.');
    const payload = this.parse(createCommentSchema, req.body, 'Payload inválido para comentário.');

    const card = await boardService.addCommentByCardId({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id,
      content: payload.content,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async addLink(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardParamsSchema, req.params, 'Parâmetros inválidos para link.');
    const payload = this.parse(createLinkSchema, req.body, 'Payload inválido para link.');

    const card = await boardService.addLink({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.cardId,
      title: payload.title,
      url: payload.url,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async addLinkByCardId(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para link.');
    const payload = this.parse(createLinkSchema, req.body, 'Payload inválido para link.');

    const card = await boardService.addLinkByCardId({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id,
      title: payload.title,
      url: payload.url,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async updateLink(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(linkParamsSchema, req.params, 'Parâmetros inválidos para link.');
    const payload = this.parse(updateLinkSchema, req.body, 'Payload inválido para link.');

    const card = await boardService.updateLink({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      linkId: params.linkId,
      title: payload.title,
      url: payload.url,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async removeLink(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(linkParamsSchema, req.params, 'Parâmetros inválidos para link.');

    const card = await boardService.removeLink({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      linkId: params.linkId,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async addAttachment(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardParamsSchema, req.params, 'Parâmetros inválidos para anexo.');

    if (!req.file) {
      throw new AppError(400, 'Arquivo de anexo é obrigatório.');
    }

    const card = await boardService.addAttachment({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.cardId,
      name: req.file.originalname,
      filePath: toRelativeStoragePath('attachments', req.file.filename),
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async addAttachmentByCardId(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para anexo.');

    if (!req.file) {
      throw new AppError(400, 'Arquivo de anexo é obrigatório.');
    }

    const card = await boardService.addAttachmentByCardId({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id,
      name: req.file.originalname,
      filePath: toRelativeStoragePath('attachments', req.file.filename),
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async removeAttachment(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(attachmentParamsSchema, req.params, 'Parâmetros inválidos para anexo.');

    const card = await boardService.removeAttachment({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      attachmentId: params.attachmentId,
      baseUrl: getBaseUrl(req)
    });

    res.json(card);
  }

  async addAssigneesByCardId(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para responsáveis.');
    const payload = this.parse(assignAssigneesSchema, req.body, 'Payload inválido para responsáveis.');

    const card = await boardService.addAssigneesByCardId({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id,
      assigneeUserIds: payload.userIds ?? payload.assigneeUserIds ?? [],
      mode: payload.mode,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async addLabelsByCardId(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(cardByIdParamsSchema, req.params, 'Parâmetros inválidos para etiquetas.');
    const payload = this.parse(assignLabelsSchema, req.body, 'Payload inválido para etiquetas.');

    const card = await boardService.addLabelsByCardId({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      cardId: params.id,
      labelIds: payload.labelIds,
      mode: payload.mode,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(card);
  }

  async createLabel(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para etiqueta.');
    const payload = this.parse(createLabelSchema, req.body, 'Payload inválido para etiqueta.');

    const label = await boardService.createLabel({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      name: payload.name,
      color: payload.color
    });

    res.status(201).json(label);
  }

  async updateLabel(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(labelParamsSchema, req.params, 'Parâmetros inválidos para etiqueta.');
    const payload = this.parse(updateLabelSchema, req.body, 'Payload inválido para etiqueta.');

    const label = await boardService.updateLabel({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      labelId: params.labelId,
      name: payload.name,
      color: payload.color
    });

    res.json(label);
  }

  async removeLabel(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(labelParamsSchema, req.params, 'Parâmetros inválidos para etiqueta.');

    await boardService.deleteLabel({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      labelId: params.labelId
    });

    res.status(204).send();
  }

  private assertAuth(req: Request): NonNullable<Request['auth']> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    return req.auth;
  }

  private parse<T extends z.ZodTypeAny>(schema: T, input: unknown, message: string): z.infer<T> {
    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      throw new AppError(400, message, parsed.error.flatten());
    }

    return parsed.data;
  }
}

export const boardController = new BoardController();
