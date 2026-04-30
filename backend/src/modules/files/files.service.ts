import { unlink } from 'node:fs/promises';

import type { OrganizationRole } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { resolveStoredFilePath, toPublicFileUrl } from '../../shared/storage';
import { aiSearchIndexService } from '../ai-search/ai-search-index.service';
import { notificationEventService } from '../notifications/notification-event.service';

type ProjectFileView = {
  id: string;
  name: string;
  description: string | null;
  filePath: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export class FilesService {
  async listProjectFiles(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<ProjectFileView[]> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'read'
    });

    const files = await prisma.projectFile.findMany({
      where: {
        projectId: input.projectId
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return files.map((file) => this.mapFile(file, input.baseUrl));
  }

  async uploadProjectFile(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    fileName: string;
    description?: string | null;
    filePath: string;
    mimeType?: string;
    sizeBytes?: number;
    baseUrl: string;
  }): Promise<ProjectFileView> {
    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const file = await prisma.projectFile.create({
      data: {
        projectId: input.projectId,
        uploadedByUserId: input.userId,
        name: input.fileName,
        description: input.description?.trim() ? input.description.trim() : null,
        filePath: input.filePath,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    await aiSearchIndexService.indexProjectFileById({
      organizationId: input.organizationId,
      fileId: file.id
    });

    await this.notifySafely('FILE_UPLOADED', () =>
      notificationEventService.notifyFileUploaded({
        organizationId: input.organizationId,
        projectId: input.projectId,
        fileId: file.id,
        fileName: file.name,
        projectName: project.name
      })
    );

    return this.mapFile(file, input.baseUrl);
  }

  async deleteProjectFile(input: {
    organizationId: string;
    projectId: string;
    fileId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const file = await prisma.projectFile.findFirst({
      where: {
        id: input.fileId,
        projectId: input.projectId
      },
      select: {
        id: true,
        filePath: true
      }
    });

    if (!file) {
      throw new AppError(404, 'Arquivo não encontrado neste projeto.');
    }

    await aiSearchIndexService.removeProjectFileChunks({
      organizationId: input.organizationId,
      fileId: file.id
    });

    await prisma.projectFile.delete({
      where: {
        id: file.id
      }
    });

    try {
      await unlink(resolveStoredFilePath(file.filePath));
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code !== 'ENOENT') {
        logger.warn('Falha ao remover arquivo físico do projeto.', {
          fileId: file.id,
          filePath: file.filePath,
          error: nodeError.message
        });
      }
    }
  }

  private async assertProjectAccess(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    requiredAccess: 'read' | 'write';
  }): Promise<{
    id: string;
    name: string;
  }> {
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

    const projectRole = project.members[0]?.role;

    if (!projectRole) {
      throw new AppError(403, 'Você não tem acesso a este projeto.');
    }

    if (input.requiredAccess === 'write' && projectRole === 'VIEWER') {
      throw new AppError(403, 'Perfil VIEWER não pode alterar arquivos do projeto.');
    }

    return {
      id: project.id,
      name: project.name
    };
  }

  private async notifySafely(eventName: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      logger.warn('Falha ao registrar notificação de arquivos.', {
        eventName,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private mapFile(
    file: {
      id: string;
      name: string;
      description: string | null;
      filePath: string;
      mimeType: string | null;
      sizeBytes: number | null;
      createdAt: Date;
      uploadedByUser: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
      };
    },
    baseUrl: string
  ): ProjectFileView {
    return {
      id: file.id,
      name: file.name,
      description: file.description,
      filePath: file.filePath,
      fileUrl: toPublicFileUrl(baseUrl, file.filePath),
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt.toISOString(),
      author: {
        id: file.uploadedByUser.id,
        name: file.uploadedByUser.name,
        email: file.uploadedByUser.email,
        avatarUrl: file.uploadedByUser.avatarUrl
      }
    };
  }
}

export const filesService = new FilesService();
