'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Pause, Play, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MicrophonePermission = 'idle' | 'granted' | 'denied';

export type AudioRecordingResult = {
  blob: Blob;
  file: File;
  mimeType: string;
  durationSeconds: number;
  startedAt: string;
  finishedAt: string;
  previewUrl: string;
};

type AudioRecorderProps = {
  disabled?: boolean;
  className?: string;
  fileNamePrefix?: string;
  onAudioReady: (file: File) => void;
  onRecordingComplete?: (result: AudioRecordingResult) => void;
  onError?: (message: string) => void;
};

const getFileExtensionFromMime = (mimeType: string): string => {
  if (mimeType.includes('ogg')) {
    return '.ogg';
  }

  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    return '.m4a';
  }

  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    return '.mp3';
  }

  return '.webm';
};

const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');

  const restSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${restSeconds}`;
};

export const AudioRecorder = ({
  disabled = false,
  className,
  fileNamePrefix = 'recording',
  onAudioReady,
  onRecordingComplete,
  onError
}: AudioRecorderProps): JSX.Element => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<string | null>(null);
  const elapsedSecondsRef = useRef(0);

  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<MicrophonePermission>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        typeof MediaRecorder !== 'undefined' &&
        !!navigator?.mediaDevices?.getUserMedia
    );
  }, []);

  useEffect(() => {
    if (!isRecording || isPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const next = current + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [previewUrl]);

  const resetRecorderState = () => {
    setIsRecording(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    startedAtRef.current = null;
  };

  const emitError = (message: string) => {
    setError(message);
    onError?.(message);
  };

  const parseMicrophoneError = (error: unknown): string => {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        setPermission('denied');
        return 'Permissão de microfone negada. Autorize o acesso nas configurações do navegador.';
      }

      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return 'Nenhum microfone disponível foi encontrado neste dispositivo.';
      }
    }

    return 'Não foi possível acessar o microfone neste navegador.';
  };

  const startRecording = async () => {
    if (!isSupported || disabled) {
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission('granted');
      const preferredMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : undefined;

      const recorder = new MediaRecorder(
        stream,
        preferredMimeType ? { mimeType: preferredMimeType } : undefined
      );

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setElapsedSeconds(0);
      elapsedSecondsRef.current = 0;
      setIsPaused(false);
      startedAtRef.current = new Date().toISOString();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const startedAt = startedAtRef.current ?? new Date().toISOString();
        const finishedAt = new Date().toISOString();

        if (blob.size > 0) {
          const extension = getFileExtensionFromMime(mimeType);
          const fileName = `${fileNamePrefix}-${Date.now()}${extension}`;
          const file = new File([blob], fileName, { type: mimeType });

          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }

          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          onAudioReady(file);
          onRecordingComplete?.({
            blob,
            file,
            mimeType,
            durationSeconds: elapsedSecondsRef.current,
            startedAt,
            finishedAt,
            previewUrl: url
          });
        }

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        resetRecorderState();
      };

      recorder.start();
      setIsRecording(true);
    } catch (permissionError) {
      emitError(parseMicrophoneError(permissionError));
    }
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      return;
    }

    recorder.pause();
    setIsPaused(true);
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') {
      return;
    }

    recorder.resume();
    setIsPaused(false);
  };

  const finishRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.stop();
  };

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-[#F2B11B]/55 bg-[#F2B11B]/14 px-4 py-3 text-sm text-[#7A5B10]">
        <p className="inline-flex items-center gap-2">
          <AlertCircle size={14} />
          Seu navegador não suporta gravação de áudio com MediaRecorder.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-3 rounded-2xl border border-[#0A4C78]/14 bg-white p-4 text-[#0A4C78]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#0A4C78]">Gravação no navegador</p>
        <span className="rounded-full border border-[#0A4C78]/16 bg-[#0A4C78]/[0.04] px-3 py-1 font-mono text-sm text-[#0A4C78]">
          {formatTimer(elapsedSeconds)}
        </span>
      </div>

      {permission === 'denied' ? (
        <p className="text-xs text-red-600">
          O acesso ao microfone está bloqueado neste navegador.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!isRecording ? (
          <Button type="button" variant="ghost" onClick={() => void startRecording()} disabled={disabled}>
            <Play size={16} />
            Iniciar
          </Button>
        ) : null}

        {isRecording && !isPaused ? (
          <Button type="button" variant="ghost" onClick={pauseRecording} disabled={disabled}>
            <Pause size={16} />
            Pausar
          </Button>
        ) : null}

        {isRecording && isPaused ? (
          <Button type="button" variant="ghost" onClick={resumeRecording} disabled={disabled}>
            <Play size={16} />
            Continuar
          </Button>
        ) : null}

        {isRecording ? (
          <Button type="button" variant="destructive" onClick={finishRecording} disabled={disabled}>
            <Square size={16} />
            Finalizar
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-[#0A4C78]/72">
        Inicie a gravação, pause quando necessário e finalize para gerar o áudio com preview.
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {previewUrl ? (
        <div className="space-y-2">
          <p className="text-xs tracking-[0.14em] text-[#0A4C78]/68 uppercase">Preview da gravação</p>
          <audio controls src={previewUrl} className="w-full" />
        </div>
      ) : null}
    </div>
  );
};
