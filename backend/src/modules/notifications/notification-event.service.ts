import type { NotificationChannel, NotificationType, ProjectRole } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { logger } from '../../shared/logger';
import { notificationService } from './notification.service';

type BaseEventPayload = {
  organizationId: string;
  projectId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetHref?: string | null;
};

const roleLabel: Record<ProjectRole, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
  VIEWER: 'Visualizador'
};

const toUniqueUserIds = (userIds: string[]): string[] => [...new Set(userIds.filter(Boolean))];

const formatDueDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'data informada';
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

const startOfToday = (reference: Date): Date => {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  return date;
};

export class NotificationEventService {
  private async listProjectMemberUserIds(projectId: string): Promise<string[]> {
    const members = await prisma.projectMember.findMany({
      where: {
        projectId
      },
      select: {
        userId: true
      }
    });

    return members.map((member) => member.userId);
  }

  private async listProjectAdminOwnerUserIds(projectId: string): Promise<string[]> {
    const members = await prisma.projectMember.findMany({
      where: {
        projectId,
        role: {
          in: ['OWNER', 'ADMIN']
        }
      },
      select: {
        userId: true
      }
    });

    return members.map((member) => member.userId);
  }

  private async notifyUsers(input: {
    userIds: string[];
    title: string;
    message: string;
    type: NotificationType;
    channel: NotificationChannel;
    basePayload: BaseEventPayload;
  }): Promise<void> {
    const userIds = toUniqueUserIds(input.userIds);

    if (userIds.length === 0) {
      return;
    }

    await Promise.all(
      userIds.map((userId) =>
        notificationService.createNotification({
          organizationId: input.basePayload.organizationId,
          userId,
          projectId: input.basePayload.projectId ?? null,
          title: input.title,
          message: input.message,
          type: input.type,
          channel: input.channel,
          targetType: input.basePayload.targetType ?? null,
          targetId: input.basePayload.targetId ?? null,
          targetHref: input.basePayload.targetHref ?? null
        })
      )
    );
  }

  private async hasNotificationForToday(input: {
    organizationId: string;
    userId: string;
    type: NotificationType;
    targetType: string;
    targetId: string;
    referenceDate: Date;
  }): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        createdAt: {
          gte: startOfToday(input.referenceDate)
        }
      },
      select: {
        id: true
      }
    });

    return Boolean(existing);
  }

  private async resolveMeetingRecipients(input: {
    projectId: string;
    recipientUserIds?: string[];
    createdByUserId?: string;
  }): Promise<string[]> {
    const baseRecipients = input.recipientUserIds ?? (await this.listProjectMemberUserIds(input.projectId));

    return toUniqueUserIds([
      ...baseRecipients,
      input.createdByUserId ?? ''
    ]);
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
  }) {
    return notificationService.createNotification(input);
  }

  async notifyCardCreated(input: {
    organizationId: string;
    projectId: string;
    cardId: string;
    cardTitle: string;
    projectName: string;
    recipientUserIds?: string[];
  }): Promise<void> {
    const recipientUserIds = input.recipientUserIds ?? (await this.listProjectMemberUserIds(input.projectId));

    await this.notifyUsers({
      userIds: recipientUserIds,
      title: 'Novo cartão criado',
      message: `Um novo cartão foi criado no projeto ${input.projectName}: ${input.cardTitle}.`,
      type: 'CARD_CREATED',
      channel: 'IN_APP',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'card',
        targetId: input.cardId,
        targetHref: `/projects/${input.projectId}/board?card=${input.cardId}`
      }
    });
  }

  async notifyCardAssigned(input: {
    organizationId: string;
    projectId: string;
    cardId: string;
    cardTitle: string;
    projectName: string;
    assignedUserId: string;
  }): Promise<void> {
    await this.notifyUsers({
      userIds: [input.assignedUserId],
      title: 'Você foi atribuído a um cartão',
      message: `Você foi definido como responsável pelo cartão ${input.cardTitle} no projeto ${input.projectName}.`,
      type: 'CARD_ASSIGNED',
      channel: 'BOTH',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'card',
        targetId: input.cardId,
        targetHref: `/projects/${input.projectId}/board?card=${input.cardId}`
      }
    });
  }

  async notifyCardDueDateSet(input: {
    organizationId: string;
    projectId: string;
    cardId: string;
    cardTitle: string;
    dueDate: Date | string;
    recipientUserIds: string[];
  }): Promise<void> {
    const dueDateLabel = formatDueDate(input.dueDate);

    await this.notifyUsers({
      userIds: input.recipientUserIds,
      title: 'Prazo definido para um cartão',
      message: `O cartão ${input.cardTitle} recebeu prazo de entrega para ${dueDateLabel}.`,
      type: 'CARD_DUE_DATE_SET',
      channel: 'BOTH',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'card',
        targetId: input.cardId,
        targetHref: `/projects/${input.projectId}/board?card=${input.cardId}`
      }
    });
  }

  async notifyCardDueSoon(input: {
    organizationId: string;
    projectId: string;
    cardId: string;
    cardTitle: string;
    recipientUserIds: string[];
  }): Promise<void> {
    await this.notifyUsers({
      userIds: input.recipientUserIds,
      title: 'Prazo próximo',
      message: `O cartão ${input.cardTitle} vence em breve.`,
      type: 'CARD_DUE_SOON',
      channel: 'BOTH',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'card',
        targetId: input.cardId,
        targetHref: `/projects/${input.projectId}/board?card=${input.cardId}`
      }
    });
  }

  async notifyCardOverdue(input: {
    organizationId: string;
    projectId: string;
    cardId: string;
    cardTitle: string;
    recipientUserIds: string[];
  }): Promise<void> {
    await this.notifyUsers({
      userIds: input.recipientUserIds,
      title: 'Prazo vencido',
      message: `O cartão ${input.cardTitle} está com prazo vencido.`,
      type: 'CARD_OVERDUE',
      channel: 'BOTH',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'card',
        targetId: input.cardId,
        targetHref: `/projects/${input.projectId}/board?card=${input.cardId}`
      }
    });
  }

  async notifyCardCommented(input: {
    organizationId: string;
    projectId: string;
    cardId: string;
    cardTitle: string;
    actorName: string;
    recipientUserIds: string[];
  }): Promise<void> {
    await this.notifyUsers({
      userIds: input.recipientUserIds,
      title: 'Novo comentário no cartão',
      message: `${input.actorName} comentou no cartão ${input.cardTitle}.`,
      type: 'CARD_COMMENTED',
      channel: 'IN_APP',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'card',
        targetId: input.cardId,
        targetHref: `/projects/${input.projectId}/board?card=${input.cardId}`
      }
    });
  }

  async notifyCardMoved(input: {
    organizationId: string;
    projectId: string;
    cardId: string;
    cardTitle: string;
    fromColumnTitle: string;
    toColumnTitle: string;
    recipientUserIds: string[];
  }): Promise<void> {
    await this.notifyUsers({
      userIds: input.recipientUserIds,
      title: 'Cartão movido de coluna',
      message: `O cartão ${input.cardTitle} foi movido de ${input.fromColumnTitle} para ${input.toColumnTitle}.`,
      type: 'CARD_MOVED',
      channel: 'IN_APP',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'card',
        targetId: input.cardId,
        targetHref: `/projects/${input.projectId}/board?card=${input.cardId}`
      }
    });
  }

  async notifyMeetingCreated(input: {
    organizationId: string;
    projectId: string;
    meetingId: string;
    meetingTitle: string;
    recipientUserIds?: string[];
    createdByUserId?: string;
  }): Promise<void> {
    const recipientUserIds = await this.resolveMeetingRecipients({
      projectId: input.projectId,
      recipientUserIds: input.recipientUserIds,
      createdByUserId: input.createdByUserId
    });

    await this.notifyUsers({
      userIds: recipientUserIds,
      title: 'Nova reunião criada',
      message: `Uma nova reunião foi criada: ${input.meetingTitle}.`,
      type: 'MEETING_CREATED',
      channel: 'IN_APP',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'meeting',
        targetId: input.meetingId,
        targetHref: `/projects/${input.projectId}/meetings/${input.meetingId}`
      }
    });
  }

  async notifyMeetingTranscriptionReady(input: {
    organizationId: string;
    projectId: string;
    meetingId: string;
    meetingTitle: string;
    recipientUserIds?: string[];
    createdByUserId?: string;
  }): Promise<void> {
    const recipientUserIds = await this.resolveMeetingRecipients({
      projectId: input.projectId,
      recipientUserIds: input.recipientUserIds,
      createdByUserId: input.createdByUserId
    });

    await this.notifyUsers({
      userIds: recipientUserIds,
      title: 'Transcrição disponível',
      message: `A transcrição da reunião ${input.meetingTitle} já está disponível.`,
      type: 'MEETING_TRANSCRIPTION_READY',
      channel: 'BOTH',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'meeting',
        targetId: input.meetingId,
        targetHref: `/projects/${input.projectId}/meetings/${input.meetingId}`
      }
    });
  }

  async notifyMeetingNotesReady(input: {
    organizationId: string;
    projectId: string;
    meetingId: string;
    meetingTitle: string;
    recipientUserIds?: string[];
    createdByUserId?: string;
  }): Promise<void> {
    const recipientUserIds = await this.resolveMeetingRecipients({
      projectId: input.projectId,
      recipientUserIds: input.recipientUserIds,
      createdByUserId: input.createdByUserId
    });

    await this.notifyUsers({
      userIds: recipientUserIds,
      title: 'Notas da reunião geradas',
      message: `As notas, decisões e tarefas da reunião ${input.meetingTitle} foram geradas com IA.`,
      type: 'MEETING_NOTES_READY',
      channel: 'BOTH',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'meeting',
        targetId: input.meetingId,
        targetHref: `/projects/${input.projectId}/meetings/${input.meetingId}`
      }
    });
  }

  async notifyFileUploaded(input: {
    organizationId: string;
    projectId: string;
    fileId: string;
    fileName: string;
    projectName: string;
    recipientUserIds?: string[];
  }): Promise<void> {
    const recipientUserIds = input.recipientUserIds ?? (await this.listProjectMemberUserIds(input.projectId));

    await this.notifyUsers({
      userIds: recipientUserIds,
      title: 'Novo arquivo enviado',
      message: `Um novo arquivo foi adicionado ao projeto ${input.projectName}: ${input.fileName}.`,
      type: 'FILE_UPLOADED',
      channel: 'IN_APP',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'file',
        targetId: input.fileId,
        targetHref: `/projects/${input.projectId}/files`
      }
    });
  }

  async notifyProjectMemberAdded(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    role: ProjectRole;
    projectName: string;
  }): Promise<void> {
    await this.notifyUsers({
      userIds: [input.userId],
      title: 'Você foi adicionado ao projeto',
      message: `Você foi adicionado ao projeto ${input.projectName} como ${roleLabel[input.role]}.`,
      type: 'PROJECT_MEMBER_ADDED',
      channel: 'BOTH',
      basePayload: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        targetType: 'project',
        targetId: input.projectId,
        targetHref: `/projects/${input.projectId}`
      }
    });
  }

  async notifySystem(input: {
    organizationId: string;
    userId: string;
    title: string;
    message: string;
    targetHref?: string | null;
  }): Promise<void> {
    await notificationService.createNotification({
      organizationId: input.organizationId,
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: 'SYSTEM',
      channel: 'IN_APP',
      targetType: 'system',
      targetHref: input.targetHref ?? null
    });
  }

  async runDueDateNotifications(input?: {
    organizationId?: string;
    referenceDate?: Date;
    dueSoonHours?: number;
  }): Promise<{ dueSoon: number; overdue: number }> {
    const referenceDate = input?.referenceDate ?? new Date();
    const dueSoonHours = input?.dueSoonHours ?? 48;
    const dueSoonThreshold = new Date(referenceDate.getTime() + dueSoonHours * 60 * 60 * 1000);

    const cards = await prisma.card.findMany({
      where: {
        dueDate: {
          not: null,
          lte: dueSoonThreshold
        },
        project: {
          organizationId: input?.organizationId
        }
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        projectId: true,
        project: {
          select: {
            organizationId: true
          }
        },
        assignees: {
          select: {
            userId: true
          }
        }
      }
    });

    let dueSoonCount = 0;
    let overdueCount = 0;

    for (const card of cards) {
      if (!card.dueDate) {
        continue;
      }

      const assigneeIds = toUniqueUserIds(card.assignees.map((entry) => entry.userId));

      if (assigneeIds.length === 0) {
        continue;
      }

      const isOverdue = card.dueDate.getTime() < referenceDate.getTime();

      if (!isOverdue) {
        const recipients: string[] = [];

        for (const userId of assigneeIds) {
          const alreadyNotified = await this.hasNotificationForToday({
            organizationId: card.project.organizationId,
            userId,
            type: 'CARD_DUE_SOON',
            targetType: 'card',
            targetId: card.id,
            referenceDate
          });

          if (!alreadyNotified) {
            recipients.push(userId);
          }
        }

        if (recipients.length > 0) {
          await this.notifyCardDueSoon({
            organizationId: card.project.organizationId,
            projectId: card.projectId,
            cardId: card.id,
            cardTitle: card.title,
            recipientUserIds: recipients
          });
          dueSoonCount += recipients.length;
        }

        continue;
      }

      const adminAndOwnerIds = await this.listProjectAdminOwnerUserIds(card.projectId);
      const recipients = toUniqueUserIds([...assigneeIds, ...adminAndOwnerIds]);
      const recipientsToNotify: string[] = [];

      for (const userId of recipients) {
        const alreadyNotified = await this.hasNotificationForToday({
          organizationId: card.project.organizationId,
          userId,
          type: 'CARD_OVERDUE',
          targetType: 'card',
          targetId: card.id,
          referenceDate
        });

        if (!alreadyNotified) {
          recipientsToNotify.push(userId);
        }
      }

      if (recipientsToNotify.length > 0) {
        await this.notifyCardOverdue({
          organizationId: card.project.organizationId,
          projectId: card.projectId,
          cardId: card.id,
          cardTitle: card.title,
          recipientUserIds: recipientsToNotify
        });
        overdueCount += recipientsToNotify.length;
      }
    }

    logger.info('Processamento de notificações de prazo concluído.', {
      organizationId: input?.organizationId ?? 'all',
      dueSoonNotified: dueSoonCount,
      overdueNotified: overdueCount
    });

    return {
      dueSoon: dueSoonCount,
      overdue: overdueCount
    };
  }
}

export const notificationEventService = new NotificationEventService();
