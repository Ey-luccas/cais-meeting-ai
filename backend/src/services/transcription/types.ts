export type TranscriptSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscriptionResult = {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  raw: unknown;
  segments: TranscriptSegment[];
};
