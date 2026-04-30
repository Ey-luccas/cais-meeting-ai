import { toRelativeStoragePath } from '../../shared/upload';

export type LibraryUploadMetadata = {
  originalName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
};

export class LibraryUploadService {
  buildUploadedFileMetadata(file: Express.Multer.File): LibraryUploadMetadata {
    return {
      originalName: file.originalname,
      filePath: toRelativeStoragePath('documents', file.filename),
      mimeType: file.mimetype,
      sizeBytes: file.size
    };
  }
}

export const libraryUploadService = new LibraryUploadService();
