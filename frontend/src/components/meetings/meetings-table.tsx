import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { StatusBadge } from '@/components/meetings/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime, formatDuration } from '@/lib/format';
import type { Meeting } from '@/types/meeting';

type MeetingsTableProps = {
  meetings: Meeting[];
  emptyMessage?: string;
};

export const MeetingsTable = ({
  meetings,
  emptyMessage = 'Ainda não há reuniões cadastradas.'
}: MeetingsTableProps): JSX.Element => {
  if (meetings.length === 0) {
    return (
      <Card className="cais-paper">
        <CardContent className="p-8 text-sm text-[#0A4C78]/75">{emptyMessage}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="cais-paper overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-[#0A4C78] text-xs tracking-[0.12em] uppercase text-[#F8F7F4]/86">
              <tr>
                <th className="px-5 py-4 font-medium">Reunião</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Criada em</th>
                <th className="px-5 py-4 font-medium">Duração</th>
                <th className="px-5 py-4 font-medium">Tags</th>
                <th className="px-5 py-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="border-t border-[#0A4C78]/10 transition-colors hover:bg-[#0A4C78]/[0.03]">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#0A4C78]">{meeting.title}</p>
                    <p className="line-clamp-1 text-xs text-[#0A4C78]/70">
                      {meeting.description ?? 'Sem descrição'}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={meeting.status} />
                  </td>
                  <td className="px-5 py-4 text-[#0A4C78]/80">{formatDateTime(meeting.createdAt)}</td>
                  <td className="px-5 py-4 text-[#0A4C78]/80">{formatDuration(meeting.durationSeconds)}</td>
                  <td className="px-5 py-4 text-xs text-[#0A4C78]/75">
                    {meeting.tags.length > 0 ? meeting.tags.join(', ') : 'Sem tags'}
                  </td>
                  <td className="px-5 py-4">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/meetings/${meeting.id}`} className="gap-1">
                        Ver detalhe
                        <ArrowUpRight size={14} />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
