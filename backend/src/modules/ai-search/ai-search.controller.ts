import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { aiSearchIndexService } from './ai-search-index.service';
import { aiSearchThreadService } from './ai-search-thread.service';

const threadIdParamsSchema = z.object({
  id: z.string().uuid('ID de histórico inválido.')
});

const projectParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.')
});

const createThreadSchema = z
  .object({
    scope: z.enum(['ORGANIZATION', 'PROJECT']).default('ORGANIZATION'),
    projectId: z.string().uuid('ID de projeto inválido.').optional(),
    title: z.string().trim().max(160).optional()
  })
  .superRefine((value, context) => {
    if (value.scope === 'PROJECT' && !value.projectId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['projectId'],
        message: 'projectId é obrigatório quando scope=PROJECT.'
      });
    }
  });

const listThreadsQuerySchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.').optional(),
  includeArchived: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true')
});

const sendMessageSchema = z
  .object({
    question: z.string().trim().min(2).max(4000),
    scope: z.enum(['ORGANIZATION', 'PROJECT']).optional(),
    projectId: z.string().uuid('ID de projeto inválido.').nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.scope === 'PROJECT' && !value.projectId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['projectId'],
        message: 'projectId é obrigatório quando scope=PROJECT.'
      });
    }
  });

const suggestionsQuerySchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.').optional()
});

export class AiSearchController {
  async createThread(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const payload = this.parse(createThreadSchema, req.body ?? {}, 'Payload inválido para criação de histórico.');

    const thread = await aiSearchThreadService.createThread({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      scope: payload.scope,
      projectId: payload.projectId,
      title: payload.title
    });

    res.status(201).json(thread);
  }

  async listThreads(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const query = this.parse(listThreadsQuerySchema, req.query, 'Parâmetros inválidos para listar históricos.');

    const threads = await aiSearchThreadService.listThreads({
      organizationId: auth.organizationId,
      userId: auth.userId,
      projectId: query.projectId,
      includeArchived: query.includeArchived
    });

    res.json({ threads });
  }

  async getThread(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(threadIdParamsSchema, req.params, 'Parâmetros inválidos para abrir histórico.');

    const thread = await aiSearchThreadService.getThread({
      organizationId: auth.organizationId,
      userId: auth.userId,
      threadId: params.id
    });

    res.json(thread);
  }

  async askInThread(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(threadIdParamsSchema, req.params, 'Parâmetros inválidos para envio de pergunta.');
    const payload = this.parse(sendMessageSchema, req.body ?? {}, 'Payload inválido para envio de pergunta.');

    const responsePayload = await aiSearchThreadService.askInThread({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      threadId: params.id,
      question: payload.question,
      scope: payload.scope,
      projectId: payload.projectId ?? undefined
    });

    res.status(201).json(responsePayload);
  }

  async archiveThread(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(threadIdParamsSchema, req.params, 'Parâmetros inválidos para arquivar histórico.');

    const thread = await aiSearchThreadService.archiveThread({
      organizationId: auth.organizationId,
      userId: auth.userId,
      threadId: params.id
    });

    res.json(thread);
  }

  async deleteThread(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(threadIdParamsSchema, req.params, 'Parâmetros inválidos para apagar histórico.');

    await aiSearchThreadService.deleteThread({
      organizationId: auth.organizationId,
      userId: auth.userId,
      threadId: params.id
    });

    res.status(204).send();
  }

  async reindexOrganization(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);

    const result = await aiSearchIndexService.reindexOrganization({
      organizationId: auth.organizationId
    });

    res.json(result);
  }

  async reindexProject(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para reindexar projeto.');

    const result = await aiSearchIndexService.reindexProject({
      organizationId: auth.organizationId,
      projectId: params.projectId
    });

    res.json(result);
  }

  async getSuggestions(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const query = this.parse(suggestionsQuerySchema, req.query, 'Parâmetros inválidos para sugestões.');

    const suggestions = await aiSearchThreadService.getSuggestions({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      projectId: query.projectId
    });

    res.json({ suggestions });
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

export const aiSearchController = new AiSearchController();
