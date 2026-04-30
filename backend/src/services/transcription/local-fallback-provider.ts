import { AppError } from '../../shared/app-error';
import type { TranscriptionProvider } from './provider';
import type { TranscriptionResult } from './types';

export class LocalFallbackTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'LOCAL_FALLBACK' as const;

  async transcribe(_filePath: string): Promise<TranscriptionResult> {
    throw new AppError(
      501,
      'Transcrição local ainda não habilitada. A arquitetura já suporta fallback futuro.'
    );
  }
}
