import type { Request, Response } from 'express';
import {
  LibraryDocumentType,
  LibraryItemOrigin,
  LibraryItemStatus,
  LibraryItemType,
  Prisma
} from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { getBaseUrl } from '../../shared/http';
import { libraryExportService } from './library-export.service';
import { libraryService } from './library.service';
import { libraryUploadService } from './library-upload.service';

const projectParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.')
});

const meetingParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  meetingId: z.string().uuid('ID de reunião inválido.')
});

const folderParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  folderId: z.string().uuid('ID de pasta inválido.')
});

const tagParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  tagId: z.string().uuid('ID de etiqueta inválido.')
});

const itemParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  itemId: z.string().uuid('ID de item inválido.')
});

const itemTagParamsSchema = z.object({
  projectId: z.string().uuid('ID de projeto inválido.'),
  itemId: z.string().uuid('ID de item inválido.'),
  tagId: z.string().uuid('ID de etiqueta inválido.')
});

const listItemsQuerySchema = z.object({
  q: z.string().trim().max(240).optional(),
  type: z.nativeEnum(LibraryItemType).optional(),
  origin: z.nativeEnum(LibraryItemOrigin).optional(),
  status: z.nativeEnum(LibraryItemStatus).optional(),
  folderId: z.string().uuid('ID de pasta inválido.').optional(),
  tagId: z.string().uuid('ID de etiqueta inválido.').optional()
});

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(140),
  parentId: z.string().uuid('ID de pasta pai inválido.').nullable().optional()
});

const updateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(140).optional(),
    parentId: z.string().uuid('ID de pasta pai inválido.').nullable().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualizar a pasta.'
  });

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().regex(/^#([A-Fa-f0-9]{6})$/, 'Cor inválida no formato HEX.')
});

const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    color: z.string().trim().regex(/^#([A-Fa-f0-9]{6})$/, 'Cor inválida no formato HEX.').optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualizar a etiqueta.'
  });

const createDocumentSchema = z.object({
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(1000).nullable().optional(),
  folderId: z.string().uuid('ID de pasta inválido.').nullable().optional(),
  tagIds: z.array(z.string().uuid('ID de etiqueta inválido.')).optional(),
  documentType: z.nativeEnum(LibraryDocumentType).nullable().optional(),
  contentMarkdown: z.string().trim().max(500000).nullable().optional()
});

const createFileBodySchema = z.object({
  title: z.string().trim().max(240).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  folderId: z.string().uuid('ID de pasta inválido.').nullable().optional(),
  tagIds: z.array(z.string().uuid('ID de etiqueta inválido.')).optional()
});

const updateItemSchema = z
  .object({
    title: z.string().trim().min(2).max(240).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    folderId: z.string().uuid('ID de pasta inválido.').nullable().optional(),
    documentType: z.nativeEnum(LibraryDocumentType).nullable().optional(),
    status: z.nativeEnum(LibraryItemStatus).optional(),
    contentMarkdown: z.string().trim().max(800000).nullable().optional(),
    contentJson: z.unknown().nullable().optional(),
    tagIds: z.array(z.string().uuid('ID de etiqueta inválido.')).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualizar o item da biblioteca.'
  });

const exportQuerySchema = z.object({
  format: z.enum(['markdown', 'docx'])
});

const generateMinutesSchema = z.object({
  forceNew: z.coerce.boolean().optional()
});

const parseTagIdsField = (raw: unknown): string[] | undefined => {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);

        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean);
        }
      } catch {
        return undefined;
      }
    }

    return trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);
  }

  return undefined;
};

export class LibraryController {
  async listItems(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para listar a biblioteca.');
    const query = this.parse(listItemsQuerySchema, req.query, 'Filtros inválidos para listar a biblioteca.');

    const result = await libraryService.listItems({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req),
      ...query
    });

    res.json(result);
  }

  async listFolders(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para listar pastas.');

    const folders = await libraryService.listFolders({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    res.json({ folders });
  }

  async createFolder(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para criar pasta.');
    const body = this.parse(createFolderSchema, req.body ?? {}, 'Payload inválido para criar pasta.');

    const folder = await libraryService.createFolder({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      name: body.name,
      parentId: body.parentId
    });

    res.status(201).json(folder);
  }

  async updateFolder(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(folderParamsSchema, req.params, 'Parâmetros inválidos para atualizar pasta.');
    const body = this.parse(updateFolderSchema, req.body ?? {}, 'Payload inválido para atualizar pasta.');

    const folder = await libraryService.updateFolder({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      folderId: params.folderId,
      userId: auth.userId,
      organizationRole: auth.role,
      name: body.name,
      parentId: body.parentId
    });

    res.json(folder);
  }

  async deleteFolder(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(folderParamsSchema, req.params, 'Parâmetros inválidos para excluir pasta.');

    await libraryService.deleteFolder({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      folderId: params.folderId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    res.status(204).send();
  }

  async listTags(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para listar etiquetas.');

    const tags = await libraryService.listTags({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    res.json({ tags });
  }

  async createTag(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para criar etiqueta.');
    const body = this.parse(createTagSchema, req.body ?? {}, 'Payload inválido para criar etiqueta.');

    const tag = await libraryService.createTag({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      name: body.name,
      color: body.color
    });

    res.status(201).json(tag);
  }

  async updateTag(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(tagParamsSchema, req.params, 'Parâmetros inválidos para atualizar etiqueta.');
    const body = this.parse(updateTagSchema, req.body ?? {}, 'Payload inválido para atualizar etiqueta.');

    const tag = await libraryService.updateTag({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      tagId: params.tagId,
      userId: auth.userId,
      organizationRole: auth.role,
      name: body.name,
      color: body.color
    });

    res.json(tag);
  }

  async deleteTag(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(tagParamsSchema, req.params, 'Parâmetros inválidos para excluir etiqueta.');

    await libraryService.deleteTag({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      tagId: params.tagId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    res.status(204).send();
  }

  async createDocument(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para criar documento.');
    const body = this.parse(createDocumentSchema, req.body ?? {}, 'Payload inválido para criar documento.');

    const document = await libraryService.createDocument({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req),
      title: body.title,
      description: body.description,
      folderId: body.folderId,
      tagIds: body.tagIds,
      documentType: body.documentType,
      contentMarkdown: body.contentMarkdown
    });

    res.status(201).json(document);
  }

  async createFile(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para upload na biblioteca.');

    if (!req.file) {
      throw new AppError(400, 'Arquivo é obrigatório para upload.');
    }

    const payload = {
      title: typeof req.body?.title === 'string' ? req.body.title : undefined,
      description: typeof req.body?.description === 'string' ? req.body.description : undefined,
      folderId: typeof req.body?.folderId === 'string' && req.body.folderId.trim().length > 0
        ? req.body.folderId.trim()
        : undefined,
      tagIds: parseTagIdsField(req.body?.tagIds)
    };

    const body = this.parse(createFileBodySchema, payload, 'Payload inválido para upload de arquivo na biblioteca.');
    const upload = libraryUploadService.buildUploadedFileMetadata(req.file);

    const item = await libraryService.createFileItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req),
      fileName: upload.originalName,
      filePath: upload.filePath,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      title: body.title,
      description: body.description,
      folderId: body.folderId,
      tagIds: body.tagIds
    });

    res.status(201).json(item);
  }

  async getItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(itemParamsSchema, req.params, 'Parâmetros inválidos para buscar item da biblioteca.');

    const item = await libraryService.getItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      itemId: params.itemId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json(item);
  }

  async updateItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(itemParamsSchema, req.params, 'Parâmetros inválidos para atualizar item da biblioteca.');
    const body = this.parse(updateItemSchema, req.body ?? {}, 'Payload inválido para atualizar item da biblioteca.');

    const item = await libraryService.updateItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      itemId: params.itemId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req),
      title: body.title,
      description: body.description,
      folderId: body.folderId,
      documentType: body.documentType,
      status: body.status,
      contentMarkdown: body.contentMarkdown,
      contentJson: body.contentJson as Prisma.InputJsonValue | null | undefined,
      tagIds: body.tagIds
    });

    res.json(item);
  }

  async archiveItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(itemParamsSchema, req.params, 'Parâmetros inválidos para arquivar item da biblioteca.');

    const item = await libraryService.archiveItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      itemId: params.itemId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json(item);
  }

  async deleteItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(itemParamsSchema, req.params, 'Parâmetros inválidos para excluir item da biblioteca.');

    await libraryService.softDeleteItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      itemId: params.itemId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    res.status(204).send();
  }

  async attachTagToItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(itemTagParamsSchema, req.params, 'Parâmetros inválidos para vincular etiqueta.');

    const item = await libraryService.attachTagToItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      itemId: params.itemId,
      tagId: params.tagId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json(item);
  }

  async detachTagFromItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(itemTagParamsSchema, req.params, 'Parâmetros inválidos para desvincular etiqueta.');

    const item = await libraryService.detachTagFromItem({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      itemId: params.itemId,
      tagId: params.tagId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json(item);
  }

  async exportItem(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(itemParamsSchema, req.params, 'Parâmetros inválidos para exportação de documento.');
    const query = this.parse(exportQuerySchema, req.query, 'Formato de exportação inválido.');

    const item = await libraryService.getDocumentForExport({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      itemId: params.itemId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    const metadata = {
      tipo: 'Documento',
      origem: item.origin,
      status: item.status,
      atualizadoEm: new Date(item.updatedAt).toLocaleString('pt-BR')
    };

    const exported =
      query.format === 'markdown'
        ? await libraryExportService.exportMarkdown({
            title: item.title,
            contentMarkdown: item.contentMarkdown,
            contentText: item.contentText,
            metadata
          })
        : await libraryExportService.exportDocx({
            title: item.title,
            contentMarkdown: item.contentMarkdown,
            contentText: item.contentText,
            metadata
          });

    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader('Content-Disposition', libraryExportService.extensionToContentDisposition(exported.fileName));
    res.status(200).send(exported.buffer);
  }

  async generateMeetingMinutes(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(meetingParamsSchema, req.params, 'Parâmetros inválidos para geração de ata.');
    const body = this.parse(generateMinutesSchema, req.body ?? {}, 'Payload inválido para geração de ata.');

    const item = await libraryService.generateMeetingMinutes({
      organizationId: auth.organizationId,
      projectId: params.projectId,
      meetingId: params.meetingId,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req),
      forceNew: body.forceNew
    });

    res.status(201).json(item);
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

export const libraryController = new LibraryController();
