import { env } from '../../config/env';
import type { TranscriptionResult } from './types';
import { GroqTranscriptionProvider } from './groq-provider';
import { LocalFallbackTranscriptionProvider } from './local-fallback-provider';

const groqProvider = new GroqTranscriptionProvider();
const localProvider = new LocalFallbackTranscriptionProvider();

export class TranscriptionRouterService {
  async transcribe(filePath: string): Promise<{
    engine: 'GROQ' | 'LOCAL_FALLBACK';
    result: TranscriptionResult;
  }> {
    if (env.TRANSCRIPTION_ENGINE === 'LOCAL_FALLBACK') {
      return {
        engine: localProvider.name,
        result: await localProvider.transcribe(filePath)
      };
    }

    return {
      engine: groqProvider.name,
      result: await groqProvider.transcribe(filePath)
    };
  }
}

export const transcriptionRouterService = new TranscriptionRouterService();
