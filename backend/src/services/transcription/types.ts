export type TranscriptSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscriptionEngine = 'ELEVENLABS' | 'LOCAL_FALLBACK';

export type TranscriptionResult = {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  raw: unknown;
  segments: TranscriptSegment[];
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
