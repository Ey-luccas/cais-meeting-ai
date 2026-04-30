import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { getBaseUrl } from '../../shared/http';
import { toRelativeStoragePath } from '../../shared/upload';
import { filesService } from './files.service';

const projectParamsSchema = z.object({
  id: z.string().uuid('ID de projeto inválido.')
});

const fileParamsSchema = z.object({
  id: z.string().uuid('ID de projeto inválido.'),
  fileId: z.string().uuid('ID de arquivo inválido.')
});

const uploadFileSchema = z.object({
  description: z
    .string()
    .trim()
    .max(280, 'A descrição deve ter no máximo 280 caracteres.')
    .optional()
});

export class FilesController {
  async list(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para listagem de arquivos.');

    const files = await filesService.listProjectFiles({
      organizationId: auth.organizationId,
      projectId: params.id,
      userId: auth.userId,
      organizationRole: auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json({ files });
  }

  async upload(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para upload de arquivo.');
    const payload = this.parse(uploadFileSchema, req.body ?? {}, 'Payload inválido para upload de arquivo.');

    if (!req.file) {
      throw new AppError(400, 'Arquivo é obrigatório para upload.');
    }

    const file = await filesService.uploadProjectFile({
      organizationId: auth.organizationId,
      projectId: params.id,
      userId: auth.userId,
      organizationRole: auth.role,
      fileName: req.file.originalname,
      description: payload.description?.trim() ? payload.description.trim() : null,
      filePath: toRelativeStoragePath('documents', req.file.filename),
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(file);
  }

  async remove(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(fileParamsSchema, req.params, 'Parâmetros inválidos para excluir arquivo.');

    await filesService.deleteProjectFile({
      organizationId: auth.organizationId,
      projectId: params.id,
      fileId: params.fileId,
      userId: auth.userId,
      organizationRole: auth.role
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

export const filesController = new FilesController();
