'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { MeetingsTable } from '@/components/meetings/meetings-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMeetings } from '@/hooks/use-meetings';
import { statusLabel } from '@/lib/format';
import type { MeetingStatus } from '@/types/meeting';

const statusFilters: Array<{ value: 'ALL' | MeetingStatus; label: string }> = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'PENDING', label: statusLabel.PENDING },
  { value: 'UPLOADED', label: statusLabel.UPLOADED },
  { value: 'TRANSCRIBING', label: statusLabel.TRANSCRIBING },
  { value: 'TRANSCRIBED', label: statusLabel.TRANSCRIBED },
  { value: 'PROCESSING_AI', label: statusLabel.PROCESSING_AI },
  { value: 'COMPLETED', label: statusLabel.COMPLETED },
  { value: 'FAILED', label: statusLabel.FAILED }
];

export default function MeetingsPage(): JSX.Element {
  const { meetings, isLoading, error, loadMeetings } = useMeetings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MeetingStatus>('ALL');

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const filteredMeetings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return meetings.filter((meeting) => {
      const matchesTitle = query.length === 0 || meeting.title.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || meeting.status === statusFilter;
      return matchesTitle && matchesStatus;
    });
  }, [meetings, searchTerm, statusFilter]);

  return (
    <MainLayout
      title="Repositório de Reuniões"
      description="Lista completa com status do pipeline, metadados operacionais e acesso rápido ao detalhe de cada reunião."
      actions={
        <>
          <Button variant="secondary" onClick={() => void loadMeetings()}>
            Atualizar
          </Button>
          <Button asChild>
            <Link href="/meetings/new">Nova reunião</Link>
          </Button>
        </>
      }
    >
      {error ? (
        <p className="cais-alert-error">{error}</p>
      ) : null}

      <section className="cais-glass p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
          <label className="space-y-2 text-sm font-medium text-white">
            Buscar por título
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#0A4C78]/55"
              />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Ex.: Comitê de produto"
                className="pl-10"
              />
            </div>
          </label>

          <label className="space-y-2 text-sm font-medium text-white">
            Filtrar por status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | MeetingStatus)}
              className="h-11 w-full rounded-full border border-[rgba(255,255,255,0.28)] bg-white px-4 text-sm font-medium text-[#0A4C78] outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="secondary"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="md:mb-[1px]"
          >
            Limpar filtros
          </Button>
        </div>
      </section>

      <MeetingsTable
        meetings={filteredMeetings}
        emptyMessage={
          isLoading
            ? 'Carregando base de reuniões...'
            : 'Nenhuma reunião encontrada para os filtros aplicados.'
        }
      />
    </MainLayout>
  );
}
