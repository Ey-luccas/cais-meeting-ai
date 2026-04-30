import { DocumentKind } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { toPublicFileUrl } from '../../shared/storage';

export class DocumentsService {
  async listProjectDocuments(input: {
    organizationId: string;
    projectId: string;
    baseUrl: string;
  }): Promise<
    Array<{
      id: string;
      kind: DocumentKind;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      fileUrl: string;
      createdAt: string;
      sourceMeetingId: string | null;
    }>
  > {
    await this.assertProject(input.organizationId, input.projectId);

    const documents = await prisma.projectDocument.findMany({
      where: {
        organizationId: input.organizationId,
        projectId: input.projectId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      fileUrl: toPublicFileUrl(input.baseUrl, document.filePath),
      createdAt: document.createdAt.toISOString(),
      sourceMeetingId: document.sourceMeetingId
    }));
  }

  async uploadDocument(input: {
    organizationId: string;
    projectId: string;
    uploadedByMemberId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    sourceMeetingId?: string;
    baseUrl: string;
  }): Promise<{
    id: string;
    kind: DocumentKind;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    fileUrl: string;
    createdAt: string;
    sourceMeetingId: string | null;
  }> {
    await this.assertProject(input.organizationId, input.projectId);

    const kind = input.mimeType.startsWith('audio/') ? DocumentKind.AUDIO : DocumentKind.DOCUMENT;

    const document = await prisma.projectDocument.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        uploadedByMemberId: input.uploadedByMemberId,
        sourceMeetingId: input.sourceMeetingId,
        kind,
        fileName: input.fileName,
        filePath: input.filePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes
      }
    });

    return {
      id: document.id,
      kind: document.kind,
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      fileUrl: toPublicFileUrl(input.baseUrl, document.filePath),
      createdAt: document.createdAt.toISOString(),
      sourceMeetingId: document.sourceMeetingId
    };
  }

  private async assertProject(organizationId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }
  }
}

export const documentsService = new DocumentsService();
