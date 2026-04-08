import { Badge } from '@/components/ui/badge';
import { statusLabel } from '@/lib/format';
import type { MeetingStatus } from '@/types/meeting';

type StatusVariant = 'default' | 'success' | 'warning' | 'danger';

const statusVariantMap: Record<MeetingStatus, StatusVariant> = {
  PENDING: 'warning',
  UPLOADED: 'warning',
  TRANSCRIBING: 'warning',
  TRANSCRIBED: 'warning',
  PROCESSING_AI: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger'
};

export const StatusBadge = ({ status }: { status: MeetingStatus }): JSX.Element => {
  return <Badge variant={statusVariantMap[status]}>{statusLabel[status]}</Badge>;
};
