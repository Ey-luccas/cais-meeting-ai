import type { TranscriptionResult } from './types';

export interface TranscriptionProvider {
  readonly name: 'GROQ' | 'LOCAL_FALLBACK';
  transcribe(filePath: string): Promise<TranscriptionResult>;
}
