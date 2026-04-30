import type {
  AiSearchMessageRole,
  AiSearchScope,
  AiSearchSourceType,
  AiSearchThreadStatus,
  OrganizationRole,
  Prisma
} from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { aiSearchAnswerService } from './ai-search-answer.service';
import { aiSearchRetrievalService } from './ai-search-retrieval.service';

type ThreadScope = 'ORGANIZATION' | 'PROJECT';

type ThreadSummary = {
  id: string;
  title: string;
  scope: AiSearchScope;
  status: AiSearchThreadStatus;
  project: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  lastMessagePreview: string | null;
};

export type ThreadMessageSourceView = {
  id: string;
  sourceType: AiSearchSourceType;
  sourceId: string;
  title: string;
  href: string;
  excerpt: string | null;
  createdAt: string;
};

export type ThreadMessageView = {
  id: string;
  role: AiSearchMessageRole;
  content: string;
  answerJson: Prisma.JsonValue | null;
  createdAt: string;
  sources: ThreadMessageSourceView[];
};

export type ThreadDetailView = {
  id: string;
  title: string;
  scope: AiSearchScope;
  status: AiSearchThreadStatus;
  project: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  messages: ThreadMessageView[];
};

const defaultThreadTitle = 'Nova pesquisa';

const normalize = (value: string): string => value.trim().toLowerCase();

const truncate = (value: string, max: number): string => {
  const normalized = value.trim();

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1)}…`;
};

export class AiSearchThreadService {
  private async assertProjectReadable(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<{ id: string; name: string }> {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        name: true,
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
      return {
        id: project.id,
        name: project.name
      };
    }

    if (!project.members[0]) {
      throw new AppError(403, 'Você não tem acesso a este projeto.');
    }

    return {
      id: project.id,
      name: project.name
    };
  }

  private async listReadableProjectIds(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<string[] | null> {
    if (input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN') {
      return null;
    }

    const memberships = await prisma.projectMember.findMany({
      where: {
        project: {
          organizationId: input.organizationId
        },
        userId: input.userId
      },
      select: {
        projectId: true
      }
    });

    return memberships.map((entry) => entry.projectId);
  }

  private mapThreadSummary(thread: {
    id: string;
    title: string;
    scope: AiSearchScope;
    status: AiSearchThreadStatus;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    project: {
      id: string;
      name: string;
    } | null;
    messages: Array<{
      role: AiSearchMessageRole;
      content: string;
      createdAt: Date;
    }>;
  }): ThreadSummary {
    const lastMessage = thread.messages[0] ?? null;

    return {
      id: thread.id,
      title: thread.title,
      scope: thread.scope,
      status: thread.status,
      project: thread.project
        ? {
            id: thread.project.id,
            name: thread.project.name
          }
        : null,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      archivedAt: thread.archivedAt?.toISOString() ?? null,
      lastMessagePreview: lastMessage ? truncate(lastMessage.content, 180) : null
    };
  }

  private mapThreadMessage(message: {
    id: string;
    role: AiSearchMessageRole;
    content: string;
    answerJson: Prisma.JsonValue | null;
    createdAt: Date;
    sources: Array<{
      id: string;
      sourceType: AiSearchSourceType;
      sourceId: string;
      title: string;
      href: string;
      excerpt: string | null;
      createdAt: Date;
    }>;
  }): ThreadMessageView {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      answerJson: message.answerJson,
      createdAt: message.createdAt.toISOString(),
      sources: message.sources.map((source) => ({
        id: source.id,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        title: source.title,
        href: source.href,
        excerpt: source.excerpt,
        createdAt: source.createdAt.toISOString()
      }))
    };
  }

  async createThread(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    scope: ThreadScope;
    projectId?: string;
    title?: string;
  }): Promise<ThreadSummary> {
    let project:
      | {
          id: string;
          name: string;
        }
      | null = null;

    if (input.scope === 'PROJECT') {
      if (!input.projectId) {
        throw new AppError(400, 'projectId é obrigatório para escopo de projeto.');
      }

      project = await this.assertProjectReadable({
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: input.userId,
        organizationRole: input.organizationRole
      });
    }

    const created = await prisma.aiSearchThread.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        projectId: project?.id ?? null,
        scope: input.scope,
        status: 'ACTIVE',
        title: truncate(input.title?.trim() || defaultThreadTitle, 160)
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            role: true,
            content: true,
            createdAt: true
          }
        }
      }
    });

    return this.mapThreadSummary(created);
  }

  async listThreads(input: {
    organizationId: string;
    userId: string;
    projectId?: string;
    includeArchived?: boolean;
  }): Promise<ThreadSummary[]> {
    const threads = await prisma.aiSearchThread.findMany({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
        deletedAt: null,
        ...(input.projectId
          ? {
              projectId: input.projectId
            }
          : {}),
        ...(input.includeArchived
          ? {}
          : {
              status: 'ACTIVE',
              archivedAt: null
            })
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            role: true,
            content: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return threads.map((thread) => this.mapThreadSummary(thread));
  }

  async getThread(input: {
    organizationId: string;
    userId: string;
    threadId: string;
  }): Promise<ThreadDetailView> {
    const thread = await prisma.aiSearchThread.findFirst({
      where: {
        id: input.threadId,
        organizationId: input.organizationId,
        userId: input.userId,
        deletedAt: null
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        messages: {
          include: {
            sources: {
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!thread) {
      throw new AppError(404, 'Histórico de pesquisa não encontrado.');
    }

    return {
      id: thread.id,
      title: thread.title,
      scope: thread.scope,
      status: thread.status,
      project: thread.project
        ? {
            id: thread.project.id,
            name: thread.project.name
          }
        : null,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      archivedAt: thread.archivedAt?.toISOString() ?? null,
      messages: thread.messages.map((message) => this.mapThreadMessage(message))
    };
  }

  async askInThread(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    threadId: string;
    question: string;
    scope?: ThreadScope;
    projectId?: string;
  }): Promise<{
    threadId: string;
    reused: boolean;
    message: ThreadMessageView;
  }> {
    const question = input.question.trim();

    if (!question) {
      throw new AppError(400, 'A pergunta não pode estar vazia.');
    }

    const thread = await prisma.aiSearchThread.findFirst({
      where: {
        id: input.threadId,
        organizationId: input.organizationId,
        userId: input.userId,
        deletedAt: null
      },
      select: {
        id: true,
        scope: true,
        status: true,
        projectId: true,
        title: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!thread) {
      throw new AppError(404, 'Histórico de pesquisa não encontrado.');
    }

    if (input.scope && input.scope !== thread.scope) {
      throw new AppError(400, 'Escopo informado não corresponde ao escopo do histórico.');
    }

    if (thread.scope === 'PROJECT') {
      if (input.projectId && input.projectId !== thread.projectId) {
        throw new AppError(400, 'projectId informado não corresponde ao histórico de pesquisa.');
      }
    } else if (thread.scope === 'ORGANIZATION' && input.projectId) {
      throw new AppError(400, 'projectId não deve ser enviado para histórico de escopo de organização.');
    }

    if (thread.status === 'ARCHIVED') {
      throw new AppError(409, 'Este histórico está arquivado. Crie uma nova pesquisa para continuar.');
    }

    if (thread.scope === 'PROJECT') {
      if (!thread.projectId) {
        throw new AppError(409, 'Histórico de projeto sem referência de projeto.');
      }

      await this.assertProjectReadable({
        organizationId: input.organizationId,
        projectId: thread.projectId,
        userId: input.userId,
        organizationRole: input.organizationRole
      });
    }

    const [existingMessages, latestChunk] = await Promise.all([
      prisma.aiSearchMessage.findMany({
        where: {
          threadId: thread.id
        },
        include: {
          sources: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      }),
      prisma.aiSearchChunk.findFirst({
        where: {
          organizationId: input.organizationId,
          ...(thread.scope === 'PROJECT' && thread.projectId
            ? {
                projectId: thread.projectId
              }
            : {})
        },
        orderBy: {
          updatedAt: 'desc'
        },
        select: {
          updatedAt: true
        }
      })
    ]);

    const normalizedQuestion = normalize(question);
    const latestChunkUpdatedAt = latestChunk?.updatedAt ?? null;

    let reusableAssistant: (typeof existingMessages)[number] | null = null;

    for (let index = existingMessages.length - 2; index >= 0; index -= 1) {
      const message = existingMessages[index];
      const next = existingMessages[index + 1];

      if (message.role !== 'USER' || next.role !== 'ASSISTANT') {
        continue;
      }

      if (normalize(message.content) !== normalizedQuestion) {
        continue;
      }

      if (latestChunkUpdatedAt && next.createdAt < latestChunkUpdatedAt) {
        continue;
      }

      reusableAssistant = next;
      break;
    }

    const retrieval = reusableAssistant
      ? null
      : await aiSearchRetrievalService.search({
          organizationId: input.organizationId,
          ...(thread.scope === 'PROJECT' && thread.projectId
            ? {
                projectId: thread.projectId
              }
            : {}),
          query: question,
          maxCandidates: 20,
          maxSources: 10
        });

    const assistantPayload = reusableAssistant
      ? {
          answer:
            reusableAssistant.content ||
            aiSearchAnswerService.insufficientDataMessage(),
          confidence: (((reusableAssistant.answerJson as Record<string, unknown> | null)?.confidence as string) ??
            'LOW') as 'LOW' | 'MEDIUM' | 'HIGH',
          sources: reusableAssistant.sources.map((source) => ({
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            title: source.title,
            href: source.href,
            excerpt: source.excerpt ?? ''
          })),
          suggestedFollowUps: Array.isArray(
            (reusableAssistant.answerJson as Record<string, unknown> | null)?.suggestedFollowUps
          )
            ? (((reusableAssistant.answerJson as Record<string, unknown>).suggestedFollowUps as string[]) ?? []).slice(0, 4)
            : []
        }
      : retrieval && retrieval.contextSources.length > 0
        ? await aiSearchAnswerService.generateAnswer({
            question,
            contextSources: retrieval.contextSources,
            contextText: retrieval.contextText
          })
        : {
            answer: aiSearchAnswerService.insufficientDataMessage(),
            confidence: 'LOW' as const,
            sources: [],
            suggestedFollowUps: []
          };

    const titleShouldUpdate = thread.title.trim() === defaultThreadTitle && existingMessages.length === 0;

    const createdAssistant = await prisma.$transaction(async (tx) => {
      await tx.aiSearchMessage.create({
        data: {
          threadId: thread.id,
          role: 'USER',
          content: question
        }
      });

      const answerJson: Prisma.InputJsonValue = {
        answer: assistantPayload.answer,
        confidence: assistantPayload.confidence,
        suggestedFollowUps: assistantPayload.suggestedFollowUps
      };

      const assistant = await tx.aiSearchMessage.create({
        data: {
          threadId: thread.id,
          role: 'ASSISTANT',
          content: assistantPayload.answer,
          answerJson
        }
      });

      if (assistantPayload.sources.length > 0) {
        await tx.aiSearchMessageSource.createMany({
          data: assistantPayload.sources.map((source) => ({
            messageId: assistant.id,
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            title: truncate(source.title, 191),
            href: truncate(source.href, 191),
            excerpt: source.excerpt || null
          }))
        });
      }

      await tx.aiSearchThread.update({
        where: {
          id: thread.id
        },
        data: {
          updatedAt: new Date(),
          ...(titleShouldUpdate
            ? {
                title: truncate(question, 160)
              }
            : {})
        }
      });

      return tx.aiSearchMessage.findUniqueOrThrow({
        where: {
          id: assistant.id
        },
        include: {
          sources: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });
    });

    return {
      threadId: thread.id,
      reused: Boolean(reusableAssistant),
      message: this.mapThreadMessage(createdAssistant)
    };
  }

  async archiveThread(input: {
    organizationId: string;
    userId: string;
    threadId: string;
  }): Promise<ThreadSummary> {
    const updated = await prisma.aiSearchThread.updateMany({
      where: {
        id: input.threadId,
        organizationId: input.organizationId,
        userId: input.userId,
        deletedAt: null
      },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date()
      }
    });

    if (updated.count === 0) {
      throw new AppError(404, 'Histórico de pesquisa não encontrado para arquivar.');
    }

    const thread = await prisma.aiSearchThread.findUnique({
      where: {
        id: input.threadId
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            role: true,
            content: true,
            createdAt: true
          }
        }
      }
    });

    if (!thread) {
      throw new AppError(404, 'Histórico de pesquisa não encontrado após arquivar.');
    }

    return this.mapThreadSummary(thread);
  }

  async deleteThread(input: {
    organizationId: string;
    userId: string;
    threadId: string;
  }): Promise<void> {
    const updated = await prisma.aiSearchThread.updateMany({
      where: {
        id: input.threadId,
        organizationId: input.organizationId,
        userId: input.userId,
        deletedAt: null
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date()
      }
    });

    if (updated.count === 0) {
      throw new AppError(404, 'Histórico de pesquisa não encontrado para exclusão.');
    }
  }

  async getSuggestions(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    projectId?: string;
  }): Promise<string[]> {
    if (input.projectId) {
      await this.assertProjectReadable({
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: input.userId,
        organizationRole: input.organizationRole
      });
    }

    const readableProjectIds = await this.listReadableProjectIds({
      organizationId: input.organizationId,
      userId: input.userId,
      organizationRole: input.organizationRole
    });

    const [projects, meetings, files] = await Promise.all([
      prisma.project.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.projectId
            ? {
                id: input.projectId
              }
            : readableProjectIds
              ? {
                  id: {
                    in: readableProjectIds
                  }
                }
              : {})
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 4,
        select: {
          id: true,
          name: true
        }
      }),
      prisma.meeting.findMany({
        where: {
          project: {
            organizationId: input.organizationId,
            ...(input.projectId
              ? {
                  id: input.projectId
                }
              : readableProjectIds
                ? {
                    id: {
                      in: readableProjectIds
                    }
                  }
                : {})
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 4,
        select: {
          title: true,
          project: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.projectFile.findMany({
        where: {
          project: {
            organizationId: input.organizationId,
            ...(input.projectId
              ? {
                  id: input.projectId
                }
              : readableProjectIds
                ? {
                    id: {
                      in: readableProjectIds
                    }
                  }
                : {})
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 2,
        select: {
          project: {
            select: {
              name: true
            }
          }
        }
      })
    ]);

    const suggestions: string[] = [];

    if (meetings[0]) {
      suggestions.push(`O que foi discutido na reunião "${meetings[0].title}"?`);
      suggestions.push(`Quais decisões saíram da reunião "${meetings[0].title}"?`);
    }

    if (projects[0]) {
      suggestions.push(`Quais tarefas ainda estão pendentes no projeto "${projects[0].name}"?`);
      suggestions.push(`Quais cards vieram de reuniões no projeto "${projects[0].name}"?`);
    }

    if (files[0]) {
      suggestions.push(`Quais arquivos foram adicionados recentemente no projeto "${files[0].project.name}"?`);
    }

    if (projects[1]) {
      suggestions.push(`Quais são os principais tópicos citados no projeto "${projects[1].name}"?`);
    }

    if (suggestions.length === 0) {
      return [];
    }

    const unique = [...new Set(suggestions.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];

    return unique.slice(0, 6);
  }
}

export const aiSearchThreadService = new AiSearchThreadService();
