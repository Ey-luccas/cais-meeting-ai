'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, WandSparkles } from 'lucide-react';

import { AudioRecorder } from '@/components/meetings/audio-recorder';
import { AudioUploadDropzone } from '@/components/meetings/audio-upload-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { isFileTooLarge, MAX_UPLOAD_FILE_SIZE_MB } from '@/lib/upload';
import { meetingsModule } from '@/modules/meetings';

export const NewMeetingForm = (): JSX.Element => {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSource, setAudioSource] = useState<'upload' | 'recording' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setSelectedAudio = (file: File, source: 'upload' | 'recording') => {
    if (isFileTooLarge(file)) {
      setAudioFile(null);
      setAudioSource(null);
      setError(`Arquivo excede o limite de ${MAX_UPLOAD_FILE_SIZE_MB} MB.`);
      return;
    }

    setAudioFile(file);
    setAudioSource(source);
    setError(null);
  };

  const actionLabel = useMemo(() => {
    if (!audioFile) {
      return 'Salvar reunião';
    }

    return 'Salvar e processar';
  }, [audioFile]);

  const audioHint = useMemo(() => {
    if (!audioFile || !audioSource) {
      return 'Nenhum áudio selecionado. Você pode salvar sem áudio e enviar depois.';
    }

    const sourceLabel = audioSource === 'recording' ? 'gravado no navegador' : 'enviado por upload';
    return `${audioFile.name} (${(audioFile.size / (1024 * 1024)).toFixed(2)} MB) - ${sourceLabel}`;
  }, [audioFile, audioSource]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      let meeting = await meetingsModule.create({
        title: title.trim(),
        description: description.trim() || undefined
      });

      if (audioFile) {
        setFeedback('Enviando áudio da reunião...');
        meeting = await meetingsModule.uploadAudio(meeting.id, audioFile);

        setFeedback('Iniciando transcrição com Groq...');
        meeting = await meetingsModule.transcribe(meeting.id);

        setFeedback('Gerando notas com DeepSeek...');
        meeting = await meetingsModule.generateNotes(meeting.id);
      }

      router.push(`/meetings/${meeting.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível salvar a reunião neste momento.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="cais-paper">
      <CardHeader>
        <CardTitle className="text-2xl">Nova reunião</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3 rounded-2xl border border-[#0A4C78]/12 bg-[#0A4C78]/[0.03] px-4 py-3 text-sm text-[#0A4C78]/78">
            <p className="font-semibold text-[#0A4C78]">Como usar</p>
            <p>1. Informe título e descrição da reunião.</p>
            <p>2. Grave no navegador ou envie áudio por upload.</p>
            <p>3. Clique em salvar para registrar e processar automaticamente.</p>
          </div>

          <label className="space-y-2 text-sm font-medium text-[#0A4C78]">
            Título
            <Input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Alinhamento semanal de operações"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-[#0A4C78]">
            Descrição (opcional)
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Contexto da reunião, pauta e resultado esperado"
              className="min-h-24"
            />
          </label>

          <div className="grid gap-4 xl:grid-cols-2">
            <AudioRecorder
              disabled={isSubmitting}
              onAudioReady={(file) => {
                setSelectedAudio(file, 'recording');
              }}
            />

            <AudioUploadDropzone
              disabled={isSubmitting}
              file={audioSource === 'upload' ? audioFile : null}
              onFileSelected={(file) => {
                setSelectedAudio(file, 'upload');
              }}
              onClearFile={() => {
                if (audioSource === 'upload') {
                  setAudioFile(null);
                  setAudioSource(null);
                }
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#0A4C78]/12 bg-[#0A4C78]/[0.03] px-4 py-3 text-sm text-[#0A4C78]/78">
            <span>{audioHint}</span>
            <span className="text-xs text-[#0A4C78]/62">Limite atual: {MAX_UPLOAD_FILE_SIZE_MB} MB</span>
            {audioFile ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAudioFile(null);
                  setAudioSource(null);
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Remover áudio
              </Button>
            ) : null}
          </div>

          {feedback ? (
            <p className="rounded-lg border border-[#F2B11B]/45 bg-[#F2B11B]/16 px-4 py-2 text-sm text-[#6A4A08]">
              {feedback}
            </p>
          ) : null}

          {error ? (
            <p className="cais-alert-error">{error}</p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : <WandSparkles size={16} />}
            {isSubmitting ? 'Salvando reunião...' : actionLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
