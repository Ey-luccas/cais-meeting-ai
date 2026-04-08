import Link from 'next/link';
import { Activity } from 'lucide-react';

import { StatusBadge } from '@/components/meetings/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import type { Meeting, MeetingStatus } from '@/types/meeting';

type RecentActivityProps = {
  meetings: Meeting[];
};

const activityTextByStatus: Record<MeetingStatus, string> = {
  PENDING: 'Reunião criada e aguardando envio de áudio',
  UPLOADED: 'Áudio enviado, pronto para transcrição',
  TRANSCRIBING: 'Transcrição em andamento',
  TRANSCRIBED: 'Transcrição concluída, pronto para IA',
  PROCESSING_AI: 'Gerando resumo e notas executivas',
  COMPLETED: 'Reunião finalizada com notas consolidadas',
  FAILED: 'Falha no processamento, revisão necessária'
};

export const RecentActivity = ({ meetings }: RecentActivityProps): JSX.Element => {
  const sortedMeetings = [...meetings]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  return (
    <Card className="cais-paper">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-xl">
          <Activity size={18} />
          Atividade recente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedMeetings.length === 0 ? (
          <p className="text-sm text-[#0A4C78]/70">Sem atividade recente para exibir.</p>
        ) : (
          sortedMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="flex flex-col gap-2 rounded-2xl border border-[#0A4C78]/12 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-semibold text-[#0A4C78]">{meeting.title}</p>
                <p className="text-xs text-[#0A4C78]/68">{activityTextByStatus[meeting.status]}</p>
                <p className="text-xs text-[#0A4C78]/58">Atualizado em {formatDateTime(meeting.updatedAt)}</p>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={meeting.status} />
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/meetings/${meeting.id}`}>Abrir</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
