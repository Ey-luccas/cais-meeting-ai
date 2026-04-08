'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Cpu, ListChecks } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { InformativeBlock } from '@/components/meetings/informative-block';
import { MeetingsTable } from '@/components/meetings/meetings-table';
import { RecentActivity } from '@/components/meetings/recent-activity';
import { InfoCard } from '@/components/shared/info-card';
import { Button } from '@/components/ui/button';
import { useMeetings } from '@/hooks/use-meetings';

export default function DashboardPage(): JSX.Element {
  const { meetings, isLoading, error, completedCount, processingCount, loadMeetings } = useMeetings();

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const pendingCount = meetings.filter((meeting) => {
    return meeting.status === 'PENDING' || meeting.status === 'FAILED';
  }).length;

  const recentMeetings = meetings.slice(0, 5);

  return (
    <MainLayout
      title="Visão Executiva das Reuniões"
      description="Monitore o pipeline de captura, transcrição e análise com visão operacional em tempo real."
      actions={
        <>
          <Button variant="secondary" onClick={() => void loadMeetings()}>
            Atualizar
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/meetings">Ver todas</Link>
          </Button>
          <Button asChild>
            <Link href="/meetings/new">Nova reunião</Link>
          </Button>
        </>
      }
    >
      <section className="cais-glass px-5 py-4 text-white">
        <p className="cais-section-title">Header interno</p>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl">Painel operacional de reuniões</h2>
            <p className="text-sm text-white/80">
              Acompanhe rapidamente o que foi concluído, o que está processando e o que precisa de ação.
            </p>
          </div>
          <Button asChild>
            <Link href="/meetings/new">Nova reunião</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          title="Total de reuniões"
          value={String(meetings.length)}
          description="Base consolidada de reuniões registradas."
          icon={ListChecks}
        />
        <InfoCard
          title="Concluídas"
          value={String(completedCount)}
          description="Reuniões com notas inteligentes prontas para consulta."
          icon={CheckCircle2}
        />
        <InfoCard
          title="Em processamento"
          value={String(processingCount)}
          description="Itens em captura, transcrição ou análise de IA."
          icon={Cpu}
        />
        <InfoCard
          title="Pendências"
          value={String(pendingCount)}
          description="Itens pendentes ou com falha que exigem ação."
          icon={AlertTriangle}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <InformativeBlock
          title="Conectado ao backend REST"
          text="O dashboard consome a API Express em tempo real com estado de carregamento, falha e atualização manual."
        />
        <InformativeBlock
          title="Pipeline Groq + DeepSeek"
          text="A camada de módulos já contempla chamadas de upload, transcrição, geração de notas e processamento completo."
        />
        <InformativeBlock
          title="Visual institucional"
          text="Consistência visual entre landing, dashboard e páginas de reunião com foco em clareza, confiança e rastreabilidade."
        />
      </section>

      {error ? (
        <p className="cais-alert-error">{error}</p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-white">Reuniões recentes</h2>
          <MeetingsTable
            meetings={recentMeetings}
            emptyMessage={isLoading ? 'Carregando reuniões...' : 'Nenhuma reunião encontrada.'}
          />
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-2xl text-white">Atividade recente</h2>
          <RecentActivity meetings={meetings} />
        </div>
      </section>
    </MainLayout>
  );
}
