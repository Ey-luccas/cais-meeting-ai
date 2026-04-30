import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { audioProcessingService, type AudioChunk } from './audio-processing.service';
import {
  groqTranscriptionService,
  type ChunkTranscriptionFailure,
  type ChunkTranscriptionSuccess
} from './groq-transcription.service';
import type { TranscriptionProvider } from './provider';
import { transcriptMergeService } from './transcript-merge.service';
import type { TranscriptionResult } from './types';

export class GroqTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'GROQ' as const;

  async transcribe(filePath: string): Promise<TranscriptionResult> {
    const splitResult = await audioProcessingService.splitAudioChunks(filePath);
    const chunksByIndex = new Map(splitResult.chunks.map((chunk) => [chunk.index, chunk]));

    try {
      const firstPassResults = await groqTranscriptionService.transcribeChunks(splitResult.chunks, {
        retryAttempts: 0
      });

      const successfulByChunkIndex = new Map<number, ChunkTranscriptionSuccess>();
      const firstPassFailures: ChunkTranscriptionFailure[] = [];

      for (const result of firstPassResults) {
        if (result.status === 'SUCCESS') {
          successfulByChunkIndex.set(result.chunkIndex, result);
          continue;
        }

        firstPassFailures.push(result);
      }

      const failedAfterRetry = await this.reprocessFailedChunks({
        failedChunks: firstPassFailures,
        chunksByIndex
      });

      for (const recoveredChunk of failedAfterRetry.recovered) {
        successfulByChunkIndex.set(recoveredChunk.chunkIndex, recoveredChunk);
      }

      if (failedAfterRetry.failed.length > 0) {
        throw new AppError(502, 'Falha ao transcrever todos os chunks da reunião.', {
          failedChunks: failedAfterRetry.failed.map((entry) => ({
            chunkIndex: entry.chunkIndex,
            error: entry.error
          }))
        });
      }

      const orderedSuccessful = splitResult.chunks
        .map((chunk) => successfulByChunkIndex.get(chunk.index))
        .filter(
          (entry): entry is ChunkTranscriptionSuccess =>
            typeof entry !== 'undefined' && entry.status === 'SUCCESS'
        );

      if (orderedSuccessful.length !== splitResult.chunks.length) {
        throw new AppError(502, 'Nem todos os chunks foram transcritos com sucesso.');
      }

      return transcriptMergeService.mergeTranscripts({
        chunks: orderedSuccessful,
        sourceDurationSeconds: splitResult.sourceDurationSeconds
      });
    } finally {
      await audioProcessingService.cleanupTemporaryFiles(splitResult.tempDirectoryPath);
    }
  }

  private async reprocessFailedChunks(input: {
    failedChunks: ChunkTranscriptionFailure[];
    chunksByIndex: Map<number, AudioChunk>;
  }): Promise<{
    recovered: ChunkTranscriptionSuccess[];
    failed: ChunkTranscriptionFailure[];
  }> {
    if (input.failedChunks.length === 0) {
      return {
        recovered: [],
        failed: []
      };
    }

    logger.warn('Chunks falharam na primeira tentativa. Reprocessando...', {
      chunks: input.failedChunks.map((entry) => entry.chunkIndex)
    });

    const recovered: ChunkTranscriptionSuccess[] = [];
    const failed: ChunkTranscriptionFailure[] = [];

    for (const failedChunk of input.failedChunks) {
      const chunk = input.chunksByIndex.get(failedChunk.chunkIndex);

      if (!chunk) {
        failed.push({
          ...failedChunk,
          error: 'chunk_metadata_not_found'
        });
        continue;
      }

      try {
        const retried = await groqTranscriptionService.reprocessChunk(chunk, 1);
        recovered.push(retried);
      } catch (error) {
        failed.push({
          ...failedChunk,
          error: error instanceof Error ? error.message : 'chunk_reprocess_failed'
        });
      }
    }

    return {
      recovered,
      failed
    };
  }
}
