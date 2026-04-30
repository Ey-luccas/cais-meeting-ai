import type { AiSearchSourceType, Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';

type ChunkPayload = {
  title: string;
  content: string;
  summary?: string | null;
  href: string;
  metadataJson?: Prisma.InputJsonValue;
};

const TRANSCRIPT_CHUNK_MIN = 800;
const TRANSCRIPT_CHUNK_MAX = 1200;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const safeIso = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? normalizeWhitespace(entry) : ''))
    .filter((entry) => entry.length > 0);
};

type TaskEntry = {
  title: string;
  description: string | null;
  assignees: string[];
  dueDate: string | null;
  priority: string | null;
};

const toTaskArray = (value: unknown): TaskEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const title = typeof record.title === 'string' ? normalizeWhitespace(record.title) : '';

      if (!title) {
        return null;
      }

      return {
        title,
        description:
          typeof record.description === 'string' && record.description.trim().length > 0
            ? normalizeWhitespace(record.description)
            : null,
        assignees: toStringArray(record.assignees),
        dueDate: typeof record.dueDate === 'string' && record.dueDate.trim().length > 0 ? record.dueDate : null,
        priority: typeof record.priority === 'string' && record.priority.trim().length > 0 ? record.priority : null
      } satisfies TaskEntry;
    })
    .filter((entry): entry is TaskEntry => Boolean(entry));
};

const splitTranscriptIntoChunks = (value: string): string[] => {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return [];
  }

  if (normalized.length <= TRANSCRIPT_CHUNK_MAX) {
    return [normalized];
  }

  const sentenceLike = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const cleaned = normalizeWhitespace(current);

    if (cleaned) {
      chunks.push(cleaned);
    }

    current = '';
  };

  const appendSegment = (segment: string) => {
    if (!segment) {
      return;
    }

    if (!current) {
      current = segment;
      return;
    }

    const candidate = `${current} ${segment}`;

    if (candidate.length <= TRANSCRIPT_CHUNK_MAX) {
      current = candidate;
      return;
    }

    pushCurrent();
    current = segment;
  };

  for (const sentence of sentenceLike) {
    if (sentence.length <= TRANSCRIPT_CHUNK_MAX) {
      appendSegment(sentence);
      continue;
    }

    for (let cursor = 0; cursor < sentence.length; cursor += TRANSCRIPT_CHUNK_MAX) {
      const piece = sentence.slice(cursor, cursor + TRANSCRIPT_CHUNK_MAX);
      appendSegment(piece);
    }
  }

  pushCurrent();

  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];

    if (last.length < TRANSCRIPT_CHUNK_MIN) {
      chunks[chunks.length - 2] = `${chunks[chunks.length - 2]} ${last}`.trim();
      chunks.pop();
    }
  }

  return chunks;
};

export class AiSearchIndexService {
  private async replaceChunksBySource(input: {
    organizationId: string;
    sourceType: AiSearchSourceType;
    sourceId: string;
    projectId?: string | null;
    chunks: ChunkPayload[];
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.aiSearchChunk.deleteMany({
        where: {
          organizationId: input.organizationId,
          sourceType: input.sourceType,
          sourceId: input.sourceId
        }
      });

      if (input.chunks.length === 0) {
        return;
      }

      await tx.aiSearchChunk.createMany({
        data: input.chunks.map((chunk) => ({
          organizationId: input.organizationId,
          projectId: input.projectId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          title: chunk.title,
          content: chunk.content,
          summary: chunk.summary ?? null,
          href: chunk.href,
          metadataJson: chunk.metadataJson
        }))
      });
    });
  }

  async removeSourceChunks(input: {
    organizationId: string;
    sourceType: AiSearchSourceType;
    sourceId: string;
  }): Promise<void> {
    await prisma.aiSearchChunk.deleteMany({
      where: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId
      }
    });
  }

  async removeMeetingChunks(input: { organizationId: string; meetingId: string }): Promise<void> {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: input.meetingId,
        project: {
          organizationId: input.organizationId
        }
      },
      select: {
        id: true,
        note: {
          select: {
            id: true
          }
        },
        transcript: {
          select: {
            id: true
          }
        }
      }
    });

    if (!meeting) {
      return;
    }

    await this.removeSourceChunks({
      organizationId: input.organizationId,
      sourceType: 'MEETING',
      sourceId: meeting.id
    });

    if (meeting.transcript) {
      await this.removeSourceChunks({
        organizationId: input.organizationId,
        sourceType: 'TRANSCRIPT',
        sourceId: meeting.transcript.id
      });
    }

    if (meeting.note) {
      await Promise.all([
        this.removeSourceChunks({
          organizationId: input.organizationId,
          sourceType: 'MEETING_NOTE',
          sourceId: meeting.note.id
        }),
        this.removeSourceChunks({
          organizationId: input.organizationId,
          sourceType: 'DECISION',
          sourceId: meeting.note.id
        }),
        this.removeSourceChunks({
          organizationId: input.organizationId,
          sourceType: 'TASK',
          sourceId: meeting.note.id
        })
      ]);
    }
  }

  async removeCardChunks(input: { organizationId: string; cardId: string }): Promise<void> {
    await this.removeSourceChunks({
      organizationId: input.organizationId,
      sourceType: 'CARD',
      sourceId: input.cardId
    });

    await prisma.aiSearchChunk.deleteMany({
      where: {
        organizationId: input.organizationId,
        sourceType: 'CARD_COMMENT',
        metadataJson: {
          path: '$.cardId',
          equals: input.cardId
        }
      }
    });
  }

  async removeProjectFileChunks(input: { organizationId: string; fileId: string }): Promise<void> {
    await this.removeSourceChunks({
      organizationId: input.organizationId,
      sourceType: 'FILE',
      sourceId: input.fileId
    });
  }

  async removeLibraryItemChunks(input: { organizationId: string; itemId: string }): Promise<void> {
    await this.removeSourceChunks({
      organizationId: input.organizationId,
      sourceType: 'LIBRARY_ITEM',
      sourceId: input.itemId
    });
  }

  async removeProjectChunks(input: { organizationId: string; projectId: string }): Promise<void> {
    await prisma.aiSearchChunk.deleteMany({
      where: {
        organizationId: input.organizationId,
        OR: [{ projectId: input.projectId }, { sourceType: 'PROJECT', sourceId: input.projectId }]
      }
    });
  }

  async indexProjectById(input: { organizationId: string; projectId: string }): Promise<void> {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      include: {
        _count: {
          select: {
            meetings: true,
            cards: true,
            files: true,
            members: true
          }
        }
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado para indexação.');
    }

    const content = [
      `Projeto: ${project.name}`,
      project.description ? `Descrição: ${normalizeWhitespace(project.description)}` : null,
      `Membros: ${project._count.members}`,
      `Reuniões: ${project._count.meetings}`,
      `Cards: ${project._count.cards}`,
      `Arquivos: ${project._count.files}`
    ]
      .filter(Boolean)
      .join(' | ');

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'PROJECT',
      sourceId: project.id,
      projectId: project.id,
      chunks: [
        {
          title: project.name,
          content,
          summary: project.description,
          href: `/projects/${project.id}`,
          metadataJson: {
            entity: 'project',
            projectId: project.id,
            updatedAt: safeIso(project.updatedAt)
          }
        }
      ]
    });
  }

  async indexMeetingById(input: { organizationId: string; meetingId: string }): Promise<void> {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: input.meetingId,
        project: {
          organizationId: input.organizationId
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        transcript: true,
        note: true
      }
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada para indexação.');
    }

    const meetingHref = `/projects/${meeting.projectId}/meetings/${meeting.id}`;

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'MEETING',
      sourceId: meeting.id,
      projectId: meeting.projectId,
      chunks: [
        {
          title: meeting.title,
          content: [
            `Reunião: ${meeting.title}`,
            meeting.description ? `Descrição: ${normalizeWhitespace(meeting.description)}` : null,
            `Projeto: ${meeting.project.name}`,
            `Status: ${meeting.status}`
          ]
            .filter(Boolean)
            .join(' | '),
          summary: meeting.description,
          href: meetingHref,
          metadataJson: {
            entity: 'meeting',
            meetingId: meeting.id,
            projectId: meeting.projectId,
            status: meeting.status,
            createdAt: safeIso(meeting.createdAt),
            updatedAt: safeIso(meeting.updatedAt)
          }
        }
      ]
    });

    if (meeting.transcript) {
      const transcriptChunks = splitTranscriptIntoChunks(meeting.transcript.fullText);

      await this.replaceChunksBySource({
        organizationId: input.organizationId,
        sourceType: 'TRANSCRIPT',
        sourceId: meeting.transcript.id,
        projectId: meeting.projectId,
        chunks: transcriptChunks.map((chunk, index) => ({
          title: `Transcrição: ${meeting.title} (${index + 1}/${transcriptChunks.length})`,
          content: chunk,
          summary: chunk.slice(0, 380),
          href: meetingHref,
          metadataJson: {
            entity: 'transcript',
            meetingId: meeting.id,
            transcriptId: meeting.transcript?.id,
            projectId: meeting.projectId,
            language: meeting.transcript?.language ?? null,
            chunkIndex: index + 1,
            chunkTotal: transcriptChunks.length,
            createdAt: safeIso(meeting.transcript?.createdAt)
          }
        }))
      });
    }

    if (!meeting.note) {
      return;
    }

    const topics = toStringArray(meeting.note.topicsJson);
    const decisions = toStringArray(meeting.note.decisionsJson);
    const tasks = toTaskArray(meeting.note.actionItemsJson);
    const pendingItems = toStringArray(meeting.note.pendingItemsJson);
    const comments = toStringArray(meeting.note.commentsJson);

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'MEETING_NOTE',
      sourceId: meeting.note.id,
      projectId: meeting.projectId,
      chunks: [
        {
          title: `Notas IA: ${meeting.title}`,
          content: [
            `Resumo: ${normalizeWhitespace(meeting.note.summary)}`,
            topics.length > 0 ? `Tópicos: ${topics.join(' | ')}` : null,
            pendingItems.length > 0 ? `Pendências: ${pendingItems.join(' | ')}` : null,
            comments.length > 0 ? `Comentários: ${comments.join(' | ')}` : null
          ]
            .filter(Boolean)
            .join(' | '),
          summary: meeting.note.summary,
          href: meetingHref,
          metadataJson: {
            entity: 'meeting_note',
            meetingId: meeting.id,
            noteId: meeting.note.id,
            projectId: meeting.projectId,
            createdAt: safeIso(meeting.note.createdAt)
          }
        }
      ]
    });

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'DECISION',
      sourceId: meeting.note.id,
      projectId: meeting.projectId,
      chunks: decisions.map((decision, index) => ({
        title: `Decisão ${index + 1}: ${meeting.title}`,
        content: decision,
        summary: decision,
        href: meetingHref,
        metadataJson: {
          entity: 'decision',
          meetingId: meeting.id,
          noteId: meeting.note?.id,
          projectId: meeting.projectId,
          index,
          createdAt: safeIso(meeting.note?.createdAt)
        }
      }))
    });

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'TASK',
      sourceId: meeting.note.id,
      projectId: meeting.projectId,
      chunks: tasks.map((task, index) => ({
        title: `Tarefa ${index + 1}: ${task.title}`,
        content: [
          `Tarefa: ${task.title}`,
          task.description ? `Descrição: ${task.description}` : null,
          task.assignees.length > 0 ? `Responsáveis: ${task.assignees.join(', ')}` : null,
          task.priority ? `Prioridade: ${task.priority}` : null,
          task.dueDate ? `Prazo: ${task.dueDate}` : null
        ]
          .filter(Boolean)
          .join(' | '),
        summary: task.description,
        href: `/projects/${meeting.projectId}/board`,
        metadataJson: {
          entity: 'task',
          meetingId: meeting.id,
          noteId: meeting.note?.id,
          projectId: meeting.projectId,
          index,
          createdAt: safeIso(meeting.note?.createdAt)
        }
      }))
    });
  }

  async indexCardById(input: { organizationId: string; cardId: string }): Promise<void> {
    const card = await prisma.card.findFirst({
      where: {
        id: input.cardId,
        project: {
          organizationId: input.organizationId
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        boardColumn: {
          select: {
            title: true
          }
        },
        labels: {
          include: {
            label: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!card) {
      throw new AppError(404, 'Card não encontrado para indexação.');
    }

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'CARD',
      sourceId: card.id,
      projectId: card.projectId,
      chunks: [
        {
          title: card.title,
          content: [
            `Card: ${card.title}`,
            card.description ? `Descrição: ${normalizeWhitespace(card.description)}` : null,
            `Projeto: ${card.project.name}`,
            `Coluna: ${card.boardColumn.title}`,
            card.priority ? `Prioridade: ${card.priority}` : null,
            card.dueDate ? `Prazo: ${card.dueDate.toISOString()}` : null,
            card.labels.length > 0 ? `Etiquetas: ${card.labels.map((entry) => entry.label.name).join(', ')}` : null
          ]
            .filter(Boolean)
            .join(' | '),
          summary: card.description,
          href: `/projects/${card.projectId}/board?card=${card.id}`,
          metadataJson: {
            entity: 'card',
            cardId: card.id,
            projectId: card.projectId,
            meetingId: card.meetingId,
            sourceType: card.sourceType,
            updatedAt: safeIso(card.updatedAt)
          }
        }
      ]
    });
  }

  async indexCardCommentById(input: { organizationId: string; commentId: string }): Promise<void> {
    const comment = await prisma.cardComment.findFirst({
      where: {
        id: input.commentId,
        card: {
          project: {
            organizationId: input.organizationId
          }
        }
      },
      include: {
        card: {
          select: {
            id: true,
            title: true,
            projectId: true
          }
        },
        authorUser: {
          select: {
            name: true
          }
        }
      }
    });

    if (!comment) {
      throw new AppError(404, 'Comentário não encontrado para indexação.');
    }

    const content = normalizeWhitespace(comment.content);

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'CARD_COMMENT',
      sourceId: comment.id,
      projectId: comment.card.projectId,
      chunks: [
        {
          title: `Comentário no card ${comment.card.title}`,
          content,
          summary: content.slice(0, 420),
          href: `/projects/${comment.card.projectId}/board?card=${comment.card.id}`,
          metadataJson: {
            entity: 'card_comment',
            commentId: comment.id,
            cardId: comment.card.id,
            projectId: comment.card.projectId,
            authorName: comment.authorUser.name,
            createdAt: safeIso(comment.createdAt)
          }
        }
      ]
    });
  }

  async indexProjectFileById(input: { organizationId: string; fileId: string }): Promise<void> {
    const file = await prisma.projectFile.findFirst({
      where: {
        id: input.fileId,
        project: {
          organizationId: input.organizationId
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        uploadedByUser: {
          select: {
            name: true
          }
        }
      }
    });

    if (!file) {
      throw new AppError(404, 'Arquivo não encontrado para indexação.');
    }

    const content = [
      `Arquivo: ${file.name}`,
      `Projeto: ${file.project.name}`,
      file.description ? `Descrição: ${file.description}` : null,
      file.mimeType ? `Tipo: ${file.mimeType}` : null,
      file.sizeBytes ? `Tamanho: ${file.sizeBytes} bytes` : null,
      `Enviado por: ${file.uploadedByUser.name}`
    ]
      .filter(Boolean)
      .join(' | ');

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'FILE',
      sourceId: file.id,
      projectId: file.projectId,
      chunks: [
        {
          title: file.name,
          content,
          summary: `${file.name} (${file.project.name})`,
          href: `/projects/${file.projectId}/files`,
          metadataJson: {
            entity: 'file',
            fileId: file.id,
            projectId: file.projectId,
            uploadedAt: safeIso(file.createdAt)
          }
        }
      ]
    });
  }

  async indexLibraryItemById(input: { organizationId: string; itemId: string }): Promise<void> {
    const item = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        deletedAt: null,
        project: {
          organizationId: input.organizationId
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        meeting: {
          select: {
            id: true,
            title: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!item) {
      await this.removeLibraryItemChunks({
        organizationId: input.organizationId,
        itemId: input.itemId
      });
      return;
    }

    const href = item.type === 'DOCUMENT'
      ? `/projects/${item.projectId}/library/documents/${item.id}`
      : `/projects/${item.projectId}/library?item=${item.id}`;

    const content = [
      `Biblioteca: ${item.title}`,
      item.description ? `Descrição: ${normalizeWhitespace(item.description)}` : null,
      item.fileName ? `Arquivo: ${item.fileName}` : null,
      item.contentText ? `Conteúdo: ${normalizeWhitespace(item.contentText)}` : null,
      item.meeting ? `Reunião vinculada: ${item.meeting.title}` : null,
      `Projeto: ${item.project.name}`,
      `Tipo: ${item.type}`,
      `Origem: ${item.origin}`,
      `Status: ${item.status}`,
      item.tags.length > 0 ? `Etiquetas: ${item.tags.map((entry) => entry.tag.name).join(', ')}` : null
    ]
      .filter(Boolean)
      .join(' | ');

    await this.replaceChunksBySource({
      organizationId: input.organizationId,
      sourceType: 'LIBRARY_ITEM',
      sourceId: item.id,
      projectId: item.projectId,
      chunks: [
        {
          title: item.title,
          content,
          summary: item.description ?? item.contentText?.slice(0, 420) ?? null,
          href,
          metadataJson: {
            entity: 'library_item',
            libraryItemId: item.id,
            projectId: item.projectId,
            type: item.type,
            origin: item.origin,
            status: item.status,
            documentType: item.documentType,
            fileName: item.fileName,
            meetingId: item.meetingId,
            meetingTitle: item.meeting?.title ?? null,
            createdByUserId: item.createdByUserId,
            createdByUserName: item.createdByUser.name,
            tags: item.tags.map((entry) => ({
              id: entry.tag.id,
              name: entry.tag.name,
              color: entry.tag.color
            })),
            updatedAt: safeIso(item.updatedAt)
          }
        }
      ]
    });
  }

  async reindexProject(input: { organizationId: string; projectId: string }): Promise<{ indexed: number }> {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado para reindexação.');
    }

    const [meetings, cards, comments, files, libraryItems] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          projectId: input.projectId
        },
        select: {
          id: true
        }
      }),
      prisma.card.findMany({
        where: {
          projectId: input.projectId
        },
        select: {
          id: true
        }
      }),
      prisma.cardComment.findMany({
        where: {
          card: {
            projectId: input.projectId
          }
        },
        select: {
          id: true
        }
      }),
      prisma.projectFile.findMany({
        where: {
          projectId: input.projectId
        },
        select: {
          id: true
        }
      }),
      prisma.libraryItem.findMany({
        where: {
          projectId: input.projectId,
          deletedAt: null
        },
        select: {
          id: true
        }
      })
    ]);

    await this.indexProjectById({
      organizationId: input.organizationId,
      projectId: input.projectId
    });

    for (const meeting of meetings) {
      await this.indexMeetingById({
        organizationId: input.organizationId,
        meetingId: meeting.id
      });
    }

    for (const card of cards) {
      await this.indexCardById({
        organizationId: input.organizationId,
        cardId: card.id
      });
    }

    for (const comment of comments) {
      await this.indexCardCommentById({
        organizationId: input.organizationId,
        commentId: comment.id
      });
    }

    for (const file of files) {
      await this.indexProjectFileById({
        organizationId: input.organizationId,
        fileId: file.id
      });
    }

    for (const item of libraryItems) {
      await this.indexLibraryItemById({
        organizationId: input.organizationId,
        itemId: item.id
      });
    }

    return {
      indexed: 1 + meetings.length + cards.length + comments.length + files.length + libraryItems.length
    };
  }

  async reindexOrganization(input: { organizationId: string }): Promise<{ projects: number; indexed: number }> {
    const projects = await prisma.project.findMany({
      where: {
        organizationId: input.organizationId
      },
      select: {
        id: true
      }
    });

    let indexed = 0;

    for (const project of projects) {
      const result = await this.reindexProject({
        organizationId: input.organizationId,
        projectId: project.id
      });

      indexed += result.indexed;
    }

    return {
      projects: projects.length,
      indexed
    };
  }
}

export const aiSearchIndexService = new AiSearchIndexService();
