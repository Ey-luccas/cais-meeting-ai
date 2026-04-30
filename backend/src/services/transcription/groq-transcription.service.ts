import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';

import Groq from 'groq-sdk';

import { env } from '../../config/env';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import type { AudioChunk } from './audio-processing.service';
import type { TranscriptSegment } from './types';

type GroqTranscriptionApiResponse = {
  text?: string;
  language?: string;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
  }>;
  [key: string]: unknown;
};

export type ChunkTranscriptionSuccess = {
  status: 'SUCCESS';
  chunkIndex: number;
  startSeconds: number;
  durationSeconds: number;
  sizeBytes: number;
  text: string;
  language: string | null;
  segments: TranscriptSegment[];
  raw: unknown;
  attempts: number;
};

export type ChunkTranscriptionFailure = {
  status: 'FAILED';
  chunkIndex: number;
  startSeconds: number;
  durationSeconds: number;
  sizeBytes: number;
  error: string;
  attempts: number;
};

export type ChunkTranscriptionResult = ChunkTranscriptionSuccess | ChunkTranscriptionFailure;

type ChunkRetryOptions = {
  retryAttempts?: number;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'unknown_error';
};

export class GroqTranscriptionService {
  private getClient(): Groq {
    if (!env.GROQ_API_KEY) {
      throw new AppError(500, 'GROQ_API_KEY não configurada.');
    }

    return new Groq({ apiKey: env.GROQ_API_KEY });
  }

  async transcribeChunks(
    chunks: AudioChunk[],
    options: ChunkRetryOptions = {}
  ): Promise<ChunkTranscriptionResult[]> {
    const orderedChunks = [...chunks].sort((left, right) => left.index - right.index);
    const retryAttempts = options.retryAttempts ?? 0;

    const output: ChunkTranscriptionResult[] = [];

    for (const chunk of orderedChunks) {
      const result = await this.transcribeChunkWithRetry(chunk, retryAttempts);
      output.push(result);
    }

    return output;
  }

  async reprocessChunk(
    chunk: AudioChunk,
    retryAttempts = 1
  ): Promise<ChunkTranscriptionSuccess> {
    const result = await this.transcribeChunkWithRetry(chunk, retryAttempts);

    if (result.status === 'FAILED') {
      throw new AppError(502, `Falha ao reprocessar chunk ${chunk.index}.`, {
        chunkIndex: result.chunkIndex,
        attempts: result.attempts,
        error: result.error
      });
    }

    return result;
  }

  private async transcribeChunkWithRetry(
    chunk: AudioChunk,
    retryAttempts: number
  ): Promise<ChunkTranscriptionResult> {
    let attempts = 0;
    let latestError: unknown = null;

    while (attempts <= retryAttempts) {
      attempts += 1;

      try {
        const response = await this.transcribeSingleChunk(chunk);
        return {
          status: 'SUCCESS',
          chunkIndex: chunk.index,
          startSeconds: chunk.startSeconds,
          durationSeconds: chunk.durationSeconds,
          sizeBytes: chunk.sizeBytes,
          text: response.text,
          language: response.language,
          segments: response.segments,
          raw: response.raw,
          attempts
        };
      } catch (error) {
        latestError = error;
        logger.warn('Falha ao transcrever chunk com Groq.', {
          chunkIndex: chunk.index,
          attempt: attempts,
          error: toErrorMessage(error)
        });
      }
    }

    return {
      status: 'FAILED',
      chunkIndex: chunk.index,
      startSeconds: chunk.startSeconds,
      durationSeconds: chunk.durationSeconds,
      sizeBytes: chunk.sizeBytes,
      error: toErrorMessage(latestError),
      attempts
    };
  }

  private async transcribeSingleChunk(chunk: AudioChunk): Promise<{
    text: string;
    language: string | null;
    segments: TranscriptSegment[];
    raw: unknown;
  }> {
    try {
      await access(chunk.filePath);
    } catch {
      throw new AppError(400, `Arquivo do chunk ${chunk.index} não encontrado para transcrição.`);
    }

    let response: GroqTranscriptionApiResponse;

    try {
      const groq = this.getClient();
      response = (await groq.audio.transcriptions.create({
        file: createReadStream(chunk.filePath),
        model: env.GROQ_STT_MODEL,
        response_format: 'verbose_json'
      })) as GroqTranscriptionApiResponse;
    } catch (error) {
      throw new AppError(502, `Falha ao transcrever chunk ${chunk.index} com Groq.`, {
        cause: toErrorMessage(error)
      });
    }

    const text = response.text?.trim() ?? '';

    if (!text) {
      throw new AppError(502, `Groq retornou transcrição vazia para chunk ${chunk.index}.`);
    }

    const segments = (response.segments ?? [])
      .filter((entry): entry is { start?: number; end?: number; text?: string } => Boolean(entry))
      .map((entry) => {
        const segmentText = entry.text?.trim() ?? '';
        return {
          startSec: typeof entry.start === 'number' ? Math.max(0, entry.start) : 0,
          endSec:
            typeof entry.end === 'number'
              ? Math.max(0, entry.end)
              : typeof entry.start === 'number'
                ? Math.max(0, entry.start)
                : 0,
          text: segmentText
        };
      })
      .filter((entry) => entry.text.length > 0);

    return {
      text,
      language: response.language ?? null,
      segments,
      raw: response
    };
  }
}

export const groqTranscriptionService = new GroqTranscriptionService();
