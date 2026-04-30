import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { getBaseUrl } from '../../shared/http';
import { toRelativeStoragePath } from '../../shared/upload';
import { documentsService } from './documents.service';

const projectParamsSchema = z.object({
  projectId: z.string().uuid()
});

export class DocumentsController {
  async list(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const parsedParams = projectParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de projeto inválido.', parsedParams.error.flatten());
    }

    const documents = await documentsService.listProjectDocuments({
      organizationId: req.auth.organizationId,
      projectId: parsedParams.data.projectId,
      baseUrl: getBaseUrl(req)
    });

    res.json({ documents });
  }

  async upload(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const parsedParams = projectParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de projeto inválido.', parsedParams.error.flatten());
    }

    if (!req.file) {
      throw new AppError(400, 'Arquivo é obrigatório para upload.');
    }

    const document = await documentsService.uploadDocument({
      organizationId: req.auth.organizationId,
      projectId: parsedParams.data.projectId,
      uploadedByMemberId: req.auth.memberId,
      fileName: req.file.originalname,
      filePath: toRelativeStoragePath('documents', req.file.filename),
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(document);
  }
}

export const documentsController = new DocumentsController();
