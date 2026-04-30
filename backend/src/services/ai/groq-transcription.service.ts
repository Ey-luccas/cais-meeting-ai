import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';

import Groq from 'groq-sdk';

import { env } from '../../config/env';
import { AppError } from '../../shared/app-error';
import type { TranscriptionResult } from '../transcription/types';

type GroqResponse = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
  }>;
  [key: string]: unknown;
};

export class GroqTranscriptionService {
  private getClient(): Groq {
    if (!env.GROQ_API_KEY) {
      throw new AppError(500, 'GROQ_API_KEY não configurada.');
    }

    return new Groq({ apiKey: env.GROQ_API_KEY });
  }

  async transcribe(filePath: string): Promise<TranscriptionResult> {
    try {
      await access(filePath);
    } catch {
      throw new AppError(400, 'Arquivo de áudio não encontrado para transcrição.');
    }

    const groq = this.getClient();

    let response: GroqResponse;

    try {
      response = (await groq.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: env.GROQ_STT_MODEL,
        response_format: 'verbose_json'
      })) as GroqResponse;
    } catch (error) {
      throw new AppError(502, 'Falha ao transcrever áudio com Groq.', {
        cause: error instanceof Error ? error.message : 'unknown_error'
      });
    }

    const text = response.text?.trim() ?? '';

    if (!text) {
      throw new AppError(502, 'Groq retornou transcrição vazia.');
    }

    const segments = (response.segments ?? [])
      .filter((segment) => typeof segment.text === 'string' && segment.text.trim().length > 0)
      .map((segment) => ({
        startSec: segment.start ?? 0,
        endSec: segment.end ?? segment.start ?? 0,
        text: segment.text?.trim() ?? ''
      }));

    return {
      text,
      language: response.language ?? null,
      durationSeconds: typeof response.duration === 'number' ? Math.round(response.duration) : null,
      raw: response,
      segments
    };
  }
}

export const groqTranscriptionService = new GroqTranscriptionService();
