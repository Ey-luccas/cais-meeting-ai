'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  Download,
  ListChecks,
  MessageSquare,
  Share2,
  Sparkles,
} from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { cn } from '@/lib/utils';
import type { MeetingDetail, MeetingObservation, MeetingStatus } from '@/types/domain';

const statusLabel: Record<MeetingStatus, string> = {
  PENDING: 'Pendente',
  UPLOADED: 'Áudio enviado',
  TRANSCRIBING: 'Transcrevendo',
  TRANSCRIBED: 'Transcrito',
  PROCESSING_AI: 'Processando IA',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou'
};

const meetingStatusBadgeClass: Record<MeetingStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  UPLOADED: 'bg-blue-100 text-blue-700',
  TRANSCRIBING: 'bg-amber-100 text-amber-800',
  TRANSCRIBED: 'bg-cyan-100 text-cyan-800',
  PROCESSING_AI: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-[#B9DDFF] text-[#00478d]',
  FAILED: 'bg-[#ffdad6] text-[#93000a]'
};

const OBSERVATION_TYPES: Array<MeetingObservation['type']> = ['NOTE', 'TASK', 'QUESTION', 'IMPORTANT', 'DECISION'];

const observationTypeLabel: Record<MeetingObservation['type'], string> = {
  NOTE: 'Nota',
  TASK: 'Tarefa',
  QUESTION: 'Pergunta',
  IMPORTANT: 'Importante',
  DECISION: 'Decisão'
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('pt-BR');
};

const formatDateLabel = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const formatDuration = (totalSeconds: number | null): string => {
  if (!totalSeconds || totalSeconds <= 0) {
    return '00:00';
  }

  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDurationLong = (totalSeconds: number | null): string => {
  if (!totalSeconds || totalSeconds <= 0) {
    return 'Não informado';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
};

const formatTimestamp = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const priorityClassMap: Record<'low' | 'medium' | 'high' | 'urgent', string> = {
  low: 'bg-[#ecedf6] text-[#424752]',
  medium: 'bg-[#ffdea8] text-[#7c5800]',
  high: 'bg-[#ffdad6] text-[#93000a]',
  urgent: 'bg-[#ffdad6] text-[#93000a]'
};

const taskPriorityLabel: Record<'low' | 'medium' | 'high' | 'urgent', string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente'
};

const cardPriorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

const transcriptSegments = (
  meeting: MeetingDetail | null
): Array<{ timestamp: number; speaker: string; content: string; highlight?: string }> => {
  if (!meeting) {
    return [];
  }

  const observationSegments = [...meeting.observations]
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .slice(0, 6)
    .map((entry) => ({
      timestamp: entry.timestampSeconds,
      speaker: entry.author.name,
      content: entry.content,
      highlight: entry.type === 'TASK' ? `Ação: ${entry.content}` : undefined
    }));

  if (observationSegments.length > 0) {
    return observationSegments;
  }

  if (!meeting.transcript?.fullText) {
    return [];
  }

  const parts = meeting.transcript.fullText
    .split(/\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 6);

  return parts.map((content, index) => ({
    timestamp: index * 90,
    speaker: meeting.createdBy.name,
    content,
    highlight: index === 1 ? 'Ação identificada' : undefined
  }));
};

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; meetingId: string }>();
  const projectId = params?.projectId;
  const meetingId = params?.meetingId;
  const session = useAppSession();

  const [activeTab, setActiveTab] = useState<'transcription' | 'summary' | 'topics'>('transcription');

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [projectName, setProjectName] = useState('Projeto');
  const [canWrite, setCanWrite] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingObservation, setIsAddingObservation] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const [newObservationType, setNewObservationType] = useState<MeetingObservation['type']>('NOTE');
  const [newObservationContent, setNewObservationContent] = useState('');

  useConfigureAppShell({
    title: meeting?.title ?? 'Reunião',
    project: projectId ? { id: projectId, name: projectName } : undefined
  });

  const loadMeeting = useCallback(async () => {
    if (!session?.token || !projectId || !meetingId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [meetingPayload, projectPayload] = await Promise.all([
        api.getMeeting(session.token, meetingId),
        api.getProject(session.token, projectId)
      ]);

      setMeeting(meetingPayload);
      setProjectName(projectPayload.name);

      const actorMembership = projectPayload.members.find((entry) => entry.user.id === session.user.id);
      const canManageByOrg =
        session.activeOrganization.role === 'OWNER' || session.activeOrganization.role === 'ADMIN';
      const canManageByProject =
        actorMembership?.role === 'OWNER' ||
        actorMembership?.role === 'ADMIN' ||
        actorMembership?.role === 'MEMBER';

      setCanWrite(canManageByOrg || Boolean(canManageByProject));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar a reunião.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, projectId, session?.activeOrganization.role, session?.token, session?.user.id]);

  useEffect(() => {
    if (projectId && meetingId) {
      void loadMeeting();
    }
  }, [loadMeeting, meetingId, projectId]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const onLoadedMetadata = () => {
      setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const onTimeUpdate = () => {
      setAudioCurrentTime(audio.currentTime || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    onLoadedMetadata();

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [meeting?.audioUrl]);

  const canProcess = useMemo(() => {
    if (!meeting || !canWrite) {
      return false;
    }

    return Boolean(meeting.audioUrl);
  }, [canWrite, meeting]);

  const canGenerateMinutes = useMemo(() => {
    if (!meeting || !canWrite) {
      return false;
    }

    const hasTranscript = Boolean(meeting.transcript?.fullText?.trim());
    const hasAnalysis = Boolean(
      meeting.analysis?.summary ||
      meeting.analysis?.topics.length ||
      meeting.analysis?.decisions.length ||
      meeting.analysis?.tasks.length ||
      meeting.analysis?.pendingItems.length
    );

    return hasTranscript || hasAnalysis;
  }, [canWrite, meeting]);

  const transcriptBlocks = useMemo(() => transcriptSegments(meeting), [meeting]);

  const processingChecklist = useMemo(() => {
    const hasAudio = Boolean(meeting?.audioUrl);
    const hasTranscript = Boolean(meeting?.transcript);
    const hasAnalysis = Boolean(meeting?.analysis);

    return [
      { label: 'Áudio transcrito', done: hasAudio && hasTranscript },
      { label: 'Resumo gerado', done: hasAnalysis },
      { label: 'Tarefas extraídas', done: Boolean(meeting?.analysis?.tasks.length) }
    ];
  }, [meeting]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !meeting || !uploadFile || !canWrite) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await api.uploadMeetingAudio(session.token, meeting.id, uploadFile);
      setMeeting(updated);
      setUploadFile(null);
      setSuccessMessage('Áudio enviado com sucesso.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível enviar o áudio.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!session?.token || !meeting || !canProcess) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await api.processMeeting(session.token, meeting.id);
      setMeeting(updated);
      setSuccessMessage('Reunião processada com sucesso.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível processar a reunião.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!session?.token || !meeting || !canWrite) {
      return;
    }

    if (!window.confirm('Deseja excluir esta reunião? Esta ação é irreversível.')) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await api.deleteMeeting(session.token, meeting.id);
      router.push(`/projects/${projectId}/meetings`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível excluir a reunião.');
      }
      setIsDeleting(false);
    }
  };

  const handleGenerateMinutes = async (forceNew = false) => {
    if (!session?.token || !meeting || !projectId || !canGenerateMinutes) {
      return;
    }

    setIsGeneratingMinutes(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const generated = await api.generateMeetingMinutesLibrary(session.token, projectId, meeting.id, { forceNew });
      setSuccessMessage('Ata gerada com sucesso na biblioteca.');
      router.push(`/projects/${projectId}/library/documents/${generated.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409 && !forceNew) {
        const shouldCreateNew = window.confirm(
          'Já existe uma ata para esta reunião. Deseja gerar uma nova versão agora?'
        );

        if (shouldCreateNew) {
          await handleGenerateMinutes(true);
          return;
        }
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível gerar a ata da reunião.');
      }
    } finally {
      setIsGeneratingMinutes(false);
    }
  };

  const handleAddObservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !meeting || !canWrite) {
      return;
    }

    setIsAddingObservation(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.addMeetingObservation(session.token, meeting.id, {
        type: newObservationType,
        timestampSeconds: Math.floor(audioCurrentTime),
        content: newObservationContent
      });

      setNewObservationContent('');
      await loadMeeting();
      setSuccessMessage('Observação adicionada.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível adicionar observação.');
      }
    } finally {
      setIsAddingObservation(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSuccessMessage('Link copiado para a área de transferência.');
    } catch {
      setErrorMessage('Não foi possível copiar o link.');
    }
  };

  const handleExport = () => {
    if (!meeting) {
      return;
    }

    const lines: string[] = [];

    lines.push(`Reunião: ${meeting.title}`);
    lines.push(`Status: ${statusLabel[meeting.status]}`);
    lines.push(`Criada em: ${formatDateTime(meeting.createdAt)}`);
    lines.push('');

    if (meeting.analysis?.summary) {
      lines.push('Resumo:');
      lines.push(meeting.analysis.summary);
      lines.push('');
    }

    if (meeting.analysis?.decisions.length) {
      lines.push('Decisões:');
      meeting.analysis.decisions.forEach((decision) => lines.push(`- ${decision}`));
      lines.push('');
    }

    if (meeting.analysis?.tasks.length) {
      lines.push('Tarefas:');
      meeting.analysis.tasks.forEach((task) => {
        lines.push(`- ${task.title} [${taskPriorityLabel[task.priority]}]`);
        if (task.description) {
          lines.push(`  ${task.description}`);
        }
      });
      lines.push('');
    }

    if (meeting.transcript?.fullText) {
      lines.push('Transcrição:');
      lines.push(meeting.transcript.fullText);
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${meeting.title.replace(/\s+/g, '-').toLowerCase()}-report.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const togglePlay = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seekAudio = (event: React.MouseEvent<HTMLButtonElement>) => {
    const audio = audioRef.current;

    if (!audio || !audioDuration) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const nextTime = ratio * audioDuration;
    audio.currentTime = nextTime;
    setAudioCurrentTime(nextTime);
  };

  return (
    <>
          {isLoading ? (
            <div className="rounded-xl border border-[#c2c6d4] bg-white px-4 py-3 text-sm text-[#424752]">Carregando reuniao...</div>
          ) : null}

          {!isLoading && meeting ? (
            <div className="mx-auto grid min-w-0 w-full max-w-[1280px] grid-cols-12 gap-6">
              <section className="col-span-12 mb-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold', meetingStatusBadgeClass[meeting.status])}>
                        <Check className="h-3.5 w-3.5" />
                        {statusLabel[meeting.status]}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-[#424752]">
                        <CalendarDays className="h-4 w-4" />
                        {formatDateLabel(meeting.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-[#424752]">
                        <Clock3 className="h-4 w-4" />
                        {formatDurationLong(meeting.durationSeconds)}
                      </span>
                    </div>
                    <h1 className="break-words text-[48px] font-bold leading-[1.1] text-[#191c21]">{meeting.title}</h1>
                    {meeting.description ? <p className="mt-2 max-w-3xl text-sm text-[#424752]">{meeting.description}</p> : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#c2c6d4] bg-white px-4 py-2 text-sm font-semibold text-[#005eb8] transition-colors hover:bg-[#f2f3fb]"
                    >
                      <Share2 className="h-4 w-4" />
                      Compartilhar
                    </button>
                    <button
                      type="button"
                      onClick={handleExport}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#F9B51B] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#e0a318]"
                    >
                      <Download className="h-4 w-4" />
                      Exportar
                    </button>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-[#e1e2ea] bg-white p-4 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={togglePlay}
                      disabled={!meeting.audioUrl}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00478d] text-white transition-colors hover:bg-[#005eb8] disabled:cursor-not-allowed disabled:bg-[#c2c6d4]"
                    >
                      {isPlaying ? <span className="text-lg">||</span> : <span className="text-lg">▶</span>}
                    </button>

                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={seekAudio}
                        disabled={!meeting.audioUrl}
                        className="relative h-8 w-full overflow-hidden rounded bg-[#ecedf6]"
                      >
                        <div className="absolute inset-0 flex items-center gap-[3px] px-3 opacity-45">
                          {Array.from({ length: 42 }).map((_, index) => (
                            <span
                              key={index}
                              className="w-[3px] rounded-full bg-[#005eb8]"
                              style={{ height: `${6 + ((index * 7) % 18)}px` }}
                            />
                          ))}
                        </div>
                        <div
                          className="absolute inset-y-0 left-0 border-r border-[#005eb8] bg-[#B9DDFF]/60"
                          style={{ width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                        />
                      </button>
                      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#727783]">
                        <span>{formatDuration(Math.floor(audioCurrentTime))}</span>
                        <span>{formatDuration(Math.floor(audioDuration || meeting.durationSeconds || 0))}</span>
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-[#727783]">1x</span>
                  </div>

                  <audio ref={audioRef} src={meeting.audioUrl ?? undefined} className="hidden" preload="metadata" />
                </div>
              </section>

              <section className="col-span-12 grid min-w-0 grid-cols-12 gap-6">
                <div className="col-span-12 min-w-0 space-y-6 xl:col-span-8">
                  <div className="scrollbar-none flex gap-6 overflow-x-auto border-b border-[#e1e2ea]">
                    <button
                      type="button"
                      onClick={() => setActiveTab('transcription')}
                      className={cn(
                        'flex items-center gap-2 pb-3 text-sm font-bold transition-colors',
                        activeTab === 'transcription'
                          ? 'border-b-2 border-[#005eb8] text-[#005eb8]'
                          : 'text-[#424752] hover:text-[#005eb8]'
                      )}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Transcrição
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('summary')}
                      className={cn(
                        'flex items-center gap-2 pb-3 text-sm font-bold transition-colors',
                        activeTab === 'summary'
                          ? 'border-b-2 border-[#005eb8] text-[#005eb8]'
                          : 'text-[#424752] hover:text-[#005eb8]'
                      )}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Resumo
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('topics')}
                      className={cn(
                        'flex items-center gap-2 pb-3 text-sm font-bold transition-colors',
                        activeTab === 'topics'
                          ? 'border-b-2 border-[#005eb8] text-[#005eb8]'
                          : 'text-[#424752] hover:text-[#005eb8]'
                      )}
                    >
                      <ListChecks className="h-4 w-4" />
                      Tópicos
                    </button>
                  </div>

                  <div className="rounded-xl border border-[#e1e2ea] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)] md:p-8">
                    {activeTab === 'transcription' ? (
                      transcriptBlocks.length > 0 ? (
                        <div className="space-y-6">
                          {transcriptBlocks.map((entry, index) => (
                            <div
                              key={`${entry.timestamp}-${index}`}
                              className={cn(
                                'flex gap-4',
                                entry.highlight ? 'border-l-4 border-[#005eb8] bg-[#d6e3ff]/20 -mx-8 px-8 py-4' : ''
                              )}
                            >
                              <div className="mt-1 w-12 text-xs font-bold text-[#727783]">{formatTimestamp(entry.timestamp)}</div>
                              <div className="flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d6e3ff] text-[10px] font-bold text-[#00478d]">
                                    {getInitials(entry.speaker)}
                                  </span>
                                  <span className="text-sm font-bold text-[#191c21]">{entry.speaker}</span>
                                </div>
                                <p className="text-sm text-[#191c21]">{entry.content}</p>
                                {entry.highlight ? (
                                  <div className="mt-3 inline-flex items-center gap-2 rounded border border-[#a9c7ff] bg-[#B9DDFF]/50 px-3 py-1.5 text-xs font-bold text-[#00478d]">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {entry.highlight}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}

                          {meeting.transcript?.fullText ? (
                            <details className="rounded-lg border border-[#e1e2ea] bg-[#f9f9ff] p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[#424752]">Ver transcrição completa</summary>
                              <pre className="mt-3 whitespace-pre-wrap text-xs text-[#424752]">{meeting.transcript.fullText}</pre>
                            </details>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-[#727783]">Transcrição ainda não disponível.</p>
                      )
                    ) : null}

                    {activeTab === 'summary' ? (
                      <div className="space-y-4">
                        <div>
                          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#424752]">Resumo Executivo</h3>
                          <p className="text-sm text-[#191c21]">
                            {meeting.analysis?.summary || 'Resumo ainda não disponível para esta reunião.'}
                          </p>
                        </div>

                        {meeting.analysis?.report ? (
                          <div className="rounded-lg border border-[#e1e2ea] bg-[#f2f3fb] p-4">
                            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#424752]">Relatório operacional</h4>
                            <p className="text-sm text-[#191c21]">{meeting.analysis.report}</p>
                          </div>
                        ) : null}

                        <div>
                          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#424752]">Notas IA</h3>
                          {meeting.analysis?.notes.length ? (
                            <ul className="space-y-2">
                              {meeting.analysis.notes.map((note, index) => (
                                <li key={`${note}-${index}`} className="rounded-lg border border-[#e1e2ea] bg-[#f9f9ff] p-3 text-sm text-[#191c21]">
                                  {note}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-[#727783]">Sem notas complementares da IA.</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {activeTab === 'topics' ? (
                      <div className="space-y-5">
                        <div>
                          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#424752]">Tópicos</h3>
                          {meeting.analysis?.topics.length ? (
                            <div className="flex flex-wrap gap-2">
                              {meeting.analysis.topics.map((topic, index) => (
                                <span key={`${topic}-${index}`} className="rounded-full border border-[#c2c6d4] bg-white px-3 py-1 text-xs font-semibold text-[#424752]">
                                  {topic}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-[#727783]">Sem tópicos identificados.</p>
                          )}
                        </div>

                        <div>
                          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#424752]">Pendências</h3>
                          {meeting.analysis?.pendingItems.length ? (
                            <ul className="space-y-2">
                              {meeting.analysis.pendingItems.map((item, index) => (
                                <li key={`${item}-${index}`} className="rounded-lg border border-[#e1e2ea] bg-[#f9f9ff] p-3 text-sm text-[#191c21]">
                                  {item}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-[#727783]">Sem pendências identificadas.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="col-span-12 min-w-0 space-y-6 xl:col-span-4">
                  <section className="rounded-xl border border-[#e1e2ea] bg-[#ecedf6] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#191c21]">
                      <Sparkles className="h-5 w-5 text-[#005eb8]" />
                      Processamento de IA
                    </h3>

                    <div className="space-y-3">
                      {processingChecklist.map((step) => (
                        <div key={step.label} className="flex items-center gap-3">
                          <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', step.done ? 'bg-[#00478d] text-white' : 'bg-white text-[#727783] border border-[#c2c6d4]')}>
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm text-[#191c21]">{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-[#a9c7ff] bg-white/90 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#005eb8]">
                      <ListChecks className="h-5 w-5" />
                      Decisões-chave
                    </h3>

                    {meeting.analysis?.decisions.length ? (
                      <ul className="space-y-3">
                        {meeting.analysis.decisions.slice(0, 4).map((decision, index) => (
                          <li key={`${decision}-${index}`} className="flex items-start gap-2 rounded border border-[#e1e2ea] bg-white p-3 text-sm text-[#191c21]">
                            <span className="mt-0.5 text-[#F9B51B]">•</span>
                            {decision}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[#727783]">Sem decisões extraídas até o momento.</p>
                    )}
                  </section>

                  <section className="rounded-xl border border-[#e1e2ea] bg-[#ecedf6] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-[#191c21]">
                        <ClipboardList className="h-5 w-5 text-[#F9B51B]" />
                        Tarefas extraídas
                      </h3>
                      <Link href={`/projects/${projectId}/board`} className="text-xs font-bold text-[#005eb8] hover:underline">
                        Ver quadro
                      </Link>
                    </div>

                    <div className="space-y-3">
                      {meeting.analysis?.tasks.length ? (
                        meeting.analysis.tasks.slice(0, 3).map((task, index) => (
                          <article key={`${task.title}-${index}`} className="rounded-lg border border-[#e1e2ea] bg-white p-4 shadow-sm transition-colors hover:border-[#005eb8]">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase', priorityClassMap[task.priority])}>
                                {taskPriorityLabel[task.priority]}
                              </span>
                              <Sparkles className="h-4 w-4 text-[#727783]" />
                            </div>
                            <h4 className="mb-2 text-sm font-bold text-[#191c21]">{task.title}</h4>
                            {task.description ? <p className="mb-3 text-xs text-[#424752]">{task.description}</p> : null}
                            <div className="flex items-center justify-between text-[11px] text-[#727783]">
                              <span>
                                {task.dueDate ? formatDateLabel(task.dueDate) : 'Sem prazo'}
                              </span>
                              <span>{task.assignees.length ? task.assignees.join(', ') : 'Sem responsável'}</span>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="text-sm text-[#727783]">Sem tarefas extraídas pela IA.</p>
                      )}
                    </div>
                  </section>
                </aside>
              </section>

              <section className="col-span-12 grid grid-cols-12 gap-6">
                <div className="col-span-12 rounded-xl border border-[#e1e2ea] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)] xl:col-span-8">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#191c21]">Observações</h3>
                    <span className="text-xs font-semibold text-[#727783]">timestamp atual: {formatTimestamp(audioCurrentTime)}</span>
                  </div>

                  {canWrite ? (
                    <form className="mb-5 space-y-2" onSubmit={handleAddObservation}>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <select
                          value={newObservationType}
                          onChange={(event) => setNewObservationType(event.target.value as MeetingObservation['type'])}
                          className="h-10 rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none"
                        >
                          {OBSERVATION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {observationTypeLabel[type]}
                            </option>
                          ))}
                        </select>
                        <input
                          value={formatTimestamp(audioCurrentTime)}
                          readOnly
                          className="h-10 rounded-lg border border-[#c2c6d4] bg-[#f2f3fb] px-3 text-sm text-[#727783]"
                        />
                        <button
                          type="submit"
                          disabled={isAddingObservation || !newObservationContent.trim()}
                          className="rounded-lg bg-[#005eb8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004f9b] disabled:opacity-60"
                        >
                          {isAddingObservation ? 'Salvando...' : 'Adicionar observação'}
                        </button>
                      </div>

                      <textarea
                        value={newObservationContent}
                        onChange={(event) => setNewObservationContent(event.target.value)}
                        rows={3}
                        placeholder="Registrar observação manual"
                        className="w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 py-2 text-sm text-[#191c21] outline-none"
                      />
                    </form>
                  ) : null}

                  {meeting.observations.length ? (
                    <div className="space-y-2">
                      {[...meeting.observations]
                        .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
                        .map((observation) => (
                          <div key={observation.id} className="rounded-lg border border-[#e1e2ea] bg-[#f9f9ff] p-3">
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[#727783]">
                              <span className="rounded bg-white px-2 py-0.5 font-semibold text-[#424752]">{observationTypeLabel[observation.type]}</span>
                              <span>{formatTimestamp(observation.timestampSeconds)}</span>
                              <span>{observation.author.name}</span>
                            </div>
                            <p className="text-sm text-[#191c21]">{observation.content}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#727783]">Nenhuma observação registrada.</p>
                  )}
                </div>

                <div className="col-span-12 space-y-6 xl:col-span-4">
                  <section className="rounded-xl border border-[#e1e2ea] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                    <h3 className="mb-4 text-lg font-semibold text-[#191c21]">Ações da reunião</h3>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleProcess}
                        disabled={isProcessing || !canProcess}
                        className="w-full rounded-lg bg-[#005eb8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#004f9b] disabled:opacity-60"
                      >
                        {isProcessing ? 'Processando...' : 'Processar reunião'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleGenerateMinutes()}
                        disabled={isGeneratingMinutes || !canGenerateMinutes}
                        className="w-full rounded-lg border border-[#9fc3ef] bg-[#eaf3ff] px-4 py-2.5 text-sm font-semibold text-[#004f9b] transition-colors hover:bg-[#dcecff] disabled:opacity-60"
                      >
                        {isGeneratingMinutes ? 'Gerando ata...' : 'Gerar ata'}
                      </button>

                      <form className="space-y-2" onSubmit={handleUpload}>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                          className="w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 py-2 text-sm text-[#191c21]"
                        />
                        <button
                          type="submit"
                          disabled={isUploading || !uploadFile || !canWrite}
                          className="w-full rounded-lg border border-[#c2c6d4] px-4 py-2.5 text-sm font-semibold text-[#424752] transition-colors hover:bg-[#f2f3fb] disabled:opacity-60"
                        >
                          {isUploading ? 'Enviando áudio...' : 'Enviar novo áudio'}
                        </button>
                      </form>

                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteMeeting()}
                          disabled={isDeleting}
                          className="w-full rounded-lg border border-[#ffdad6] bg-[#ffdad6]/50 px-4 py-2.5 text-sm font-semibold text-[#93000a] transition-colors hover:bg-[#ffdad6] disabled:opacity-60"
                        >
                          {isDeleting ? 'Excluindo...' : 'Excluir reunião'}
                        </button>
                      ) : null}

                      <Link
                        href={`/projects/${projectId}/meetings`}
                        className="block w-full rounded-lg border border-[#c2c6d4] px-4 py-2.5 text-center text-sm font-semibold text-[#424752] transition-colors hover:bg-[#f2f3fb]"
                      >
                        Voltar para reuniões
                      </Link>
                    </div>
                  </section>

                  <section className="rounded-xl border border-[#e1e2ea] bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                    <h3 className="mb-4 text-lg font-semibold text-[#191c21]">Cards gerados</h3>

                    {meeting.generatedCards.length ? (
                      <div className="space-y-2">
                        {meeting.generatedCards.slice(0, 4).map((card) => (
                          <div key={card.id} className="rounded-lg border border-[#e1e2ea] bg-[#f9f9ff] p-3">
                            <p className="text-sm font-semibold text-[#191c21]">{card.title}</p>
                            <p className="mt-1 text-xs text-[#727783]">
                              {card.column.title}
                              {card.priority ? ` • ${cardPriorityLabel[card.priority]}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#727783]">Ainda não há cards gerados para esta reunião.</p>
                    )}
                  </section>
                </div>
              </section>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="mx-auto mt-4 w-full max-w-[1280px] rounded-lg border border-[#ffdad6] bg-[#ffdad6]/40 px-4 py-3 text-sm text-[#93000a]">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="mx-auto mt-4 w-full max-w-[1280px] rounded-lg border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75]">
              {successMessage}
            </p>
          ) : null}
    </>
  );
}
