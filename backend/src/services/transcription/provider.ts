import type { TranscriptionResult } from './types';

export interface TranscriptionProvider {
  readonly name: 'ELEVENLABS' | 'LOCAL_FALLBACK';
  transcribe(filePath: string): Promise<TranscriptionResult>;
}
