'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic,
  Pause,
  Play,
  Send,
  Square,
  UploadCloud,
} from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { cn } from '@/lib/utils';

type QuickNoteType = 'NOTE' | 'TASK' | 'DECISION';

type QuickNote = {
  id: string;
  type: QuickNoteType;
  timestamp: string;
  content: string;
};

const quickTypeLabel: Record<QuickNoteType, string> = {
  NOTE: 'Nota',
  TASK: 'Tarefa',
  DECISION: 'Decisão'
};

const quickTypeClass: Record<QuickNoteType, string> = {
  NOTE: 'bg-[#ecedf6] text-[#424752]',
  TASK: 'bg-[#ffdea8] text-[#7c5800]',
  DECISION: 'bg-[#d6e3ff] text-[#00478d]'
};

const formatTimer = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function NewMeetingPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;
  const session = useAppSession();

  const [projectName, setProjectName] = useState('Projeto');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [quickType, setQuickType] = useState<QuickNoteType>('NOTE');
  const [quickInput, setQuickInput] = useState('');
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const accumulatedMsRef = useRef(0);
  const startedAtMsRef = useRef<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useConfigureAppShell({
    title: 'Nova reunião',
    project: projectId ? { id: projectId, name: projectName } : undefined
  });

  useEffect(() => {
    if (session?.token && projectId) {
      void api
        .getProject(session.token, projectId)
        .then((project) => setProjectName(project.name))
        .catch(() => {
          setProjectName('Projeto');
        });
    }
  }, [projectId, session?.token]);

  useEffect(() => {
    if (recordingState !== 'recording') {
      return;
    }

    const interval = window.setInterval(() => {
      const startedAt = startedAtMsRef.current;

      if (!startedAt) {
        return;
      }

      const currentMs = accumulatedMsRef.current + (Date.now() - startedAt);
      setElapsedSeconds(currentMs / 1000);
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [recordingState]);

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordingUrl]);

  const hasAnyAudio = useMemo(() => Boolean(audioFile || recordedBlob), [audioFile, recordedBlob]);

  const resetRecordedAudio = () => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }

    setRecordedBlob(null);
    setRecordingUrl(null);
  };

  const attachFile = (file: File | null) => {
    setAudioFile(file);

    if (file) {
      resetRecordedAudio();
      setRecordingState('idle');
      setElapsedSeconds(0);
      accumulatedMsRef.current = 0;
      startedAtMsRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Seu navegador não suporta gravação de áudio no navegador.');
      return;
    }

    setErrorMessage(null);

    if (recordingState === 'paused' && recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      startedAtMsRef.current = Date.now();
      setRecordingState('recording');
      return;
    }

    if (recordingState === 'recording') {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];
      accumulatedMsRef.current = 0;
      startedAtMsRef.current = Date.now();
      setElapsedSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

        resetRecordedAudio();
        setRecordedBlob(blob);
        setAudioFile(null);
        setRecordingUrl(URL.createObjectURL(blob));

        const totalMs =
          accumulatedMsRef.current +
          (startedAtMsRef.current ? Date.now() - startedAtMsRef.current : 0);
        setElapsedSeconds(totalMs / 1000);

        startedAtMsRef.current = null;
        accumulatedMsRef.current = 0;

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecordingState('idle');
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();

      setRecordingState('recording');
    } catch {
      setErrorMessage('Não foi possível iniciar a gravação. Verifique as permissões do microfone.');
    }
  };

  const pauseRecording = () => {
    if (!recorderRef.current || recorderRef.current.state !== 'recording') {
      return;
    }

    recorderRef.current.pause();

    if (startedAtMsRef.current) {
      accumulatedMsRef.current += Date.now() - startedAtMsRef.current;
      startedAtMsRef.current = null;
      setElapsedSeconds(accumulatedMsRef.current / 1000);
    }

    setRecordingState('paused');
  };

  const stopRecording = () => {
    if (!recorderRef.current || (recorderRef.current.state !== 'recording' && recorderRef.current.state !== 'paused')) {
      return;
    }

    if (recorderRef.current.state === 'recording' && startedAtMsRef.current) {
      accumulatedMsRef.current += Date.now() - startedAtMsRef.current;
      startedAtMsRef.current = null;
    }

    recorderRef.current.stop();
  };

  const addQuickNote = () => {
    const content = quickInput.trim();

    if (!content) {
      return;
    }

    setQuickNotes((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: quickType,
        timestamp: formatTimer(elapsedSeconds),
        content
      },
      ...current
    ]);

    setQuickInput('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payloadAudio =
        audioFile ??
        (recordedBlob
          ? new File([recordedBlob], `meeting-record-${Date.now()}.webm`, {
              type: recordedBlob.type || 'audio/webm'
            })
          : undefined);

      const meeting = await api.createMeeting(session.token, projectId, {
        title,
        description: description || undefined,
        audio: payloadAudio
      });

      if (payloadAudio) {
        try {
          await api.processMeeting(session.token, meeting.id);
        } catch {
          // keep flow moving to detail page even if processing trigger fails
        }
      }

      router.push(`/projects/${projectId}/meetings/${meeting.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível criar a reunião.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <>
        <main className="grid min-w-0 w-full grid-cols-12 gap-8">
          <form className="col-span-12 min-w-0 space-y-8 lg:col-span-8" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <h1 className="break-words text-[32px] font-semibold text-[#191c21]">Nova reunião com IA</h1>
              <p className="text-sm text-[#424752]">
                Grave ou envie o áudio. O Cais Teams transcreve, resume e extrai tarefas automaticamente.
              </p>
              <p className="text-xs text-[#727783]">Projeto: {projectName}</p>
            </div>

            <section className="rounded-xl border border-[#c2c6d4] bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
              <div className="space-y-6">
                <div>
                  <label htmlFor="meeting-title" className="mb-2 block text-sm font-bold text-[#191c21]">
                    Título da reunião
                  </label>
                  <input
                    id="meeting-title"
                    className="h-12 w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-4 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                    placeholder="Ex.: Reunião de alinhamento do trimestre"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="meeting-description" className="mb-2 block text-sm font-bold text-[#191c21]">
                    Descrição / contexto
                  </label>
                  <textarea
                    id="meeting-description"
                    className="w-full resize-none rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-4 py-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                    placeholder="Contexto rápido sobre esta reunião..."
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <article className="flex flex-col items-center justify-center space-y-6 rounded-xl border border-[#c2c6d4] bg-white p-8 text-center shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffdad6] text-[#ba1a1a]">
                  <Mic className="h-8 w-8" />
                </div>

                <div>
                  <h3 className="mb-1 text-base font-semibold text-[#191c21]">Gravar áudio direto</h3>
                  <p className="text-sm text-[#424752]">Capture o áudio da reunião no navegador.</p>
                </div>

                <div className="flex w-full items-center justify-center gap-4 rounded-xl bg-[#ecedf6] p-4">
                  <span className="font-mono text-[32px] font-bold tracking-wider text-[#191c21]">{formatTimer(elapsedSeconds)}</span>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ba1a1a] text-white transition-opacity hover:opacity-90"
                    aria-label={recordingState === 'paused' ? 'Retomar gravação' : 'Iniciar gravação'}
                  >
                    <Play className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={pauseRecording}
                    disabled={recordingState !== 'recording'}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e1e2ea] text-[#191c21] transition-colors hover:bg-[#d8dae2] disabled:opacity-50"
                    aria-label="Pausar gravação"
                  >
                    <Pause className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={recordingState === 'idle'}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e1e2ea] text-[#191c21] transition-colors hover:bg-[#d8dae2] disabled:opacity-50"
                    aria-label="Parar gravação"
                  >
                    <Square className="h-5 w-5" />
                  </button>
                </div>

                {recordingUrl ? (
                  <audio controls src={recordingUrl} className="w-full" />
                ) : (
                  <p className="text-xs text-[#727783]">
                    {recordingState === 'recording'
                      ? 'Gravação em andamento...'
                      : recordingState === 'paused'
                        ? 'Gravação pausada.'
                        : 'Inicie a gravação para capturar o áudio.'}
                  </p>
                )}
              </article>

              <article
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all',
                  isDragOver
                    ? 'border-[#005eb8] bg-[#ecedf6]'
                    : 'border-[#c2c6d4] bg-white hover:border-[#005eb8] hover:bg-[#f2f3fb]'
                )}
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragOver(false);
                  const file = event.dataTransfer.files?.[0] ?? null;
                  attachFile(file);
                }}
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ecedf6] text-[#424752]">
                  <UploadCloud className="h-8 w-8" />
                </div>

                <h3 className="mb-2 text-base font-semibold text-[#191c21]">Enviar arquivo de áudio</h3>
                <p className="mb-6 text-sm text-[#424752]">
                  Arraste e solte MP3, WAV ou M4A aqui.
                  <br />
                  Tamanho máximo: 500MB.
                </p>

                <button
                  type="button"
                  className="rounded-lg border border-[#727783] px-6 py-2 text-sm font-semibold text-[#191c21] transition-colors hover:bg-[#ecedf6]"
                >
                  Selecionar arquivo
                </button>

                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    attachFile(nextFile);
                  }}
                />

                {audioFile ? (
                  <p className="mt-4 text-xs font-semibold text-[#005eb8]">Selecionado: {audioFile.name}</p>
                ) : null}
              </article>
            </section>

            <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#a9c7ff] bg-[#d6e3ff] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#005eb8]">
                  <Mic className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="mb-1 text-base font-semibold text-[#001b3d]">Pronto para processar com IA</h4>
                  <p className="text-sm text-[#00468c]">
                    O sistema vai gerar resumo, transcrição e tarefas automaticamente.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="whitespace-nowrap rounded-lg bg-[#005eb8] px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? 'Criando...' : 'Criar e processar com IA'}
              </button>
            </section>

            {hasAnyAudio ? (
              <p className="text-sm text-[#424752]">
                Áudio pronto: <span className="font-semibold">{audioFile ? audioFile.name : 'Gravação do navegador'}</span>
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-lg border border-[#ffdad6] bg-[#ffdad6]/45 px-4 py-3 text-sm text-[#93000a]">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="rounded-lg border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75]">
                {successMessage}
              </p>
            ) : null}
          </form>

          <aside className="col-span-12 min-w-0 lg:col-span-4">
            <div className="flex h-auto max-h-none flex-col overflow-hidden rounded-xl border border-[#c2c6d4] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.04)] lg:sticky lg:top-24 lg:h-[calc(100vh-140px)]">
              <div className="flex items-center justify-between border-b border-[#c2c6d4] p-6">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[#191c21]">
                  <Mic className="h-5 w-5 text-[#727783]" />
                  Captura rápida
                </h3>
                <span className="rounded-full bg-[#ecedf6] px-2 py-1 text-xs font-bold text-[#424752]">Ao vivo</span>
              </div>

              <div className="scrollbar-none flex-1 space-y-4 overflow-y-auto bg-[#f9f9ff] p-6">
                <p className="mb-6 text-center text-sm text-[#727783]">
                  Registre notas manuais durante a gravação. Elas recebem horário e entram junto com os insights da IA.
                </p>

                {quickNotes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#c2c6d4] bg-white p-4 text-sm text-[#727783]">
                    Nenhuma nota rápida ainda.
                  </div>
                ) : null}

                {quickNotes.map((note) => (
                  <article key={note.id} className="rounded-lg border border-[#c2c6d4] bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', quickTypeClass[note.type])}>
                        {quickTypeLabel[note.type]}
                      </span>
                      <span className="font-mono text-xs text-[#727783]">{note.timestamp}</span>
                    </div>
                    <p className="text-sm text-[#191c21]">{note.content}</p>
                  </article>
                ))}
              </div>

              <div className="rounded-b-xl border-t border-[#c2c6d4] bg-white p-4">
                <div className="mb-3 flex gap-2">
                  {(['NOTE', 'TASK', 'DECISION'] as QuickNoteType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setQuickType(type)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                        quickType === type
                          ? 'bg-[#d6e3ff] text-[#00478d]'
                          : 'bg-[#ecedf6] text-[#424752] hover:bg-[#e1e2ea]'
                      )}
                    >
                      {quickTypeLabel[type]}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    value={quickInput}
                    onChange={(event) => setQuickInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addQuickNote();
                      }
                    }}
                    className="h-12 w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] pl-4 pr-10 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                    placeholder="Digite uma nota rápida e pressione Enter..."
                    type="text"
                  />
                  <button
                    type="button"
                    onClick={addQuickNote}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#005eb8] transition-colors hover:text-[#00478d]"
                    aria-label="Enviar nota rápida"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </main>
    </>
  );
}
