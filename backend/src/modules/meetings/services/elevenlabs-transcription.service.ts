import { Blob } from 'node:buffer';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../../../config/env';
import { AppError } from '../../../shared/app-error';
import { logger } from '../../../shared/logger';
import {
  audioProcessingService,
  type AudioChunk
} from '../../../services/transcription/audio-processing.service';
import { transcriptMergeService } from '../../../services/transcription/transcript-merge.service';
import type {
  ChunkTranscriptionFailure,
  ChunkTranscriptionResult,
  ChunkTranscriptionSuccess,
  TranscriptSegment,
  TranscriptionResult
} from '../../../services/transcription/types';

type ElevenlabsTranscriptionApiResponse = {
  language_code?: string;
  text?: string;
  words?: Array<{
    text?: string;
    start?: number;
    end?: number;
    type?: string;
    [key: string]: unknown;
  }>;
  detail?: unknown;
  [key: string]: unknown;
};

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const ELEVENLABS_MODEL_ID = 'scribe_v2';
const RETRY_ATTEMPTS = 1;

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

const parseErrorDetails = (payload: ElevenlabsTranscriptionApiResponse | null): string | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload.detail === 'string' && payload.detail.trim().length > 0) {
    return payload.detail.trim();
  }

  if (payload.detail && typeof payload.detail === 'object') {
    try {
      return JSON.stringify(payload.detail).slice(0, 800);
    } catch {
      return 'detail_unserializable';
    }
  }

  return null;
};

export class ElevenlabsTranscriptionService {
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    try {
      await access(filePath);
    } catch {
      throw new AppError(400, 'Arquivo de áudio não encontrado para transcrição.');
    }

    const splitResult = await audioProcessingService.splitAudioChunks(filePath);

    try {
      const results = await this.transcribeChunks(splitResult.chunks, RETRY_ATTEMPTS);
      const successfulChunks: ChunkTranscriptionSuccess[] = [];
      const failedChunks: ChunkTranscriptionFailure[] = [];

      for (const result of results) {
        if (result.status === 'SUCCESS') {
          successfulChunks.push(result);
          continue;
        }

        failedChunks.push(result);
      }

      if (failedChunks.length > 0) {
        throw new AppError(502, 'Falha ao transcrever todos os chunks com ElevenLabs.', {
          failedChunks: failedChunks.map((entry) => ({
            chunkIndex: entry.chunkIndex,
            error: entry.error,
            attempts: entry.attempts
          }))
        });
      }

      if (successfulChunks.length !== splitResult.chunks.length) {
        throw new AppError(502, 'Nem todos os chunks foram transcritos com sucesso.');
      }

      return transcriptMergeService.mergeTranscripts({
        chunks: successfulChunks,
        sourceDurationSeconds: splitResult.sourceDurationSeconds
      });
    } finally {
      await audioProcessingService.cleanupTemporaryFiles(splitResult.tempDirectoryPath);
    }
  }

  private async transcribeChunks(
    chunks: AudioChunk[],
    retryAttempts: number
  ): Promise<ChunkTranscriptionResult[]> {
    const orderedChunks = [...chunks].sort((left, right) => left.index - right.index);
    const output: ChunkTranscriptionResult[] = [];

    for (const chunk of orderedChunks) {
      const result = await this.transcribeChunkWithRetry(chunk, retryAttempts);
      output.push(result);
    }

    return output;
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
        logger.warn('Falha ao transcrever chunk com ElevenLabs.', {
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
    const apiKey = env.ELEVENLABS_API_KEY?.trim();

    if (!apiKey) {
      throw new AppError(500, 'ELEVENLABS_API_KEY não configurada.');
    }

    try {
      await access(chunk.filePath);
    } catch {
      throw new AppError(400, `Arquivo do chunk ${chunk.index} não encontrado para transcrição.`);
    }

    const fileBuffer = await readFile(chunk.filePath);
    const formData = new FormData();
    formData.append('model_id', ELEVENLABS_MODEL_ID);
    formData.append('timestamps_granularity', 'word');
    formData.append('file', new Blob([fileBuffer]), path.basename(chunk.filePath));

    let rawBody = '';
    let payload: ElevenlabsTranscriptionApiResponse | null = null;

    try {
      const response = await fetch(ELEVENLABS_API_URL, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey
        },
        body: formData
      });

      rawBody = await response.text();

      try {
        payload = JSON.parse(rawBody) as ElevenlabsTranscriptionApiResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new AppError(502, `Falha ao transcrever chunk ${chunk.index} com ElevenLabs.`, {
          statusCode: response.status,
          message: parseErrorDetails(payload) ?? rawBody.slice(0, 800)
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, `Falha ao chamar ElevenLabs para chunk ${chunk.index}.`, {
        cause: toErrorMessage(error)
      });
    }

    const text = payload?.text?.trim() ?? '';

    if (!text) {
      throw new AppError(502, `ElevenLabs retornou transcrição vazia para chunk ${chunk.index}.`);
    }

    const segments: TranscriptSegment[] = (payload?.words ?? [])
      .map((word) => {
        const segmentText = typeof word.text === 'string' ? word.text.trim() : '';

        if (!segmentText) {
          return null;
        }

        const start =
          typeof word.start === 'number' && Number.isFinite(word.start) ? Math.max(0, word.start) : 0;
        const end =
          typeof word.end === 'number' && Number.isFinite(word.end) ? Math.max(start, word.end) : start;

        return {
          startSec: start,
          endSec: end,
          text: segmentText
        } satisfies TranscriptSegment;
      })
      .filter((entry): entry is TranscriptSegment => Boolean(entry));

    return {
      text,
      language: payload?.language_code?.trim() || null,
      segments,
      raw: payload ?? rawBody
    };
  }
}

export const elevenlabsTranscriptionService = new ElevenlabsTranscriptionService();
