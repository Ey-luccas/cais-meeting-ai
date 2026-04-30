import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { reportsService } from './reports.service';

const projectParamsSchema = z.object({
  id: z.string().uuid('ID de projeto inválido.')
});

const reportsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional()
});

export class ReportsController {
  async getProjectReport(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(projectParamsSchema, req.params, 'Parâmetros inválidos para relatório.');
    const query = this.parse(reportsQuerySchema, req.query, 'Parâmetros de período inválidos.');

    const report = await reportsService.getProjectReport({
      organizationId: auth.organizationId,
      projectId: params.id,
      userId: auth.userId,
      organizationRole: auth.role,
      days: query.days ?? 30
    });

    res.json(report);
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

export const reportsController = new ReportsController();
