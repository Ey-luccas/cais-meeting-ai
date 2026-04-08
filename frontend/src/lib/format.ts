import type { MeetingStatus } from '@/types/meeting';

export const formatDateTime = (value: string): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
};

export const formatDuration = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) {
    return 'N/A';
  }

  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
};

export const statusLabel: Record<MeetingStatus, string> = {
  PENDING: 'Pendente',
  UPLOADED: 'Upload concluído',
  TRANSCRIBING: 'Transcrevendo',
  TRANSCRIBED: 'Transcrito',
  PROCESSING_AI: 'Processando IA',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou'
};
