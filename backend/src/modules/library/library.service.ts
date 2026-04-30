import { Prisma } from '@prisma/client';
import type {
  LibraryDocumentType,
  LibraryItemOrigin,
  LibraryItemStatus,
  LibraryItemType,
  OrganizationRole,
  ProjectRole
} from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { toPublicFileUrl } from '../../shared/storage';
import { aiSearchIndexService } from '../ai-search/ai-search-index.service';
import { notificationEventService } from '../notifications/notification-event.service';
import { libraryAiService } from './library-ai.service';

type ProjectAccessLevel = 'read' | 'write' | 'admin';

type LibraryItemListRecord = Prisma.LibraryItemGetPayload<{
  include: {
    folder: true;
    meeting: {
      select: {
        id: true;
        title: true;
      };
    };
    tags: {
      include: {
        tag: true;
      };
    };
    createdByUser: {
      select: {
        id: true;
        name: true;
        email: true;
        avatarUrl: true;
      };
    };
    updatedByUser: {
      select: {
        id: true;
        name: true;
        email: true;
        avatarUrl: true;
      };
    };
  };
}>;

type LibraryItemDetailRecord = Prisma.LibraryItemGetPayload<{
  include: {
    folder: true;
    meeting: {
      select: {
        id: true;
        title: true;
      };
    };
    tags: {
      include: {
        tag: true;
      };
    };
    versions: {
      orderBy: {
        createdAt: 'desc';
      };
      take: 25;
    };
    createdByUser: {
      select: {
        id: true;
        name: true;
        email: true;
        avatarUrl: true;
      };
    };
    updatedByUser: {
      select: {
        id: true;
        name: true;
        email: true;
        avatarUrl: true;
      };
    };
  };
}>;

type LibraryItemSummaryView = {
  id: string;
  projectId: string;
  folderId: string | null;
  meetingId: string | null;
  title: string;
  description: string | null;
  type: LibraryItemType;
  origin: LibraryItemOrigin;
  status: LibraryItemStatus;
  documentType: LibraryDocumentType | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  folder: {
    id: string;
    name: string;
    parentId: string | null;
  } | null;
  meeting: {
    id: string;
    title: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  updatedBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type LibraryItemDetailView = LibraryItemSummaryView & {
  contentMarkdown: string | null;
  contentText: string | null;
  contentJson: Prisma.JsonValue | null;
  versions: Array<{
    id: string;
    createdByUserId: string;
    createdAt: string;
    contentMarkdown: string | null;
    contentText: string | null;
    contentJson: Prisma.JsonValue | null;
  }>;
};

type ProjectAccessContext = {
  id: string;
  name: string;
  canWrite: boolean;
  canAdmin: boolean;
  canReadDraft: boolean;
  projectRole: ProjectRole | null;
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const toPlainTextFromMarkdown = (value: string): string => {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^>\s?/gm, '')
    .replace(/^#+\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/gm, '')
    .trim();
};

const roleCanWrite = (role: ProjectRole | null): boolean => role !== null && role !== 'VIEWER';
const roleCanAdmin = (role: ProjectRole | null): boolean => role === 'OWNER' || role === 'ADMIN';

const toPrismaJsonInput = (
  value: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
};

export class LibraryService {
  private async assertProjectAccess(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    required: ProjectAccessLevel;
  }): Promise<ProjectAccessContext> {
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

    const isOrgAdmin = input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN';
    const projectRole = project.members[0]?.role ?? null;

    if (!isOrgAdmin && !projectRole) {
      throw new AppError(403, 'Você não tem acesso a este projeto.');
    }

    const canWrite = isOrgAdmin || roleCanWrite(projectRole);
    const canAdmin = isOrgAdmin || roleCanAdmin(projectRole);
    const canReadDraft = canWrite;

    if (input.required === 'write' && !canWrite) {
      throw new AppError(403, 'Seu perfil não pode alterar a biblioteca deste projeto.');
    }

    if (input.required === 'admin' && !canAdmin) {
      throw new AppError(403, 'Somente ADMIN/OWNER pode gerenciar esta ação da biblioteca.');
    }

    return {
      id: project.id,
      name: project.name,
      canWrite,
      canAdmin,
      canReadDraft,
      projectRole
    };
  }

  private async assertFolderBelongsToProject(projectId: string, folderId: string): Promise<void> {
    const folder = await prisma.libraryFolder.findFirst({
      where: {
        id: folderId,
        projectId
      },
      select: {
        id: true
      }
    });

    if (!folder) {
      throw new AppError(404, 'Pasta não encontrada no projeto.');
    }
  }

  private async assertTagsBelongToProject(projectId: string, tagIds: string[]): Promise<string[]> {
    const normalized = unique(tagIds.filter(Boolean));

    if (normalized.length === 0) {
      return [];
    }

    const found = await prisma.libraryTag.findMany({
      where: {
        projectId,
        id: {
          in: normalized
        }
      },
      select: {
        id: true
      }
    });

    if (found.length !== normalized.length) {
      throw new AppError(404, 'Uma ou mais etiquetas não pertencem a este projeto.');
    }

    return normalized;
  }

  private async getItemForAccess(input: {
    projectId: string;
    itemId: string;
    canReadDraft: boolean;
  }): Promise<LibraryItemDetailRecord> {
    const item = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        projectId: input.projectId,
        deletedAt: null,
        ...(input.canReadDraft
          ? {}
          : {
              status: 'PUBLISHED' as const
            })
      },
      include: {
        folder: true,
        meeting: {
          select: {
            id: true,
            title: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        versions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 25
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        updatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!item) {
      throw new AppError(404, 'Item da biblioteca não encontrado.');
    }

    return item;
  }

  private mapItemSummary(item: LibraryItemListRecord, baseUrl: string): LibraryItemSummaryView {
    return {
      id: item.id,
      projectId: item.projectId,
      folderId: item.folderId,
      meetingId: item.meetingId,
      title: item.title,
      description: item.description,
      type: item.type,
      origin: item.origin,
      status: item.status,
      documentType: item.documentType,
      fileName: item.fileName,
      fileUrl: item.filePath ? toPublicFileUrl(baseUrl, item.filePath) : null,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      archivedAt: item.archivedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      folder: item.folder
        ? {
            id: item.folder.id,
            name: item.folder.name,
            parentId: item.folder.parentId
          }
        : null,
      meeting: item.meeting
        ? {
            id: item.meeting.id,
            title: item.meeting.title
          }
        : null,
      tags: item.tags.map((entry) => ({
        id: entry.tag.id,
        name: entry.tag.name,
        color: entry.tag.color
      })),
      createdBy: {
        id: item.createdByUser.id,
        name: item.createdByUser.name,
        email: item.createdByUser.email,
        avatarUrl: item.createdByUser.avatarUrl
      },
      updatedBy: item.updatedByUser
        ? {
            id: item.updatedByUser.id,
            name: item.updatedByUser.name,
            email: item.updatedByUser.email,
            avatarUrl: item.updatedByUser.avatarUrl
          }
        : null
    };
  }

  private mapItemDetail(item: LibraryItemDetailRecord, baseUrl: string): LibraryItemDetailView {
    const summary = this.mapItemSummary(item, baseUrl);

    return {
      ...summary,
      contentMarkdown: item.contentMarkdown,
      contentText: item.contentText,
      contentJson: item.contentJson,
      versions: item.versions.map((version) => ({
        id: version.id,
        createdByUserId: version.createdByUserId,
        createdAt: version.createdAt.toISOString(),
        contentMarkdown: version.contentMarkdown,
        contentText: version.contentText,
        contentJson: version.contentJson
      }))
    };
  }

  private async createDocumentVersion(input: {
    itemId: string;
    createdByUserId: string;
    contentMarkdown: string | null;
    contentText: string | null;
    contentJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }): Promise<void> {
    await prisma.libraryItemVersion.create({
      data: {
        libraryItemId: input.itemId,
        createdByUserId: input.createdByUserId,
        contentMarkdown: input.contentMarkdown,
        contentText: input.contentText,
        contentJson: input.contentJson
      }
    });
  }

  private async indexItemSafely(input: { organizationId: string; itemId: string }): Promise<void> {
    try {
      await aiSearchIndexService.indexLibraryItemById({
        organizationId: input.organizationId,
        itemId: input.itemId
      });
    } catch (error) {
      logger.warn('Falha ao indexar item da biblioteca na Pesquisa IA.', {
        itemId: input.itemId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async removeItemIndexSafely(input: { organizationId: string; itemId: string }): Promise<void> {
    try {
      await aiSearchIndexService.removeLibraryItemChunks({
        organizationId: input.organizationId,
        itemId: input.itemId
      });
    } catch (error) {
      logger.warn('Falha ao remover índice de item da biblioteca na Pesquisa IA.', {
        itemId: input.itemId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async notifySafely(eventName: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      logger.warn('Falha ao registrar notificação da biblioteca.', {
        eventName,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async notifyLibraryEvent(input: {
    organizationId: string;
    projectId: string;
    title: string;
    message: string;
    targetId: string;
    targetHref: string;
  }): Promise<void> {
    await notificationEventService.createNotification({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: null,
      title: input.title,
      message: input.message,
      type: 'SYSTEM',
      channel: 'IN_APP',
      targetType: 'library_item',
      targetId: input.targetId,
      targetHref: input.targetHref
    });
  }

  async listItems(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
    q?: string;
    type?: LibraryItemType;
    origin?: LibraryItemOrigin;
    status?: LibraryItemStatus;
    folderId?: string;
    tagId?: string;
  }): Promise<{ items: LibraryItemSummaryView[] }> {
    const access = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'read'
    });

    if (!access.canReadDraft && input.status && input.status !== 'PUBLISHED') {
      return { items: [] };
    }

    const where: Prisma.LibraryItemWhereInput = {
      projectId: input.projectId,
      deletedAt: null,
      ...(access.canReadDraft
        ? {}
        : {
            status: 'PUBLISHED'
          }),
      ...(input.type
        ? {
            type: input.type
          }
        : {}),
      ...(input.origin
        ? {
            origin: input.origin
          }
        : {}),
      ...(input.status
        ? {
            status: input.status
          }
        : {}),
      ...(input.folderId
        ? {
            folderId: input.folderId
          }
        : {}),
      ...(input.tagId
        ? {
            tags: {
              some: {
                tagId: input.tagId
              }
            }
          }
        : {})
    };

    const q = input.q?.trim();

    if (q) {
      where.OR = [
        {
          title: {
            contains: q
          }
        },
        {
          description: {
            contains: q
          }
        },
        {
          contentText: {
            contains: q
          }
        },
        {
          fileName: {
            contains: q
          }
        }
      ];
    }

    const items = await prisma.libraryItem.findMany({
      where,
      include: {
        folder: true,
        meeting: {
          select: {
            id: true,
            title: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        updatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 200
    });

    return {
      items: items.map((item) => this.mapItemSummary(item, input.baseUrl))
    };
  }

  async listFolders(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<
    Array<{
      id: string;
      projectId: string;
      name: string;
      parentId: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'read'
    });

    const folders = await prisma.libraryFolder.findMany({
      where: {
        projectId: input.projectId
      },
      orderBy: [{ name: 'asc' }]
    });

    return folders.map((folder) => ({
      id: folder.id,
      projectId: folder.projectId,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    }));
  }

  async createFolder(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    name: string;
    parentId?: string | null;
  }): Promise<{
    id: string;
    projectId: string;
    name: string;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    if (input.parentId) {
      await this.assertFolderBelongsToProject(input.projectId, input.parentId);
    }

    const folder = await prisma.libraryFolder.create({
      data: {
        projectId: input.projectId,
        name: input.name.trim(),
        parentId: input.parentId ?? null
      }
    });

    return {
      id: folder.id,
      projectId: folder.projectId,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    };
  }

  async updateFolder(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    folderId: string;
    name?: string;
    parentId?: string | null;
  }): Promise<{
    id: string;
    projectId: string;
    name: string;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    const existing = await prisma.libraryFolder.findFirst({
      where: {
        id: input.folderId,
        projectId: input.projectId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      throw new AppError(404, 'Pasta não encontrada no projeto.');
    }

    if (input.parentId && input.parentId === input.folderId) {
      throw new AppError(400, 'A pasta não pode ser pai dela mesma.');
    }

    if (input.parentId) {
      await this.assertFolderBelongsToProject(input.projectId, input.parentId);
    }

    const folder = await prisma.libraryFolder.update({
      where: {
        id: input.folderId
      },
      data: {
        name: input.name?.trim() || undefined,
        ...(input.parentId !== undefined
          ? {
              parentId: input.parentId
            }
          : {})
      }
    });

    return {
      id: folder.id,
      projectId: folder.projectId,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    };
  }

  async deleteFolder(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    folderId: string;
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    const folder = await prisma.libraryFolder.findFirst({
      where: {
        id: input.folderId,
        projectId: input.projectId
      },
      select: {
        id: true,
        _count: {
          select: {
            children: true,
            items: true
          }
        }
      }
    });

    if (!folder) {
      throw new AppError(404, 'Pasta não encontrada no projeto.');
    }

    if (folder._count.children > 0 || folder._count.items > 0) {
      throw new AppError(409, 'A pasta possui subpastas ou itens vinculados.');
    }

    await prisma.libraryFolder.delete({
      where: {
        id: folder.id
      }
    });
  }

  async listTags(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<
    Array<{
      id: string;
      projectId: string;
      name: string;
      color: string;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'read'
    });

    const tags = await prisma.libraryTag.findMany({
      where: {
        projectId: input.projectId
      },
      orderBy: {
        name: 'asc'
      }
    });

    return tags.map((tag) => ({
      id: tag.id,
      projectId: tag.projectId,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    }));
  }

  async createTag(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    name: string;
    color: string;
  }): Promise<{
    id: string;
    projectId: string;
    name: string;
    color: string;
    createdAt: string;
    updatedAt: string;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    const tag = await prisma.libraryTag.create({
      data: {
        projectId: input.projectId,
        name: input.name.trim(),
        color: input.color.trim()
      }
    });

    return {
      id: tag.id,
      projectId: tag.projectId,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    };
  }

  async updateTag(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    tagId: string;
    name?: string;
    color?: string;
  }): Promise<{
    id: string;
    projectId: string;
    name: string;
    color: string;
    createdAt: string;
    updatedAt: string;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    const existing = await prisma.libraryTag.findFirst({
      where: {
        id: input.tagId,
        projectId: input.projectId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      throw new AppError(404, 'Etiqueta não encontrada no projeto.');
    }

    const tag = await prisma.libraryTag.update({
      where: {
        id: input.tagId
      },
      data: {
        name: input.name?.trim() || undefined,
        color: input.color?.trim() || undefined
      }
    });

    return {
      id: tag.id,
      projectId: tag.projectId,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    };
  }

  async deleteTag(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    tagId: string;
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    const existing = await prisma.libraryTag.findFirst({
      where: {
        id: input.tagId,
        projectId: input.projectId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      throw new AppError(404, 'Etiqueta não encontrada no projeto.');
    }

    await prisma.libraryTag.delete({
      where: {
        id: input.tagId
      }
    });
  }

  async createDocument(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
    title: string;
    description?: string | null;
    folderId?: string | null;
    tagIds?: string[];
    documentType?: LibraryDocumentType | null;
    contentMarkdown?: string | null;
  }): Promise<LibraryItemDetailView> {
    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'write'
    });

    if (input.folderId) {
      await this.assertFolderBelongsToProject(input.projectId, input.folderId);
    }

    const tagIds = await this.assertTagsBelongToProject(input.projectId, input.tagIds ?? []);

    const markdown = input.contentMarkdown?.trim() || null;
    const text = markdown ? toPlainTextFromMarkdown(markdown) : null;

    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.libraryItem.create({
        data: {
          projectId: input.projectId,
          folderId: input.folderId ?? null,
          title: input.title.trim(),
          description: input.description?.trim() ? input.description.trim() : null,
          type: 'DOCUMENT',
          origin: 'MANUAL',
          status: 'DRAFT',
          documentType: input.documentType ?? 'OTHER',
          contentMarkdown: markdown,
          contentText: text,
          createdByUserId: input.userId,
          updatedByUserId: input.userId,
          tags: tagIds.length > 0
            ? {
                createMany: {
                  data: tagIds.map((tagId) => ({ tagId })),
                  skipDuplicates: true
                }
              }
            : undefined
        },
        include: {
          folder: true,
          meeting: {
            select: {
              id: true,
              title: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          versions: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 25
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });

      await tx.libraryItemVersion.create({
        data: {
          libraryItemId: item.id,
          createdByUserId: input.userId,
          contentMarkdown: item.contentMarkdown,
          contentText: item.contentText,
          contentJson: toPrismaJsonInput(item.contentJson)
        }
      });

      return tx.libraryItem.findUniqueOrThrow({
        where: {
          id: item.id
        },
        include: {
          folder: true,
          meeting: {
            select: {
              id: true,
              title: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          versions: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 25
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });
    });

    await this.indexItemSafely({
      organizationId: input.organizationId,
      itemId: created.id
    });

    await this.notifySafely('LIBRARY_DOCUMENT_CREATED', () =>
      this.notifyLibraryEvent({
        organizationId: input.organizationId,
        projectId: input.projectId,
        title: 'Novo documento na biblioteca',
        message: `Um novo documento foi criado no projeto ${project.name}: ${created.title}.`,
        targetId: created.id,
        targetHref: `/projects/${input.projectId}/library/documents/${created.id}`
      })
    );

    return this.mapItemDetail(created, input.baseUrl);
  }

  async createFileItem(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
    fileName: string;
    filePath: string;
    mimeType?: string;
    sizeBytes?: number;
    title?: string;
    description?: string | null;
    folderId?: string | null;
    tagIds?: string[];
  }): Promise<LibraryItemDetailView> {
    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'write'
    });

    if (input.folderId) {
      await this.assertFolderBelongsToProject(input.projectId, input.folderId);
    }

    const tagIds = await this.assertTagsBelongToProject(input.projectId, input.tagIds ?? []);

    const created = await prisma.$transaction(async (tx) => {
      const projectFile = await tx.projectFile.create({
        data: {
          projectId: input.projectId,
          uploadedByUserId: input.userId,
          name: input.fileName,
          description: input.description?.trim() ? input.description.trim() : null,
          filePath: input.filePath,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes ?? null
        }
      });

      const item = await tx.libraryItem.create({
        data: {
          projectId: input.projectId,
          folderId: input.folderId ?? null,
          projectFileId: projectFile.id,
          title: input.title?.trim() || input.fileName,
          description: input.description?.trim() ? input.description.trim() : null,
          type: 'FILE',
          origin: 'UPLOAD',
          status: 'PUBLISHED',
          filePath: input.filePath,
          fileName: input.fileName,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes ?? null,
          createdByUserId: input.userId,
          updatedByUserId: input.userId,
          tags: tagIds.length > 0
            ? {
                createMany: {
                  data: tagIds.map((tagId) => ({ tagId })),
                  skipDuplicates: true
                }
              }
            : undefined
        }
      });

      return tx.libraryItem.findUniqueOrThrow({
        where: {
          id: item.id
        },
        include: {
          folder: true,
          meeting: {
            select: {
              id: true,
              title: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          versions: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 25
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });
    });

    await this.indexItemSafely({
      organizationId: input.organizationId,
      itemId: created.id
    });

    await this.notifySafely('LIBRARY_FILE_UPLOADED', () =>
      this.notifyLibraryEvent({
        organizationId: input.organizationId,
        projectId: input.projectId,
        title: 'Novo arquivo na biblioteca',
        message: `Um novo arquivo foi enviado para o projeto ${project.name}: ${created.fileName ?? created.title}.`,
        targetId: created.id,
        targetHref: `/projects/${input.projectId}/library?item=${created.id}`
      })
    );

    return this.mapItemDetail(created, input.baseUrl);
  }

  async getItem(input: {
    organizationId: string;
    projectId: string;
    itemId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<LibraryItemDetailView> {
    const access = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'read'
    });

    const item = await this.getItemForAccess({
      projectId: input.projectId,
      itemId: input.itemId,
      canReadDraft: access.canReadDraft
    });

    return this.mapItemDetail(item, input.baseUrl);
  }

  async updateItem(input: {
    organizationId: string;
    projectId: string;
    itemId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
    title?: string;
    description?: string | null;
    folderId?: string | null;
    documentType?: LibraryDocumentType | null;
    status?: LibraryItemStatus;
    contentMarkdown?: string | null;
    contentJson?: Prisma.InputJsonValue | null;
    tagIds?: string[];
  }): Promise<LibraryItemDetailView> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'write'
    });

    const current = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        projectId: input.projectId,
        deletedAt: null
      },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    if (!current) {
      throw new AppError(404, 'Item da biblioteca não encontrado.');
    }

    if (input.folderId) {
      await this.assertFolderBelongsToProject(input.projectId, input.folderId);
    }

    const tagIds = input.tagIds ? await this.assertTagsBelongToProject(input.projectId, input.tagIds) : undefined;

    if (current.type === 'FILE' && (input.contentMarkdown !== undefined || input.contentJson !== undefined)) {
      throw new AppError(400, 'Arquivos não possuem conteúdo editável em markdown.');
    }

    if (current.type === 'FILE' && input.documentType !== undefined) {
      throw new AppError(400, 'Tipo de documento é aplicável apenas para itens DOCUMENT.');
    }

    const nextMarkdown =
      input.contentMarkdown !== undefined
        ? input.contentMarkdown?.trim() || null
        : current.contentMarkdown;

    const nextText =
      input.contentMarkdown !== undefined
        ? nextMarkdown
          ? toPlainTextFromMarkdown(nextMarkdown)
          : null
        : current.contentText;

    const willPublishNow = current.status !== 'PUBLISHED' && input.status === 'PUBLISHED';

    const shouldCreateVersion =
      current.type === 'DOCUMENT' &&
      (input.contentMarkdown !== undefined || input.contentJson !== undefined || willPublishNow);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.libraryItem.update({
        where: {
          id: current.id
        },
        data: {
          title: input.title?.trim() || undefined,
          ...(input.description !== undefined
            ? {
                description: input.description?.trim() ? input.description.trim() : null
              }
            : {}),
          ...(input.folderId !== undefined
            ? {
                folderId: input.folderId
              }
            : {}),
          ...(input.documentType !== undefined && current.type === 'DOCUMENT'
            ? {
                documentType: input.documentType
              }
            : {}),
          ...(input.status !== undefined
            ? {
                status: input.status,
                archivedAt: input.status === 'ARCHIVED' ? new Date() : null
              }
            : {}),
          ...(input.contentMarkdown !== undefined
            ? {
                contentMarkdown: nextMarkdown,
                contentText: nextText
              }
            : {}),
          ...(input.contentJson !== undefined
            ? {
                contentJson: toPrismaJsonInput(input.contentJson)
              }
            : {}),
          updatedByUserId: input.userId
        }
      });

      if (tagIds) {
        await tx.libraryItemTag.deleteMany({
          where: {
            libraryItemId: current.id
          }
        });

        if (tagIds.length > 0) {
          await tx.libraryItemTag.createMany({
            data: tagIds.map((tagId) => ({
              libraryItemId: current.id,
              tagId
            })),
            skipDuplicates: true
          });
        }
      }

      if (shouldCreateVersion) {
        await tx.libraryItemVersion.create({
          data: {
            libraryItemId: current.id,
            createdByUserId: input.userId,
            contentMarkdown: nextMarkdown,
            contentText: nextText,
            contentJson: toPrismaJsonInput(input.contentJson !== undefined ? input.contentJson : current.contentJson)
          }
        });
      }

      return tx.libraryItem.findUniqueOrThrow({
        where: {
          id: current.id
        },
        include: {
          folder: true,
          meeting: {
            select: {
              id: true,
              title: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          versions: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 25
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });
    });

    await this.indexItemSafely({
      organizationId: input.organizationId,
      itemId: updated.id
    });

    if (willPublishNow && updated.type === 'DOCUMENT') {
      await this.notifySafely('LIBRARY_DOCUMENT_PUBLISHED', () =>
        this.notifyLibraryEvent({
          organizationId: input.organizationId,
          projectId: input.projectId,
          title: 'Documento publicado',
          message: `O documento ${updated.title} foi publicado na biblioteca do projeto.`,
          targetId: updated.id,
          targetHref: `/projects/${input.projectId}/library/documents/${updated.id}`
        })
      );
    }

    return this.mapItemDetail(updated, input.baseUrl);
  }

  async archiveItem(input: {
    organizationId: string;
    projectId: string;
    itemId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<LibraryItemDetailView> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    const existing = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        projectId: input.projectId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      throw new AppError(404, 'Item da biblioteca não encontrado.');
    }

    await prisma.libraryItem.update({
      where: {
        id: existing.id
      },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedByUserId: input.userId
      }
    });

    await this.indexItemSafely({
      organizationId: input.organizationId,
      itemId: existing.id
    });

    return this.getItem({
      organizationId: input.organizationId,
      projectId: input.projectId,
      itemId: existing.id,
      userId: input.userId,
      organizationRole: input.organizationRole,
      baseUrl: input.baseUrl
    });
  }

  async softDeleteItem(input: {
    organizationId: string;
    projectId: string;
    itemId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'admin'
    });

    const existing = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        projectId: input.projectId,
        deletedAt: null
      },
      select: {
        id: true,
        archivedAt: true
      }
    });

    if (!existing) {
      throw new AppError(404, 'Item da biblioteca não encontrado.');
    }

    await prisma.libraryItem.update({
      where: {
        id: existing.id
      },
      data: {
        status: 'ARCHIVED',
        archivedAt: existing.archivedAt ?? new Date(),
        deletedAt: new Date(),
        updatedByUserId: input.userId
      }
    });

    await this.removeItemIndexSafely({
      organizationId: input.organizationId,
      itemId: existing.id
    });
  }

  async attachTagToItem(input: {
    organizationId: string;
    projectId: string;
    itemId: string;
    tagId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<LibraryItemDetailView> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'write'
    });

    const item = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        projectId: input.projectId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!item) {
      throw new AppError(404, 'Item da biblioteca não encontrado.');
    }

    await this.assertTagsBelongToProject(input.projectId, [input.tagId]);

    await prisma.libraryItemTag.createMany({
      data: [{
        libraryItemId: item.id,
        tagId: input.tagId
      }],
      skipDuplicates: true
    });

    await prisma.libraryItem.update({
      where: {
        id: item.id
      },
      data: {
        updatedByUserId: input.userId
      }
    });

    await this.indexItemSafely({
      organizationId: input.organizationId,
      itemId: item.id
    });

    return this.getItem({
      organizationId: input.organizationId,
      projectId: input.projectId,
      itemId: item.id,
      userId: input.userId,
      organizationRole: input.organizationRole,
      baseUrl: input.baseUrl
    });
  }

  async detachTagFromItem(input: {
    organizationId: string;
    projectId: string;
    itemId: string;
    tagId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<LibraryItemDetailView> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'write'
    });

    const item = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        projectId: input.projectId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!item) {
      throw new AppError(404, 'Item da biblioteca não encontrado.');
    }

    await prisma.libraryItemTag.deleteMany({
      where: {
        libraryItemId: item.id,
        tagId: input.tagId
      }
    });

    await prisma.libraryItem.update({
      where: {
        id: item.id
      },
      data: {
        updatedByUserId: input.userId
      }
    });

    await this.indexItemSafely({
      organizationId: input.organizationId,
      itemId: item.id
    });

    return this.getItem({
      organizationId: input.organizationId,
      projectId: input.projectId,
      itemId: item.id,
      userId: input.userId,
      organizationRole: input.organizationRole,
      baseUrl: input.baseUrl
    });
  }

  async getDocumentForExport(input: {
    organizationId: string;
    projectId: string;
    itemId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<{
    id: string;
    title: string;
    type: LibraryItemType;
    origin: LibraryItemOrigin;
    status: LibraryItemStatus;
    contentMarkdown: string | null;
    contentText: string | null;
    updatedAt: string;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'write'
    });

    const item = await prisma.libraryItem.findFirst({
      where: {
        id: input.itemId,
        projectId: input.projectId,
        deletedAt: null,
        type: 'DOCUMENT'
      },
      select: {
        id: true,
        title: true,
        type: true,
        origin: true,
        status: true,
        contentMarkdown: true,
        contentText: true,
        updatedAt: true
      }
    });

    if (!item) {
      throw new AppError(404, 'Documento não encontrado para exportação.');
    }

    return {
      ...item,
      updatedAt: item.updatedAt.toISOString()
    };
  }

  async generateMeetingMinutes(input: {
    organizationId: string;
    projectId: string;
    meetingId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
    forceNew?: boolean;
  }): Promise<LibraryItemDetailView> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      required: 'write'
    });

    const meeting = await prisma.meeting.findFirst({
      where: {
        id: input.meetingId,
        projectId: input.projectId,
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
        createdByUser: {
          select: {
            name: true
          }
        },
        observations: {
          select: {
            authorUser: {
              select: {
                name: true
              }
            }
          }
        },
        transcript: {
          select: {
            fullText: true
          }
        },
        note: {
          select: {
            summary: true,
            topicsJson: true,
            decisionsJson: true,
            actionItemsJson: true,
            pendingItemsJson: true
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada para gerar ata.');
    }

    const hasTranscript = Boolean(meeting.transcript?.fullText?.trim());
    const hasNotes = Boolean(meeting.note);

    if (!hasTranscript && !hasNotes) {
      throw new AppError(409, 'A reunião ainda não possui transcrição ou notas para gerar ata.');
    }

    const existingMinutesCount = await prisma.libraryItem.count({
      where: {
        projectId: input.projectId,
        meetingId: input.meetingId,
        documentType: 'MEETING_MINUTES',
        deletedAt: null
      }
    });

    if (existingMinutesCount > 0 && !input.forceNew) {
      throw new AppError(409, 'Já existe ata gerada para esta reunião. Use forceNew para criar nova versão.');
    }

    const participants = unique([
      meeting.createdByUser.name,
      ...meeting.observations.map((entry) => entry.authorUser.name)
    ]).filter(Boolean);

    const topics = Array.isArray(meeting.note?.topicsJson)
      ? meeting.note?.topicsJson.filter((entry): entry is string => typeof entry === 'string')
      : [];

    const decisions = Array.isArray(meeting.note?.decisionsJson)
      ? meeting.note?.decisionsJson.filter((entry): entry is string => typeof entry === 'string')
      : [];

    const tasksRaw = Array.isArray(meeting.note?.actionItemsJson)
      ? meeting.note?.actionItemsJson
      : [];

    const tasks = tasksRaw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const title = typeof record.title === 'string' ? record.title.trim() : '';

        if (!title) {
          return null;
        }

        const dueDate = typeof record.dueDate === 'string' ? record.dueDate.trim() : '';

        return `${title}${dueDate ? ` (prazo: ${dueDate})` : ''}`;
      })
      .filter((entry): entry is string => Boolean(entry));

    const pendingItems = Array.isArray(meeting.note?.pendingItemsJson)
      ? meeting.note?.pendingItemsJson.filter((entry): entry is string => typeof entry === 'string')
      : [];

    const markdown = await libraryAiService.generateMeetingMinutes({
      projectName: meeting.project.name,
      meetingTitle: meeting.title,
      meetingDateIso: meeting.createdAt.toISOString(),
      participants,
      transcriptText: meeting.transcript?.fullText,
      summary: meeting.note?.summary ?? undefined,
      topics,
      decisions,
      tasks,
      pendingItems
    });

    const contentText = markdown ? toPlainTextFromMarkdown(markdown) : null;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.libraryItem.create({
        data: {
          projectId: input.projectId,
          meetingId: input.meetingId,
          title: `Ata - ${meeting.title}`,
          description: `Ata gerada automaticamente a partir da reunião ${meeting.title}.`,
          type: 'DOCUMENT',
          origin: 'MEETING',
          status: 'DRAFT',
          documentType: 'MEETING_MINUTES',
          contentMarkdown: markdown,
          contentText,
          createdByUserId: input.userId,
          updatedByUserId: input.userId
        }
      });

      await tx.libraryItemVersion.create({
        data: {
          libraryItemId: created.id,
          createdByUserId: input.userId,
          contentMarkdown: created.contentMarkdown,
          contentText: created.contentText,
          contentJson: toPrismaJsonInput(created.contentJson)
        }
      });

      return tx.libraryItem.findUniqueOrThrow({
        where: {
          id: created.id
        },
        include: {
          folder: true,
          meeting: {
            select: {
              id: true,
              title: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          versions: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 25
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });
    });

    await this.indexItemSafely({
      organizationId: input.organizationId,
      itemId: item.id
    });

    await this.notifySafely('LIBRARY_MEETING_MINUTES_CREATED', () =>
      this.notifyLibraryEvent({
        organizationId: input.organizationId,
        projectId: input.projectId,
        title: 'Nova ata disponível',
        message: `A ata da reunião ${meeting.title} foi gerada no projeto ${meeting.project.name}.`,
        targetId: item.id,
        targetHref: `/projects/${input.projectId}/library/documents/${item.id}`
      })
    );

    return this.mapItemDetail(item, input.baseUrl);
  }
}

export const libraryService = new LibraryService();
