import { Mic, Pause, Play, Square } from 'lucide-react';

type AudioRecorderCardProps = {
  elapsedLabel: string;
  state: 'idle' | 'recording' | 'paused';
  recordingUrl?: string | null;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
};

export const AudioRecorderCard = ({
  elapsedLabel,
  state,
  recordingUrl,
  onStart,
  onPause,
  onStop
}: AudioRecorderCardProps) => (
  <article className="surface-card flex flex-col items-center justify-center space-y-5 p-6 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
      <Mic className="h-7 w-7" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-[#111827]">Gravar áudio direto</h3>
      <p className="mt-1 text-xs text-app-muted">Capture o áudio da reunião no navegador.</p>
    </div>
    <div className="w-full rounded-lg bg-app px-4 py-3 font-mono text-3xl font-bold text-[#111827]">
      {elapsedLabel}
    </div>
    <div className="flex gap-3">
      <button type="button" onClick={onStart} className="flex h-11 w-11 items-center justify-center rounded-full bg-red-700 text-white">
        <Play className="h-4 w-4" />
      </button>
      <button type="button" onClick={onPause} disabled={state !== 'recording'} className="flex h-11 w-11 items-center justify-center rounded-full bg-app text-[#111827] disabled:opacity-50">
        <Pause className="h-4 w-4" />
      </button>
      <button type="button" onClick={onStop} disabled={state === 'idle'} className="flex h-11 w-11 items-center justify-center rounded-full bg-app text-[#111827] disabled:opacity-50">
        <Square className="h-4 w-4" />
      </button>
    </div>
    {recordingUrl ? <audio controls src={recordingUrl} className="w-full" /> : null}
  </article>
);
