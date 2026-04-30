export const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));

export const formatBytes = (sizeBytes: number): string => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = sizeBytes / 1024;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(1)} ${units[index]}`;
};

export const meetingStatusLabel: Record<string, string> = {
  PENDING: 'Pendente',
  UPLOADED: 'Áudio enviado',
  TRANSCRIBING: 'Transcrevendo',
  TRANSCRIBED: 'Transcrito',
  PROCESSING_AI: 'Processando IA',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou'
};
