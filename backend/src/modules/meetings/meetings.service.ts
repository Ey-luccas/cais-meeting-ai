import type { MeetingStatus, ObservationType, OrganizationRole } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { aiCardGeneratorService } from '../../services/ai/ai-card-generator.service';
import { deepseekMeetingAnalysisService } from '../../services/ai/deepseek-meeting-analysis.service';
import { transcriptionRouterService } from '../../services/transcription/transcription-router.service';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { resolveStoredFilePath, toPublicFileUrl } from '../../shared/storage';
import { toRelativeStoragePath } from '../../shared/upload';
import { aiSearchIndexService } from '../ai-search/ai-search-index.service';
import { notificationEventService } from '../notifications/notification-event.service';

type MeetingTask = {
  title: string;
  description: string | null;
  assignees: string[];
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

type MeetingObservationView = {
  id: string;
  timestampSeconds: number;
  type: ObservationType;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

type MeetingGeneratedCardView = {
  id: string;
  title: string;
  description: string | null;
  sourceType: 'MANUAL' | 'AI';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  column: {
    id: string;
    title: string;
  };
  assignees: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  }>;
};

type MeetingSummary = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MeetingStatus;
  audioUrl: string | null;
  durationSeconds: number | null;
  hasTranscript: boolean;
  hasAnalysis: boolean;
  observationsCount: number;
  createdAt: string;
  updatedAt: string;
};

type MeetingDetail = MeetingSummary & {
  project: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  transcript: {
    id: string;
    fullText: string;
    language: string | null;
    createdAt: string;
  } | null;
  analysis: {
    summary: string;
    topics: string[];
    decisions: string[];
    tasks: MeetingTask[];
    pendingItems: string[];
    notes: string[];
    report: string | null;
    reportMeta: unknown;
    createdAt: string;
  } | null;
  observations: MeetingObservationView[];
  generatedCards: MeetingGeneratedCardView[];
};

export class MeetingsService {
  private async assertProjectPermission(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    requiredAccess: 'read' | 'write';
  }): Promise<void> {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        members: {
          where: {
            userId: input.userId
          },
          select: {
            role: true
          },
          take: 1
        }
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }

    if (input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN') {
      return;
    }

    const projectRole = project.members[0]?.role;

    if (!projectRole) {
      throw new AppError(403, 'Você não tem acesso a este projeto.');
    }

    if (input.requiredAccess === 'write' && projectRole === 'VIEWER') {
      throw new AppError(403, 'Perfil VIEWER não pode modificar reuniões.');
    }
  }

  private async getMeetingForAccess(input: {
    organizationId: string;
    meetingId: string;
    userId: string;
    organizationRole: OrganizationRole;
    requiredAccess: 'read' | 'write';
  }): Promise<{
    id: string;
    projectId: string;
  }> {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: input.meetingId,
        project: {
          organizationId: input.organizationId
        }
      },
      select: {
        id: true,
        projectId: true
      }
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    await this.assertProjectPermission({
      organizationId: input.organizationId,
      projectId: meeting.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: input.requiredAccess
    });

    return meeting;
  }

  private parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private parseTasks(value: unknown): MeetingTask[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const raw = entry as Record<string, unknown>;
        const title = typeof raw.title === 'string' ? raw.title.trim() : '';

        if (!title) {
          return null;
        }

        const priorityRaw =
          typeof raw.priority === 'string' && ['low', 'medium', 'high', 'urgent'].includes(raw.priority)
            ? (raw.priority as 'low' | 'medium' | 'high' | 'urgent')
            : 'medium';

        return {
          title,
          description: typeof raw.description === 'string' ? raw.description : null,
          assignees: this.parseStringArray(raw.assignees),
          dueDate: typeof raw.dueDate === 'string' ? raw.dueDate : null,
          priority: priorityRaw
        } satisfies MeetingTask;
      })
      .filter((entry): entry is MeetingTask => Boolean(entry));
  }

  private parseReport(value: unknown): {
    report: string | null;
    meta: unknown;
  } {
    if (typeof value === 'string') {
      return {
        report: value,
        meta: null
      };
    }

    if (!value || typeof value !== 'object') {
      return {
        report: null,
        meta: null
      };
    }

    const record = value as Record<string, unknown>;

    return {
      report: typeof record.report === 'string' ? record.report : null,
      meta: value
    };
  }

  private mapObservation(observation: {
    id: string;
    timestampSeconds: number;
    type: ObservationType;
    content: string;
    createdAt: Date;
    authorUser: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }): MeetingObservationView {
    return {
      id: observation.id,
      timestampSeconds: observation.timestampSeconds,
      type: observation.type,
      content: observation.content,
      createdAt: observation.createdAt.toISOString(),
      author: {
        id: observation.authorUser.id,
        name: observation.authorUser.name,
        email: observation.authorUser.email,
        avatarUrl: observation.authorUser.avatarUrl
      }
    };
  }

  private mapMeetingSummary(
    meeting: {
      id: string;
      projectId: string;
      title: string;
      description: string | null;
      status: MeetingStatus;
      audioPath: string | null;
      durationSeconds: number | null;
      createdAt: Date;
      updatedAt: Date;
      transcript: object | null;
      note: object | null;
      _count: { observations: number };
    },
    baseUrl: string
  ): MeetingSummary {
    return {
      id: meeting.id,
      projectId: meeting.projectId,
      title: meeting.title,
      description: meeting.description,
      status: meeting.status,
      audioUrl: meeting.audioPath ? toPublicFileUrl(baseUrl, meeting.audioPath) : null,
      durationSeconds: meeting.durationSeconds,
      hasTranscript: Boolean(meeting.transcript),
      hasAnalysis: Boolean(meeting.note),
      observationsCount: meeting._count.observations,
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString()
    };
  }

  private mapMeetingDetail(
    meeting: {
      id: string;
      projectId: string;
      title: string;
      description: string | null;
      status: MeetingStatus;
      audioPath: string | null;
      durationSeconds: number | null;
      createdAt: Date;
      updatedAt: Date;
      project: {
        id: string;
        name: string;
      };
      createdByUser: {
        id: string;
        name: string;
        email: string;
      };
      transcript: {
        id: string;
        fullText: string;
        language: string | null;
        createdAt: Date;
      } | null;
      note: {
        summary: string;
        topicsJson: Prisma.JsonValue | null;
        decisionsJson: Prisma.JsonValue | null;
        actionItemsJson: Prisma.JsonValue | null;
        pendingItemsJson: Prisma.JsonValue | null;
        commentsJson: Prisma.JsonValue | null;
        reportJson: Prisma.JsonValue | null;
        createdAt: Date;
      } | null;
      observations: Array<{
        id: string;
        timestampSeconds: number;
        type: ObservationType;
        content: string;
        createdAt: Date;
        authorUser: {
          id: string;
          name: string;
          email: string;
          avatarUrl: string | null;
        };
      }>;
      cards: Array<{
        id: string;
        title: string;
        description: string | null;
        sourceType: 'MANUAL' | 'AI';
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
        dueDate: Date | null;
        createdAt: Date;
        updatedAt: Date;
        boardColumn: {
          id: string;
          title: string;
        };
        assignees: Array<{
          user: {
            id: string;
            name: string;
            email: string;
            avatarUrl: string | null;
          };
        }>;
      }>;
      _count: { observations: number };
    },
    baseUrl: string
  ): MeetingDetail {
    const summary = this.mapMeetingSummary(meeting, baseUrl);
    const report = this.parseReport(meeting.note?.reportJson ?? null);

    return {
      ...summary,
      project: {
        id: meeting.project.id,
        name: meeting.project.name
      },
      createdBy: {
        id: meeting.createdByUser.id,
        name: meeting.createdByUser.name,
        email: meeting.createdByUser.email
      },
      transcript: meeting.transcript
        ? {
            id: meeting.transcript.id,
            fullText: meeting.transcript.fullText,
            language: meeting.transcript.language,
            createdAt: meeting.transcript.createdAt.toISOString()
          }
        : null,
      analysis: meeting.note
        ? {
            summary: meeting.note.summary,
            topics: this.parseStringArray(meeting.note.topicsJson),
            decisions: this.parseStringArray(meeting.note.decisionsJson),
            tasks: this.parseTasks(meeting.note.actionItemsJson),
            pendingItems: this.parseStringArray(meeting.note.pendingItemsJson),
            notes: this.parseStringArray(meeting.note.commentsJson),
            report: report.report,
            reportMeta: report.meta,
            createdAt: meeting.note.createdAt.toISOString()
          }
        : null,
      observations: meeting.observations.map((entry) => this.mapObservation(entry)),
      generatedCards: meeting.cards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
        sourceType: card.sourceType,
        priority: card.priority,
        dueDate: card.dueDate?.toISOString() ?? null,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
        column: {
          id: card.boardColumn.id,
          title: card.boardColumn.title
        },
        assignees: card.assignees.map((assignee) => ({
          id: assignee.user.id,
          name: assignee.user.name,
          email: assignee.user.email,
          avatarUrl: assignee.user.avatarUrl
        }))
      }))
    };
  }

  async listProjectMeetings(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<MeetingSummary[]> {
    await this.assertProjectPermission({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'read'
    });

    const meetings = await prisma.meeting.findMany({
      where: {
        projectId: input.projectId,
        project: {
          organizationId: input.organizationId
        }
      },
      include: {
        transcript: {
          select: {
            id: true
          }
        },
        note: {
          select: {
            id: true
          }
        },
        _count: {
          select: {
            observations: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return meetings.map((meeting) => this.mapMeetingSummary(meeting, input.baseUrl));
  }

  async createMeeting(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    title: string;
    description?: string;
    audioFile?: Express.Multer.File;
    baseUrl: string;
  }): Promise<MeetingDetail> {
    await this.assertProjectPermission({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const createdMeeting = await prisma.meeting.create({
      data: {
        projectId: input.projectId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        audioPath: input.audioFile ? toRelativeStoragePath('audio', input.audioFile.filename) : null,
        status: input.audioFile ? 'UPLOADED' : 'PENDING',
        createdByUserId: input.userId
      },
      select: {
        id: true
      }
    });

    await aiSearchIndexService.indexMeetingById({
      organizationId: input.organizationId,
      meetingId: createdMeeting.id
    });

    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        name: true
      }
    });

    if (project) {
      await this.notifySafely('MEETING_CREATED', () =>
        notificationEventService.notifyMeetingCreated({
          organizationId: input.organizationId,
          projectId: input.projectId,
          meetingId: createdMeeting.id,
          meetingTitle: input.title.trim(),
          createdByUserId: input.userId
        })
      );
    }

    return this.getMeetingById({
      organizationId: input.organizationId,
      meetingId: createdMeeting.id,
      userId: input.userId,
      organizationRole: input.organizationRole,
      baseUrl: input.baseUrl
    });
  }

  async getMeetingById(input: {
    organizationId: string;
    meetingId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<MeetingDetail> {
    const accessibleMeeting = await this.getMeetingForAccess({
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'read'
    });

    const meeting = await prisma.meeting.findUnique({
      where: {
        id: accessibleMeeting.id
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        transcript: {
          select: {
            id: true,
            fullText: true,
            language: true,
            createdAt: true
          }
        },
        note: {
          select: {
            summary: true,
            topicsJson: true,
            decisionsJson: true,
            actionItemsJson: true,
            pendingItemsJson: true,
            commentsJson: true,
            reportJson: true,
            createdAt: true
          }
        },
        observations: {
          include: {
            authorUser: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          },
          orderBy: [
            {
              timestampSeconds: 'asc'
            },
            {
              createdAt: 'asc'
            }
          ]
        },
        cards: {
          include: {
            boardColumn: {
              select: {
                id: true,
                title: true
              }
            },
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true
                  }
                }
              }
            }
          },
          orderBy: [{ createdAt: 'desc' }]
        },
        _count: {
          select: {
            observations: true
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    return this.mapMeetingDetail(meeting, input.baseUrl);
  }

  async deleteMeeting(input: {
    organizationId: string;
    meetingId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<void> {
    const meeting = await this.getMeetingForAccess({
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    await aiSearchIndexService.removeMeetingChunks({
      organizationId: input.organizationId,
      meetingId: meeting.id
    });

    await prisma.meeting.delete({
      where: {
        id: meeting.id
      }
    });
  }

  async uploadMeetingAudio(input: {
    organizationId: string;
    meetingId: string;
    userId: string;
    organizationRole: OrganizationRole;
    audioFile: Express.Multer.File;
    baseUrl: string;
  }): Promise<MeetingDetail> {
    const meeting = await this.getMeetingForAccess({
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    await aiSearchIndexService.removeMeetingChunks({
      organizationId: input.organizationId,
      meetingId: meeting.id
    });

    await prisma.$transaction(async (tx) => {
      await tx.transcript.deleteMany({
        where: {
          meetingId: meeting.id
        }
      });

      await tx.meetingNote.deleteMany({
        where: {
          meetingId: meeting.id
        }
      });

      await tx.meeting.update({
        where: {
          id: meeting.id
        },
        data: {
          audioPath: toRelativeStoragePath('audio', input.audioFile.filename),
          durationSeconds: null,
          status: 'UPLOADED'
        }
      });
    });

    await aiSearchIndexService.indexMeetingById({
      organizationId: input.organizationId,
      meetingId: meeting.id
    });

    return this.getMeetingById({
      organizationId: input.organizationId,
      meetingId: meeting.id,
      userId: input.userId,
      organizationRole: input.organizationRole,
      baseUrl: input.baseUrl
    });
  }

  async addObservation(input: {
    organizationId: string;
    meetingId: string;
    userId: string;
    organizationRole: OrganizationRole;
    timestampSeconds: number;
    type: ObservationType;
    content: string;
  }): Promise<MeetingObservationView> {
    const meeting = await this.getMeetingForAccess({
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const observation = await prisma.meetingObservation.create({
      data: {
        meetingId: meeting.id,
        authorUserId: input.userId,
        timestampSeconds: input.timestampSeconds,
        type: input.type,
        content: input.content.trim()
      },
      include: {
        authorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    return this.mapObservation(observation);
  }

  async processMeeting(input: {
    organizationId: string;
    meetingId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<MeetingDetail> {
    const meetingAccess = await this.getMeetingForAccess({
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const meeting = await prisma.meeting.findUnique({
      where: {
        id: meetingAccess.id
      },
      select: {
        id: true,
        projectId: true,
        createdByUserId: true,
        title: true,
        audioPath: true
      }
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    if (!meeting.audioPath) {
      throw new AppError(400, 'A reunião ainda não possui áudio para processamento.');
    }

    await prisma.meeting.update({
      where: {
        id: meeting.id
      },
      data: {
        status: 'TRANSCRIBING'
      }
    });

    try {
      const transcription = await transcriptionRouterService.transcribe(resolveStoredFilePath(meeting.audioPath));

      await prisma.$transaction(async (tx) => {
        await tx.transcript.upsert({
          where: {
            meetingId: meeting.id
          },
          create: {
            meetingId: meeting.id,
            fullText: transcription.result.text,
            language: transcription.result.language,
            rawJson: transcription.result.raw as Prisma.InputJsonValue
          },
          update: {
            fullText: transcription.result.text,
            language: transcription.result.language,
            rawJson: transcription.result.raw as Prisma.InputJsonValue
          }
        });

        await tx.meeting.update({
          where: {
            id: meeting.id
          },
          data: {
            durationSeconds: transcription.result.durationSeconds,
            status: 'TRANSCRIBED'
          }
        });
      });

      await this.notifySafely('MEETING_TRANSCRIPTION_READY', () =>
        notificationEventService.notifyMeetingTranscriptionReady({
          organizationId: input.organizationId,
          projectId: meeting.projectId,
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          createdByUserId: meeting.createdByUserId
        })
      );

      await prisma.meeting.update({
        where: {
          id: meeting.id
        },
        data: {
          status: 'PROCESSING_AI'
        }
      });

      const observationsContext = await prisma.meetingObservation.findMany({
        where: {
          meetingId: meeting.id
        },
        select: {
          type: true,
          timestampSeconds: true,
          content: true,
          authorUser: {
            select: {
              name: true
            }
          }
        },
        orderBy: [{ timestampSeconds: 'asc' }, { createdAt: 'asc' }]
      });

      const analysis = await deepseekMeetingAnalysisService.analyzeMeeting(transcription.result.text, {
        observations: observationsContext.map((observation) => ({
          type: observation.type,
          timestampSeconds: observation.timestampSeconds,
          content: observation.content,
          authorName: observation.authorUser.name
        }))
      });
      const cardGeneration = await aiCardGeneratorService.generateCardsFromMeetingAnalysis({
        projectId: meeting.projectId,
        meetingId: meeting.id,
        createdByUserId: meeting.createdByUserId,
        actionItems: analysis.output.actionItems
      });

      await prisma.$transaction(async (tx) => {
        await tx.meetingNote.upsert({
          where: {
            meetingId: meeting.id
          },
          create: {
            meetingId: meeting.id,
            summary: analysis.output.summary,
            topicsJson: analysis.output.topics as Prisma.InputJsonValue,
            decisionsJson: analysis.output.decisions as Prisma.InputJsonValue,
            actionItemsJson: analysis.output.actionItems as Prisma.InputJsonValue,
            pendingItemsJson: analysis.output.pendingItems as Prisma.InputJsonValue,
            commentsJson: analysis.output.comments as Prisma.InputJsonValue,
            reportJson: {
              report: analysis.output.report,
              model: analysis.model,
              transcriptionEngine: transcription.engine,
              observationsUsed: observationsContext.length,
              cards: cardGeneration
            } as Prisma.InputJsonValue
          },
          update: {
            summary: analysis.output.summary,
            topicsJson: analysis.output.topics as Prisma.InputJsonValue,
            decisionsJson: analysis.output.decisions as Prisma.InputJsonValue,
            actionItemsJson: analysis.output.actionItems as Prisma.InputJsonValue,
            pendingItemsJson: analysis.output.pendingItems as Prisma.InputJsonValue,
            commentsJson: analysis.output.comments as Prisma.InputJsonValue,
            reportJson: {
              report: analysis.output.report,
              model: analysis.model,
              transcriptionEngine: transcription.engine,
              observationsUsed: observationsContext.length,
              cards: cardGeneration
            } as Prisma.InputJsonValue
          }
        });

        await tx.meeting.update({
          where: {
            id: meeting.id
          },
          data: {
            status: 'COMPLETED'
          }
        });
      });

      await aiSearchIndexService.indexMeetingById({
        organizationId: input.organizationId,
        meetingId: meeting.id
      });

      await this.notifySafely('MEETING_NOTES_READY', () =>
        notificationEventService.notifyMeetingNotesReady({
          organizationId: input.organizationId,
          projectId: meeting.projectId,
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          createdByUserId: meeting.createdByUserId
        })
      );
    } catch (error) {
      logger.error('Falha no processamento da reunião.', {
        meetingId: meeting.id,
        error: error instanceof Error ? error.message : error
      });

      await prisma.meeting.update({
        where: {
          id: meeting.id
        },
        data: {
          status: 'FAILED'
        }
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(500, 'Erro inesperado ao processar reunião.');
    }

    return this.getMeetingById({
      organizationId: input.organizationId,
      meetingId: meeting.id,
      userId: input.userId,
      organizationRole: input.organizationRole,
      baseUrl: input.baseUrl
    });
  }

  private async notifySafely(eventName: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      logger.warn('Falha ao registrar notificação de reunião.', {
        eventName,
        error: error instanceof Error ? error.message : error
      });
    }
  }
}

export const meetingsService = new MeetingsService();
