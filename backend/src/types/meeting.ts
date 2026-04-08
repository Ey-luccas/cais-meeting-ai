import type { MeetingStatus } from '@prisma/client';

export type ActionItem = {
  item: string;
  owner?: string | null;
  deadline?: string | null;
  status?: string | null;
};

export type GeneratedNotesPayload = {
  summary: string;
  topics: string[];
  decisions: string[];
  actionItems: ActionItem[];
  pendingItems: string[];
  comments: string[];
};

export type TranscriptionPayload = {
  fullText: string;
  language: string | null;
  rawJson: unknown;
  durationSeconds: number | null;
};

export type MeetingResponse = {
  id: string;
  title: string;
  description: string | null;
  audioPath: string | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  transcript: {
    id: string;
    fullText: string;
    language: string | null;
    rawJson: unknown;
    createdAt: string;
  } | null;
  note: {
    id: string;
    summary: string;
    topicsJson: unknown;
    decisionsJson: unknown;
    actionItemsJson: unknown;
    pendingItemsJson: unknown;
    commentsJson: unknown;
    createdAt: string;
  } | null;
};
