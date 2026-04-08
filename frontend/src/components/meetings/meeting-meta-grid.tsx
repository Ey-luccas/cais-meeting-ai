import { CalendarRange, Clock3, Languages, Tags } from 'lucide-react';

import { formatDateTime, formatDuration } from '@/lib/format';
import type { Meeting } from '@/types/meeting';
import { StatusBadge } from './status-badge';

type MeetingMetaGridProps = {
  meeting: Meeting;
};

export const MeetingMetaGrid = ({ meeting }: MeetingMetaGridProps): JSX.Element => {
  return (
    <div className="cais-paper grid gap-3 p-4 text-sm text-[#0A4C78]/84 md:grid-cols-2 xl:grid-cols-5">
      <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
        Status:
        <StatusBadge status={meeting.status} />
      </div>

      <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
        <CalendarRange size={15} />
        Data: {formatDateTime(meeting.createdAt)}
      </div>

      <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
        <Clock3 size={15} />
        Duração: {formatDuration(meeting.durationSeconds)}
      </div>

      <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
        <Languages size={15} />
        Idioma: {meeting.transcript?.language ?? 'N/D'}
      </div>

      <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
        <Tags size={15} />
        {meeting.tags.length > 0 ? meeting.tags.join(', ') : 'Sem tags'}
      </div>
    </div>
  );
};
