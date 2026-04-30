import { AppError } from '../../shared/app-error';
import type { ChunkTranscriptionSuccess } from './groq-transcription.service';
import type { TranscriptSegment, TranscriptionResult } from './types';

const formatMarkerTime = (seconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
};

const rounded = (value: number): number => Math.max(0, Math.round(value * 1000) / 1000);

const sortByChunkIndex = (
  left: ChunkTranscriptionSuccess,
  right: ChunkTranscriptionSuccess
): number => left.chunkIndex - right.chunkIndex;

export class TranscriptMergeService {
  mergeTranscripts(input: {
    chunks: ChunkTranscriptionSuccess[];
    sourceDurationSeconds: number | null;
  }): TranscriptionResult {
    if (input.chunks.length === 0) {
      throw new AppError(500, 'Não há chunks transcritos para consolidar.');
    }

    const orderedChunks = [...input.chunks].sort(sortByChunkIndex);

    const text = orderedChunks
      .map((chunk) => {
        const marker = `[${formatMarkerTime(chunk.startSeconds)}]`;
        return `${marker} ${chunk.text.trim()}`.trim();
      })
      .filter((entry) => entry.length > 0)
      .join('\n\n')
      .trim();

    if (!text) {
      throw new AppError(502, 'A transcrição consolidada ficou vazia após merge dos chunks.');
    }

    const segments: TranscriptSegment[] = orderedChunks.flatMap((chunk) => {
      return chunk.segments.map((segment) => ({
        startSec: rounded(segment.startSec + chunk.startSeconds),
        endSec: rounded(segment.endSec + chunk.startSeconds),
        text: segment.text
      }));
    });

    const language = this.resolveLanguage(orderedChunks);

    const lastChunk = orderedChunks[orderedChunks.length - 1];
    const mergedDurationFromChunks = Math.round(lastChunk.startSeconds + lastChunk.durationSeconds);

    return {
      text,
      language,
      durationSeconds:
        input.sourceDurationSeconds !== null
          ? Math.max(Math.round(input.sourceDurationSeconds), mergedDurationFromChunks)
          : mergedDurationFromChunks,
      raw: {
        strategy: 'chunked_merge',
        chunkCount: orderedChunks.length,
        chunks: orderedChunks.map((chunk) => ({
          index: chunk.chunkIndex,
          startSeconds: chunk.startSeconds,
          durationSeconds: chunk.durationSeconds,
          sizeBytes: chunk.sizeBytes,
          attempts: chunk.attempts,
          language: chunk.language,
          textLength: chunk.text.length,
          segmentCount: chunk.segments.length,
          raw: chunk.raw
        }))
      },
      segments
    };
  }

  private resolveLanguage(chunks: ChunkTranscriptionSuccess[]): string | null {
    const votes = new Map<string, number>();

    for (const chunk of chunks) {
      const language = chunk.language?.trim();

      if (!language) {
        continue;
      }

      votes.set(language, (votes.get(language) ?? 0) + 1);
    }

    let winner: string | null = null;
    let winnerVotes = -1;

    for (const [language, count] of votes.entries()) {
      if (count > winnerVotes) {
        winner = language;
        winnerVotes = count;
      }
    }

    return winner;
  }
}

export const transcriptMergeService = new TranscriptMergeService();
