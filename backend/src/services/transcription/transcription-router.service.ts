import { env } from '../../config/env';
import { elevenlabsTranscriptionService } from '../../modules/meetings/services/elevenlabs-transcription.service';
import type { TranscriptionEngine, TranscriptionResult } from './types';
import { LocalFallbackTranscriptionProvider } from './local-fallback-provider';

const localProvider = new LocalFallbackTranscriptionProvider();

export class TranscriptionRouterService {
  async transcribe(filePath: string): Promise<{
    engine: TranscriptionEngine;
    result: TranscriptionResult;
  }> {
    if (env.TRANSCRIPTION_ENGINE === 'LOCAL_FALLBACK') {
      return {
        engine: localProvider.name,
        result: await localProvider.transcribe(filePath)
      };
    }

    return {
      engine: 'ELEVENLABS',
      result: await elevenlabsTranscriptionService.transcribe(filePath)
    };
  }
}

export const transcriptionRouterService = new TranscriptionRouterService();
