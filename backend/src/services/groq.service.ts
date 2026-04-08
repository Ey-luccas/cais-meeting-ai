import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';

import Groq from 'groq-sdk';

import { env } from '../config/env';
import type { TranscriptionPayload } from '../types';
import { AppError } from '../utils';

type GroqTranscriptionResponse = {
  text?: string;
  language?: string;
  duration?: number;
  [key: string]: unknown;
};

export class GroqService {
  private getClient(): Groq {
    if (!env.GROQ_API_KEY) {
      throw new AppError(500, 'GROQ_API_KEY não configurada.');
    }

    return new Groq({ apiKey: env.GROQ_API_KEY });
  }

  async transcribeMeetingAudio(audioFilePath: string): Promise<TranscriptionPayload> {
    try {
      await access(audioFilePath);
    } catch {
      throw new AppError(400, 'Arquivo de áudio não encontrado para transcrição.');
    }

    const groq = this.getClient();
    const fileStream = createReadStream(audioFilePath);

    let response: GroqTranscriptionResponse;

    try {
      response = (await groq.audio.transcriptions.create({
        file: fileStream,
        model: env.GROQ_STT_MODEL,
        response_format: 'verbose_json'
      })) as unknown as GroqTranscriptionResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const canRetryWithoutVerboseFormat =
        message.includes('response_format') || message.includes('verbose_json');

      if (!canRetryWithoutVerboseFormat) {
        throw new AppError(502, 'Falha ao transcrever áudio com Groq.', {
          cause: error instanceof Error ? error.message : 'unknown_error'
        });
      }

      try {
        response = (await groq.audio.transcriptions.create({
          file: createReadStream(audioFilePath),
          model: env.GROQ_STT_MODEL
        })) as unknown as GroqTranscriptionResponse;
      } catch (retryError) {
        throw new AppError(502, 'Falha ao transcrever áudio com Groq.', {
          cause: retryError instanceof Error ? retryError.message : 'unknown_error'
        });
      }
    }

    const fullText = response.text?.trim() ?? '';

    if (!fullText) {
      throw new AppError(502, 'A Groq retornou transcrição vazia.');
    }

    return {
      fullText,
      language: response.language ?? null,
      rawJson: response,
      durationSeconds: typeof response.duration === 'number' ? Math.round(response.duration) : null
    };
  }
}

export const groqService = new GroqService();
