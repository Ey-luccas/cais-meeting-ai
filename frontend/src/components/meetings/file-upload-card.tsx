import { UploadCloud } from 'lucide-react';

import { cn } from '@/lib/utils';

type FileUploadCardProps = {
  inputRef: React.RefObject<HTMLInputElement>;
  fileName?: string | null;
  isDragOver?: boolean;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
  onFileChange: (file: File | null) => void;
};

export const FileUploadCard = ({
  inputRef,
  fileName,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange
}: FileUploadCardProps) => (
  <article
    className={cn(
      'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-6 text-center transition-colors',
      isDragOver ? 'border-brand bg-app-active' : 'border-app hover:border-app-softBorder hover:bg-app'
    )}
    onClick={() => inputRef.current?.click()}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-app text-app-muted">
      <UploadCloud className="h-7 w-7" />
    </div>
    <h3 className="text-sm font-bold text-[#111827]">Enviar arquivo de áudio</h3>
    <p className="mt-2 text-xs text-app-muted">MP3, WAV, M4A. Tamanho máximo: 500MB.</p>
    <button type="button" className="mt-5 rounded-lg border border-app px-4 py-2 text-sm font-bold text-[#111827]">
      Selecionar arquivo
    </button>
    <input
      ref={inputRef}
      type="file"
      accept="audio/*"
      className="hidden"
      onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
    />
    {fileName ? <p className="mt-4 text-xs font-bold text-brand">{fileName}</p> : null}
  </article>
);
