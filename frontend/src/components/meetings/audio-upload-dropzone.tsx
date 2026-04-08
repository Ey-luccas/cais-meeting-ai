'use client';

import { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { isFileTooLarge, MAX_UPLOAD_FILE_SIZE_MB } from '@/lib/upload';

type AudioUploadDropzoneProps = {
  disabled?: boolean;
  file: File | null;
  onFileSelected: (file: File) => void;
  onClearFile: () => void;
};

const acceptedFormatsLabel = 'MP3, WAV, M4A e WEBM';
const acceptedInput = '.mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/webm';

const hasAcceptedExtension = (name: string): boolean => {
  const normalized = name.toLowerCase();
  return normalized.endsWith('.mp3') || normalized.endsWith('.wav') || normalized.endsWith('.m4a') || normalized.endsWith('.webm');
};

const hasAcceptedMime = (mimeType: string): boolean => {
  const normalized = mimeType.toLowerCase();
  return (
    normalized.includes('audio/mpeg') ||
    normalized.includes('audio/mp3') ||
    normalized.includes('audio/wav') ||
    normalized.includes('audio/x-wav') ||
    normalized.includes('audio/mp4') ||
    normalized.includes('audio/x-m4a') ||
    normalized.includes('audio/webm')
  );
};

const isAcceptedAudio = (file: File): boolean => {
  return hasAcceptedExtension(file.name) || hasAcceptedMime(file.type);
};

export const AudioUploadDropzone = ({
  disabled = false,
  file,
  onFileSelected,
  onClearFile
}: AudioUploadDropzoneProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (candidate: File | null) => {
    if (!candidate) {
      return;
    }

    if (!isAcceptedAudio(candidate)) {
      setError(`Formato inválido. Use apenas ${acceptedFormatsLabel}.`);
      return;
    }

    if (isFileTooLarge(candidate)) {
      setError(`Arquivo excede o limite de ${MAX_UPLOAD_FILE_SIZE_MB} MB.`);
      return;
    }

    setError(null);
    onFileSelected(candidate);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#0A4C78]/14 bg-white p-4">
      <p className="text-sm font-semibold text-[#0A4C78]">Upload manual</p>

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) {
            return;
          }

          const droppedFile = event.dataTransfer.files?.[0] ?? null;
          handleFile(droppedFile);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition ${
          isDragging
            ? 'border-[#F2B11B] bg-[#F2B11B]/18 text-[#0A4C78]'
            : 'border-[#0A4C78]/24 bg-[#0A4C78]/[0.03] text-[#0A4C78]/84 hover:bg-[#0A4C78]/[0.06]'
        }`}
      >
        <UploadCloud size={20} />
        <span className="text-sm font-medium">Arraste e solte o áudio aqui</span>
        <span className="text-xs text-[#0A4C78]/62">
          ou clique para selecionar arquivo ({acceptedFormatsLabel}, até {MAX_UPLOAD_FILE_SIZE_MB} MB)
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={acceptedInput}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          handleFile(selected);
          event.currentTarget.value = '';
        }}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#0A4C78]/12 bg-[#0A4C78]/[0.03] px-3 py-2">
          <p className="text-xs text-[#0A4C78]/86">
            {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onClearFile} disabled={disabled}>
            <X size={14} />
            Remover
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
};
