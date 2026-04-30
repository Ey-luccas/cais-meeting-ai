import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { notificationService } from './notification.service';

const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const notificationIdParamsSchema = z.object({
  id: z.string().uuid('ID de notificação inválido.')
});

export class NotificationController {
  async list(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const query = this.parse(
      listNotificationsQuerySchema,
      req.query,
      'Parâmetros inválidos para listagem de notificações.'
    );

    const notifications = await notificationService.listNotifications({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      unreadOnly: query.unreadOnly,
      limit: query.limit
    });

    res.json({ notifications });
  }

  async unreadCount(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);

    const count = await notificationService.getUnreadCount({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    res.json({ count });
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(
      notificationIdParamsSchema,
      req.params,
      'Parâmetros inválidos para marcar notificação como lida.'
    );

    const notification = await notificationService.markAsRead({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      notificationId: params.id
    });

    res.json(notification);
  }

  async markAllAsRead(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);

    const result = await notificationService.markAllAsRead({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role
    });

    res.json(result);
  }

  async remove(req: Request, res: Response): Promise<void> {
    const auth = this.assertAuth(req);
    const params = this.parse(
      notificationIdParamsSchema,
      req.params,
      'Parâmetros inválidos para excluir notificação.'
    );

    await notificationService.deleteNotification({
      organizationId: auth.organizationId,
      userId: auth.userId,
      organizationRole: auth.role,
      notificationId: params.id
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

export const notificationController = new NotificationController();
