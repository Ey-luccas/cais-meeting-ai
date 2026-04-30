import type { NotificationChannel, NotificationType, OrganizationRole, Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { emailNotificationService } from './email-notification.service';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  channel: NotificationChannel;
  targetHref: string | null;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  readAt: Date | null;
  emailSentAt: Date | null;
  createdAt: Date;
  projectId: string | null;
};

export type NotificationView = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  channel: NotificationChannel;
  targetHref: string | null;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  readAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  projectId: string | null;
};

export class NotificationService {
  private mapNotification(record: NotificationRecord): NotificationView {
    return {
      id: record.id,
      title: record.title,
      message: record.message,
      type: record.type,
      channel: record.channel,
      targetHref: record.targetHref,
      targetType: record.targetType,
      targetId: record.targetId,
      isRead: record.isRead,
      readAt: record.readAt?.toISOString() ?? null,
      emailSentAt: record.emailSentAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      projectId: record.projectId
    };
  }

  private normalizeListLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return DEFAULT_LIST_LIMIT;
    }

    return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(limit)));
  }

  private buildVisibilityWhere(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    unreadOnly?: boolean;
  }): Prisma.NotificationWhereInput {
    const canSeeAllOrganizationProjects =
      input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN';

    const visibleWithinProjectScope: Prisma.NotificationWhereInput = {
      OR: [
        {
          projectId: null
        },
        {
          project: {
            members: {
              some: {
                userId: input.userId
              }
            }
          }
        }
      ]
    };

    const visibleGeneralNotification: Prisma.NotificationWhereInput = canSeeAllOrganizationProjects
      ? {
          userId: null
        }
      : {
          userId: null,
          ...visibleWithinProjectScope
        };

    const visibleUserNotification: Prisma.NotificationWhereInput = canSeeAllOrganizationProjects
      ? {
          userId: input.userId
        }
      : {
          userId: input.userId,
          ...visibleWithinProjectScope
        };

    return {
      organizationId: input.organizationId,
      isRead: input.unreadOnly ? false : undefined,
      OR: [
        visibleUserNotification,
        visibleGeneralNotification
      ]
    };
  }

  async listNotifications(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<NotificationView[]> {
    const notifications = await prisma.notification.findMany({
      where: this.buildVisibilityWhere({
        organizationId: input.organizationId,
        userId: input.userId,
        organizationRole: input.organizationRole,
        unreadOnly: input.unreadOnly
      }),
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        channel: true,
        targetHref: true,
        targetType: true,
        targetId: true,
        isRead: true,
        readAt: true,
        emailSentAt: true,
        createdAt: true,
        projectId: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: this.normalizeListLimit(input.limit)
    });

    return notifications.map((notification) => this.mapNotification(notification));
  }

  async getUnreadCount(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<number> {
    return prisma.notification.count({
      where: this.buildVisibilityWhere({
        organizationId: input.organizationId,
        userId: input.userId,
        organizationRole: input.organizationRole,
        unreadOnly: true
      })
    });
  }

  async markAsRead(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    notificationId: string;
  }): Promise<NotificationView> {
    const existing = await prisma.notification.findFirst({
      where: {
        id: input.notificationId,
        ...this.buildVisibilityWhere({
          organizationId: input.organizationId,
          userId: input.userId,
          organizationRole: input.organizationRole
        })
      },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        channel: true,
        targetHref: true,
        targetType: true,
        targetId: true,
        isRead: true,
        readAt: true,
        emailSentAt: true,
        createdAt: true,
        projectId: true
      }
    });

    if (!existing) {
      throw new AppError(404, 'Notificação não encontrada.');
    }

    if (existing.isRead) {
      return this.mapNotification(existing);
    }

    const updated = await prisma.notification.update({
      where: {
        id: existing.id
      },
      data: {
        isRead: true,
        readAt: new Date()
      },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        channel: true,
        targetHref: true,
        targetType: true,
        targetId: true,
        isRead: true,
        readAt: true,
        emailSentAt: true,
        createdAt: true,
        projectId: true
      }
    });

    return this.mapNotification(updated);
  }

  async markAllAsRead(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<{ updatedCount: number }> {
    const updated = await prisma.notification.updateMany({
      where: this.buildVisibilityWhere({
        organizationId: input.organizationId,
        userId: input.userId,
        organizationRole: input.organizationRole,
        unreadOnly: true
      }),
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return {
      updatedCount: updated.count
    };
  }

  async deleteNotification(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    notificationId: string;
  }): Promise<void> {
    const existing = await prisma.notification.findFirst({
      where: {
        id: input.notificationId,
        ...this.buildVisibilityWhere({
          organizationId: input.organizationId,
          userId: input.userId,
          organizationRole: input.organizationRole
        })
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      throw new AppError(404, 'Notificação não encontrada.');
    }

    await prisma.notification.delete({
      where: {
        id: existing.id
      }
    });
  }

  async createNotification(input: {
    organizationId: string;
    userId?: string | null;
    projectId?: string | null;
    title: string;
    message: string;
    type: NotificationType;
    channel: NotificationChannel;
    targetType?: string | null;
    targetId?: string | null;
    targetHref?: string | null;
  }): Promise<NotificationView | null> {
    const normalizedTitle = input.title.trim();
    const normalizedMessage = input.message.trim();

    if (!normalizedTitle || !normalizedMessage) {
      throw new AppError(400, 'Título e mensagem são obrigatórios para criar notificação.');
    }

    const shouldPersistInApp = input.channel === 'IN_APP' || input.channel === 'BOTH';
    const shouldSendEmail = input.channel === 'EMAIL' || input.channel === 'BOTH';

    let created: NotificationRecord | null = null;

    if (shouldPersistInApp) {
      created = await prisma.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId ?? null,
          projectId: input.projectId ?? null,
          title: normalizedTitle,
          message: normalizedMessage,
          type: input.type,
          channel: input.channel,
          targetType: input.targetType?.trim() || null,
          targetId: input.targetId?.trim() || null,
          targetHref: input.targetHref?.trim() || null
        },
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          channel: true,
          targetHref: true,
          targetType: true,
          targetId: true,
          isRead: true,
          readAt: true,
          emailSentAt: true,
          createdAt: true,
          projectId: true
        }
      });
    }

    if (shouldSendEmail) {
      if (!input.userId) {
        logger.warn('Notificação de e-mail ignorada por ausência de usuário destinatário.', {
          type: input.type,
          title: input.title,
          organizationId: input.organizationId
        });
      } else {
        const recipient = await prisma.user.findFirst({
          where: {
            id: input.userId,
            organizationMemberships: {
              some: {
                organizationId: input.organizationId
              }
            }
          },
          select: {
            email: true,
            name: true
          }
        });

        if (!recipient) {
          logger.warn('Destinatário não encontrado para envio de notificação por e-mail.', {
            userId: input.userId,
            organizationId: input.organizationId,
            title: input.title
          });
        } else {
          const sent = await emailNotificationService.sendNotificationEmail({
            toEmail: recipient.email,
            recipientName: recipient.name,
            title: normalizedTitle,
            message: normalizedMessage,
            targetHref: input.targetHref
          });

          if (sent && created) {
            const updated = await prisma.notification.update({
              where: {
                id: created.id
              },
              data: {
                emailSentAt: new Date()
              },
              select: {
                id: true,
                title: true,
                message: true,
                type: true,
                channel: true,
                targetHref: true,
                targetType: true,
                targetId: true,
                isRead: true,
                readAt: true,
                emailSentAt: true,
                createdAt: true,
                projectId: true
              }
            });

            created = updated;
          }
        }
      }
    }

    return created ? this.mapNotification(created) : null;
  }
}

export const notificationService = new NotificationService();
