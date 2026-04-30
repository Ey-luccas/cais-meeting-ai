'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type { MeetingStatus, MeetingSummary } from '@/types/domain';

const statusLabel: Record<MeetingStatus, string> = {
  PENDING: 'Pendente',
  UPLOADED: 'Áudio enviado',
  TRANSCRIBING: 'Transcrevendo',
  TRANSCRIBED: 'Transcrito',
  PROCESSING_AI: 'Processando IA',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou'
};

const statusClassName: Record<MeetingStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  UPLOADED: 'bg-blue-100 text-blue-700',
  TRANSCRIBING: 'bg-amber-100 text-amber-800',
  TRANSCRIBED: 'bg-cyan-100 text-cyan-800',
  PROCESSING_AI: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-700'
};

export default function ProjectMeetingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;
  const session = useAppSession();

  const [projectName, setProjectName] = useState('Projeto');
  const [projectColor, setProjectColor] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useConfigureAppShell({
    title: 'Reuniões',
    project: { id: projectId ?? '', name: projectName, color: projectColor }
  });

  const loadData = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [project, meetingsPayload] = await Promise.all([
        api.getProject(session.token, projectId),
        api.listMeetings(session.token, projectId)
      ]);

      setProjectName(project.name);
      setProjectColor(project.color);
      setMeetings(meetingsPayload.meetings);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar as reuniões do projeto.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session?.token]);

  useEffect(() => {
    if (projectId) {
      void loadData();
    }
  }, [loadData, projectId]);

  const totals = useMemo(() => {
    return {
      all: meetings.length,
      completed: meetings.filter((entry) => entry.status === 'COMPLETED').length,
      processing: meetings.filter((entry) => entry.status === 'TRANSCRIBING' || entry.status === 'PROCESSING_AI').length,
      failed: meetings.filter((entry) => entry.status === 'FAILED').length
    };
  }, [meetings]);

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Reuniões"
          description="Centralize gravações, transcrição e análise inteligente por reunião."
          actions={
            <>
              <Button variant="subtle" onClick={() => void loadData()} disabled={isLoading}>
                Atualizar
              </Button>
              <Button asChild>
                <Link href={`/projects/${projectId}/meetings/new`}>Nova reunião</Link>
              </Button>
            </>
          }
        />

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Resumo de reuniões</CardTitle>
            <CardDescription>Panorama de status e andamento das reuniões do projeto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="surface-soft p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#567188]">Total</p>
                <p className="font-display text-3xl font-bold text-[#0A4C78]">{totals.all}</p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#567188]">Concluídas</p>
                <p className="font-display text-3xl font-bold text-[#0A4C78]">{totals.completed}</p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#567188]">Em processamento</p>
                <p className="font-display text-3xl font-bold text-[#0A4C78]">{totals.processing}</p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#567188]">Falhas</p>
                <p className="font-display text-3xl font-bold text-[#0A4C78]">{totals.failed}</p>
              </div>
            </div>

            {isLoading ? <p className="text-sm text-[#567188]">Carregando reuniões...</p> : null}

            {!isLoading && meetings.length === 0 ? (
              <div className="surface-soft px-4 py-3 text-sm text-[#567188]">
                <p className="font-semibold text-[#35536B]">Nenhuma reunião registrada neste projeto.</p>
                <p className="mt-1">Crie uma reunião para começar a gerar transcrições e notas com IA.</p>
              </div>
            ) : null}

            {!isLoading ? (
              <div className="grid gap-3">
                {meetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/projects/${projectId}/meetings/${meeting.id}`}
                    className="surface-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1565C0]/35"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[#0A4C78]">{meeting.title}</h3>
                        <p className="text-xs text-[#567188]">
                          {new Date(meeting.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge className={statusClassName[meeting.status]}>{statusLabel[meeting.status]}</Badge>
                    </div>

                    {meeting.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-[#35536B]">{meeting.description}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#567188]">
                      <span>{meeting.durationSeconds ? `${meeting.durationSeconds}s` : 'Sem duração'}</span>
                      <span>{meeting.hasTranscript ? 'Com transcrição' : 'Sem transcrição'}</span>
                      <span>{meeting.hasAnalysis ? 'Com análise IA' : 'Sem análise IA'}</span>
                      <span>{meeting.observationsCount} observações</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}

            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
