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
import {
  aiSearchRetrievalService,
  type AiSearchContextSource
} from './ai-search-retrieval.service';

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
  projectId: string | null;
  projectName: string | null;
  highlightTargetId: string | null;
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

export type AiSearchRawResultView = {
  id: string;
  sourceType: AiSearchSourceType;
  sourceId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  snippet: string;
  matchedText: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  score: number;
  highlightTargetId: string | null;
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

const parseHrefUrl = (href: string): URL | null => {
  try {
    return new URL(href, 'http://localhost');
  } catch {
    return null;
  }
};

const toRelativeHref = (url: URL): string => `${url.pathname}${url.search}${url.hash}`;

const extractProjectIdFromHref = (href: string): string | null => {
  const match = href.match(/\/projects\/([^/?#]+)/i);
  return match?.[1] ?? null;
};

const resolveHighlightTargetId = (
  sourceType: AiSearchSourceType,
  sourceId: string,
  href: string
): string | null => {
  const url = parseHrefUrl(href);
  const explicitHighlight = url?.searchParams.get('highlight')?.trim();

  if (explicitHighlight) {
    return explicitHighlight;
  }

  const cardId = url?.searchParams.get('card');

  switch (sourceType) {
    case 'CARD':
      return cardId ?? sourceId;
    case 'CARD_COMMENT':
      return cardId ?? null;
    case 'LIBRARY_ITEM':
    case 'FILE':
      return sourceId;
    case 'MEETING':
      return 'meeting-overview';
    case 'TRANSCRIPT':
      return 'meeting-transcription';
    case 'MEETING_NOTE':
    case 'DECISION':
      return 'meeting-decisions';
    case 'TASK':
      return 'meeting-tasks';
    default:
      return null;
  }
};

const buildSourceHref = (
  sourceType: AiSearchSourceType,
  sourceId: string,
  href: string
): string => {
  const url = parseHrefUrl(href);

  if (!url) {
    return href;
  }

  if (sourceType === 'FILE' && /\/projects\/[^/]+\/files$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/files$/i, '/library');
    url.searchParams.set('item', sourceId);
    url.searchParams.set('highlight', sourceId);
  }

  if (sourceType === 'LIBRARY_ITEM') {
    if (/\/projects\/[^/]+\/library$/i.test(url.pathname)) {
      url.searchParams.set('item', sourceId);
    }

    url.searchParams.set('highlight', sourceId);
  }

  if (sourceType === 'CARD') {
    url.searchParams.set('card', url.searchParams.get('card') ?? sourceId);
    url.searchParams.set('highlight', url.searchParams.get('card') ?? sourceId);
  }

  if (sourceType === 'CARD_COMMENT') {
    const cardId = url.searchParams.get('card');

    if (cardId) {
      url.searchParams.set('highlight', cardId);
    }
  }

  if (sourceType === 'MEETING') {
    url.searchParams.set('highlight', url.searchParams.get('highlight') ?? 'meeting-overview');
  }

  if (sourceType === 'TRANSCRIPT') {
    url.searchParams.set('highlight', url.searchParams.get('highlight') ?? 'meeting-transcription');
  }

  if (sourceType === 'MEETING_NOTE' || sourceType === 'DECISION') {
    url.searchParams.set('highlight', url.searchParams.get('highlight') ?? 'meeting-decisions');
  }

  if (sourceType === 'TASK') {
    url.searchParams.set('highlight', url.searchParams.get('highlight') ?? 'meeting-tasks');
  }

  return toRelativeHref(url);
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
  }, projectNamesById: Map<string, string> = new Map()): ThreadMessageView {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      answerJson: message.answerJson,
      createdAt: message.createdAt.toISOString(),
      sources: message.sources.map((source) => {
        const resolvedHref = buildSourceHref(source.sourceType, source.sourceId, source.href);
        const projectId = extractProjectIdFromHref(resolvedHref);

        return {
          id: source.id,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          title: source.title,
          href: resolvedHref,
          excerpt: source.excerpt,
          createdAt: source.createdAt.toISOString(),
          projectId,
          projectName: projectId ? (projectNamesById.get(projectId) ?? null) : null,
          highlightTargetId: resolveHighlightTargetId(source.sourceType, source.sourceId, resolvedHref)
        };
      })
    };
  }

  private async resolveProjectNames(input: {
    organizationId: string;
    sourceHrefs: string[];
  }): Promise<Map<string, string>> {
    const projectIds = [...new Set(input.sourceHrefs.map((href) => extractProjectIdFromHref(href)).filter(Boolean))] as string[];

    if (projectIds.length === 0) {
      return new Map();
    }

    const projects = await prisma.project.findMany({
      where: {
        organizationId: input.organizationId,
        id: {
          in: projectIds
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    return new Map(projects.map((project) => [project.id, project.name]));
  }

  private buildRawResultsFromRetrieval(input: {
    contextSources: AiSearchContextSource[];
    projectNamesById: Map<string, string>;
  }): AiSearchRawResultView[] {
    return input.contextSources.map((source) => {
      const url = buildSourceHref(source.sourceType, source.sourceId, source.href);
      const projectId = source.projectId ?? extractProjectIdFromHref(url);

      return {
        id: source.contextId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        projectId: projectId ?? null,
        projectName: projectId ? (input.projectNamesById.get(projectId) ?? null) : null,
        title: source.title,
        snippet: source.excerpt,
        matchedText: source.matchedText || source.excerpt,
        createdAt: source.createdAt ?? new Date().toISOString(),
        updatedAt: source.updatedAt ?? source.createdAt ?? new Date().toISOString(),
        url,
        score: source.score,
        highlightTargetId: source.highlightTargetId ?? resolveHighlightTargetId(source.sourceType, source.sourceId, url)
      };
    });
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
    organizationRole: OrganizationRole;
    projectId?: string;
    includeArchived?: boolean;
  }): Promise<ThreadSummary[]> {
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

    const threads = await prisma.aiSearchThread.findMany({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
        deletedAt: null,
        ...(input.projectId
          ? {
              projectId: input.projectId
            }
          : readableProjectIds
            ? {
                OR: [
                  {
                    projectId: null
                  },
                  {
                    projectId: {
                      in: readableProjectIds
                    }
                  }
                ]
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
    organizationRole: OrganizationRole;
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

    if (thread.scope === 'PROJECT' && thread.project?.id) {
      await this.assertProjectReadable({
        organizationId: input.organizationId,
        projectId: thread.project.id,
        userId: input.userId,
        organizationRole: input.organizationRole
      });
    }

    const projectNamesById = await this.resolveProjectNames({
      organizationId: input.organizationId,
      sourceHrefs: thread.messages.flatMap((message) => message.sources.map((source) => source.href))
    });

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
      messages: thread.messages.map((message) => this.mapThreadMessage(message, projectNamesById))
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
    scope: ThreadScope;
    projectId: string | null;
    answer: string;
    sources: ThreadMessageSourceView[];
    insufficientData: boolean;
    calledDeepSeek: boolean;
    rawResults: AiSearchRawResultView[];
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
    const startedAt = Date.now();

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

    const readableProjectIds = thread.scope === 'ORGANIZATION'
      ? await this.listReadableProjectIds({
          organizationId: input.organizationId,
          userId: input.userId,
          organizationRole: input.organizationRole
        })
      : null;

    const retrieval = reusableAssistant
      ? null
      : await aiSearchRetrievalService.search({
          organizationId: input.organizationId,
          ...(thread.scope === 'PROJECT' && thread.projectId
            ? {
                projectId: thread.projectId
              }
            : {}),
          ...(thread.scope === 'ORGANIZATION'
            ? {
                projectIds: readableProjectIds ?? undefined
              }
            : {}),
          query: question,
          maxCandidates: 20,
          maxSources: 10
        });
    const hasContextSources = Boolean(retrieval && retrieval.contextSources.length > 0);

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
            href: buildSourceHref(source.sourceType, source.sourceId, source.href),
            excerpt: source.excerpt ?? ''
          })),
          suggestedFollowUps: Array.isArray(
            (reusableAssistant.answerJson as Record<string, unknown> | null)?.suggestedFollowUps
          )
            ? (((reusableAssistant.answerJson as Record<string, unknown>).suggestedFollowUps as string[]) ?? []).slice(0, 4)
            : []
        }
      : hasContextSources
        ? await aiSearchAnswerService.generateAnswer({
            question,
            contextSources: retrieval!.contextSources,
            contextText: retrieval!.contextText
          })
        : {
            answer: aiSearchAnswerService.insufficientDataMessage(),
            confidence: 'LOW' as const,
            sources: [],
            suggestedFollowUps: []
          };

    const usedDeepSeek = Boolean(!reusableAssistant && hasContextSources);
    const insufficientData = Boolean(!reusableAssistant && !hasContextSources);

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
          data: assistantPayload.sources.map((source) => {
            const href = buildSourceHref(source.sourceType, source.sourceId, source.href);

            return {
              messageId: assistant.id,
              sourceType: source.sourceType,
              sourceId: source.sourceId,
              title: truncate(source.title, 191),
              href: truncate(href, 191),
              excerpt: source.excerpt || null
            };
          })
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

    const projectNamesById = await this.resolveProjectNames({
      organizationId: input.organizationId,
      sourceHrefs: createdAssistant.sources.map((source) => source.href)
    });

    const rawResults = retrieval
      ? this.buildRawResultsFromRetrieval({
          contextSources: retrieval.contextSources,
          projectNamesById
        })
      : createdAssistant.sources.map((source) => {
          const href = buildSourceHref(source.sourceType, source.sourceId, source.href);
          const projectId = extractProjectIdFromHref(href);

          return {
            id: source.id,
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            projectId,
            projectName: projectId ? (projectNamesById.get(projectId) ?? null) : null,
            title: source.title,
            snippet: source.excerpt ?? '',
            matchedText: source.excerpt ?? '',
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.createdAt.toISOString(),
            url: href,
            score: 0,
            highlightTargetId: resolveHighlightTargetId(source.sourceType, source.sourceId, href)
          } satisfies AiSearchRawResultView;
        });

    const accessibleProjectsCount =
      thread.scope === 'PROJECT'
        ? 1
        : readableProjectIds === null
          ? await prisma.project.count({
              where: {
                organizationId: input.organizationId
              }
            })
          : readableProjectIds.length;

    const resultsByType = rawResults.reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.sourceType] = (accumulator[entry.sourceType] ?? 0) + 1;
      return accumulator;
    }, {});

    console.info(
      '[ai-search]',
      JSON.stringify({
        organizationId: input.organizationId,
        userId: input.userId,
        threadId: input.threadId,
        scope: thread.scope,
        projectId: thread.projectId ?? null,
        questionLength: question.length,
        reusedAnswer: Boolean(reusableAssistant),
        usedDeepSeek,
        insufficientData,
        accessibleProjectsCount,
        candidatesCount: retrieval?.candidates.length ?? 0,
        contextSourcesCount: retrieval?.contextSources.length ?? 0,
        skippedDeepSeekReason: usedDeepSeek
          ? null
          : reusableAssistant
            ? 'reused-answer'
            : 'no-context-sources',
        resultsByType,
        latencyMs: Date.now() - startedAt
      })
    );

    const message = this.mapThreadMessage(createdAssistant, projectNamesById);

    return {
      threadId: thread.id,
      reused: Boolean(reusableAssistant),
      scope: thread.scope,
      projectId: thread.projectId ?? null,
      answer: message.content,
      sources: message.sources,
      insufficientData,
      calledDeepSeek: usedDeepSeek,
      rawResults,
      message
    };
  }

  async renameThread(input: {
    organizationId: string;
    userId: string;
    organizationRole: OrganizationRole;
    threadId: string;
    title: string;
  }): Promise<ThreadSummary> {
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
        projectId: true
      }
    });

    if (!thread) {
      throw new AppError(404, 'Histórico de pesquisa não encontrado para renomear.');
    }

    if (thread.scope === 'PROJECT' && thread.projectId) {
      await this.assertProjectReadable({
        organizationId: input.organizationId,
        projectId: thread.projectId,
        userId: input.userId,
        organizationRole: input.organizationRole
      });
    }

    const updated = await prisma.aiSearchThread.update({
      where: {
        id: input.threadId
      },
      data: {
        title: truncate(input.title.trim(), 160),
        updatedAt: new Date()
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

    return this.mapThreadSummary(updated);
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
