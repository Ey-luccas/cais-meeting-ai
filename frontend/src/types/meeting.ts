export type MeetingStatus =
  | 'PENDING'
  | 'UPLOADED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'PROCESSING_AI'
  | 'COMPLETED'
  | 'FAILED';

export type MeetingActionItem = {
  item: string;
  owner?: string | null;
  deadline?: string | null;
  status?: string | null;
};

export type MeetingTranscript = {
  id: string;
  fullText: string;
  language: string | null;
  rawJson: unknown;
  createdAt: string;
};

export type MeetingNote = {
  id: string;
  summary: string;
  topicsJson: unknown;
  decisionsJson: unknown;
  actionItemsJson: unknown;
  pendingItemsJson: unknown;
  commentsJson: unknown;
  createdAt: string;
};

export type Meeting = {
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
  transcript: MeetingTranscript | null;
  note: MeetingNote | null;
};

export type MeetingsListResponse = { meetings: Meeting[] };

export type CreateMeetingInput = {
  title: string;
  description?: string;
  tags?: string[];
};
