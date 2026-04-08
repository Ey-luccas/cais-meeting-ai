'use client';

import { useState } from 'react';
import { LoaderCircle, Sparkles, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { isFileTooLarge, MAX_UPLOAD_FILE_SIZE_MB } from '@/lib/upload';
import { meetingsModule } from '@/modules/meetings';
import type { Meeting, MeetingStatus } from '@/types/meeting';

type MeetingDetailActionsProps = {
  meeting: Meeting;
  onUpdated: (meeting: Meeting) => void;
};

const isReadyForTranscription = (status: MeetingStatus): boolean => {
  return status === 'UPLOADED' || status === 'FAILED' || status === 'PENDING';
};

const isReadyForNotes = (meeting: Meeting): boolean => {
  if (!meeting.transcript) {
    return false;
  }

  return meeting.status !== 'TRANSCRIBING' && meeting.status !== 'PROCESSING_AI';
};

export const MeetingDetailActions = ({ meeting, onUpdated }: MeetingDetailActionsProps): JSX.Element => {
  const [file, setFile] = useState<File | null>(null);
  const [loadingAction, setLoadingAction] = useState<'upload' | 'transcribe' | 'generateNotes' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (candidate: File | null) => {
    if (!candidate) {
      setFile(null);
      return;
    }

    if (isFileTooLarge(candidate)) {
      setFile(null);
      setError(`Arquivo excede o limite de ${MAX_UPLOAD_FILE_SIZE_MB} MB.`);
      return;
    }

    setError(null);
    setFile(candidate);
  };

  const runAction = async (
    action: 'upload' | 'transcribe' | 'generateNotes',
    handler: () => Promise<Meeting>
  ) => {
    setError(null);
    setSuccess(null);
    setLoadingAction(action);

    try {
      const updatedMeeting = await handler();
      onUpdated(updatedMeeting);
      if (action === 'upload') {
        setFile(null);
      }
      if (action === 'transcribe') {
        setSuccess('Transcrição concluída com sucesso.');
      } else if (action === 'generateNotes') {
        setSuccess('Notas inteligentes geradas com sucesso.');
      } else {
        setSuccess('Áudio enviado com sucesso.');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha ao executar ação da reunião.');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="cais-paper space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <label className="space-y-2 text-sm font-medium text-[#0A4C78]">
          Substituir áudio
          <input
            type="file"
            accept="audio/*"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-full border border-[#0A4C78]/18 bg-white px-3 py-2 text-xs text-[#0A4C78]"
          />
          <p className="text-xs font-normal text-[#0A4C78]/62">Limite atual: {MAX_UPLOAD_FILE_SIZE_MB} MB</p>
        </label>

        <Button
          variant="ghost"
          size="sm"
          disabled={!file || loadingAction !== null}
          onClick={() =>
            void runAction('upload', async () => {
              if (!file) {
                throw new Error('AUDIO_REQUIRED');
              }
              return meetingsModule.uploadAudio(meeting.id, file);
            })
          }
        >
          {loadingAction === 'upload' ? <LoaderCircle className="animate-spin" size={14} /> : <UploadCloud size={14} />}
          Upload
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={loadingAction !== null || !isReadyForTranscription(meeting.status) || !meeting.audioPath}
          onClick={() =>
            void runAction('transcribe', async () => {
              return meetingsModule.transcribe(meeting.id);
            })
          }
        >
          {loadingAction === 'transcribe' ? <LoaderCircle className="animate-spin" size={14} /> : null}
          Transcrever
        </Button>

        <Button
          size="sm"
          disabled={loadingAction !== null || !isReadyForNotes(meeting)}
          onClick={() =>
            void runAction('generateNotes', async () => {
              return meetingsModule.generateNotes(meeting.id);
            })
          }
        >
          {loadingAction === 'generateNotes' ? (
            <LoaderCircle className="animate-spin" size={14} />
          ) : (
            <Sparkles size={14} />
          )}
          Gerar notas
        </Button>
      </div>

      {error ? <p className="cais-alert-error">{error}</p> : null}
      {success ? <p className="cais-alert-success">{success}</p> : null}
    </div>
  );
};
