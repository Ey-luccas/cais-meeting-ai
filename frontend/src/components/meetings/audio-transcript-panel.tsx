import { Volume2 } from 'lucide-react';

import { CopyButton } from '@/components/meetings/copy-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AudioTranscriptPanelProps = {
  audioUrl: string | null;
  transcriptText: string | null;
};

export const AudioTranscriptPanel = ({
  audioUrl,
  transcriptText
}: AudioTranscriptPanelProps): JSX.Element => {
  return (
    <Card className="cais-paper h-full">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="inline-flex items-center gap-2 text-xl">
            <Volume2 size={18} />
            Áudio e Transcrição
          </CardTitle>
          <CopyButton
            content={transcriptText ?? ''}
            label="Copiar transcrição"
            copiedLabel="Transcrição copiada"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="rounded-2xl border border-[#0A4C78]/12 bg-white px-4 py-4">
          <p className="mb-2 text-xs tracking-[0.14em] text-[#0A4C78]/65 uppercase">Player de áudio</p>
          {audioUrl ? (
            <audio controls src={audioUrl} className="w-full rounded-lg" preload="metadata" />
          ) : (
            <p className="rounded-xl border border-dashed border-[#0A4C78]/25 bg-white px-4 py-3 text-sm text-[#0A4C78]/70">
              Esta reunião ainda não possui áudio enviado.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[#0A4C78]/12 bg-white px-4 py-4">
          <p className="mb-2 text-xs tracking-[0.14em] text-[#0A4C78]/65 uppercase">Transcrição completa</p>
          {transcriptText ? (
            <p className="max-h-[72vh] overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-relaxed text-[#0A4C78]/86">
              {transcriptText}
            </p>
          ) : (
            <p className="text-sm text-[#0A4C78]/65">
              A transcrição completa aparecerá aqui após o processamento com Groq.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
