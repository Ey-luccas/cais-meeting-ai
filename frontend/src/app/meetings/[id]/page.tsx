'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { MainLayout } from '@/components/layout/main-layout';
import { AudioTranscriptPanel } from '@/components/meetings/audio-transcript-panel';
import { MeetingDetailActions } from '@/components/meetings/meeting-detail-actions';
import { MeetingMetaGrid } from '@/components/meetings/meeting-meta-grid';
import { MeetingNotesPanel } from '@/components/meetings/meeting-notes-panel';
import { Button } from '@/components/ui/button';
import { useMeeting } from '@/hooks/use-meeting';
import { ApiError } from '@/lib/api';
import { meetingsModule } from '@/modules/meetings';
import type { Meeting } from '@/types/meeting';

const MeetingSkeleton = (): JSX.Element => {
  return (
    <MainLayout
      title="Carregando reunião"
      description="Preparando dados da reunião e notas de IA."
      eyebrow="Detalhe da reunião"
      actions={
        <Button variant="secondary" asChild>
          <Link href="/meetings">Voltar para reuniões</Link>
        </Button>
      }
    >
      <div className="rounded-2xl border border-[rgba(255,255,255,0.22)] bg-white/10 p-6 text-sm text-white/80">
        Carregando dados da reunião...
      </div>
    </MainLayout>
  );
};

export default function MeetingDetailsPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = useMemo(() => params.id, [params.id]);

  const { meeting, isLoading, error, reload } = useMeeting(id);
  const [optimisticMeeting, setOptimisticMeeting] = useState<Meeting | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading && !meeting && !optimisticMeeting) {
    return <MeetingSkeleton />;
  }

  if (error && !meeting && !optimisticMeeting) {
    return (
      <MainLayout
        title="Reunião não encontrada"
        description={error}
        eyebrow="Detalhe da reunião"
        actions={
          <Button variant="secondary" asChild>
            <Link href="/meetings">Voltar para reuniões</Link>
          </Button>
        }
      >
        <div className="cais-alert-error">{error}</div>
      </MainLayout>
    );
  }

  const currentMeeting = optimisticMeeting ?? meeting;
  if (!currentMeeting) {
    return <MeetingSkeleton />;
  }

  const handleDeleteMeeting = async (): Promise<void> => {
    const confirmed = window.confirm('Deseja realmente excluir esta reunião?');
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      await meetingsModule.remove(currentMeeting.id);
      router.push('/meetings');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Não foi possível excluir a reunião.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <MainLayout
      title={currentMeeting.title}
      description={currentMeeting.description ?? 'Sem descrição adicional para esta reunião.'}
      actions={
        <>
          <Button variant="secondary" onClick={() => void reload()}>
            Atualizar
          </Button>
          <Button variant="destructive" onClick={() => void handleDeleteMeeting()} disabled={isDeleting}>
            {isDeleting ? 'Excluindo...' : 'Excluir reunião'}
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/meetings">Voltar para reuniões</Link>
          </Button>
        </>
      }
      eyebrow="Detalhe da reunião"
    >
      <MeetingMetaGrid meeting={currentMeeting} />

      <MeetingDetailActions
        meeting={currentMeeting}
        onUpdated={(updatedMeeting) => {
          setOptimisticMeeting(updatedMeeting);
          void reload();
        }}
      />

      {error ? (
        <p className="cais-alert-error">{error}</p>
      ) : null}
      {deleteError ? (
        <p className="cais-alert-error">{deleteError}</p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:items-start">
        <div className="min-w-0">
          <AudioTranscriptPanel
            audioUrl={currentMeeting.audioUrl}
            transcriptText={currentMeeting.transcript?.fullText ?? null}
          />
        </div>

        <aside className="min-w-0">
          <MeetingNotesPanel note={currentMeeting.note} />
        </aside>
      </section>
    </MainLayout>
  );
}
