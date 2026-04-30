'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MeetingObservation } from '@/types/domain';

const OBSERVATION_TYPES: Array<MeetingObservation['type']> = ['NOTE', 'TASK', 'QUESTION', 'IMPORTANT', 'DECISION'];

const typeLabel: Record<MeetingObservation['type'], string> = {
  NOTE: 'Nota',
  TASK: 'Tarefa',
  QUESTION: 'Pergunta',
  IMPORTANT: 'Importante',
  DECISION: 'Decisão'
};

const typeBadgeVariant: Record<MeetingObservation['type'], 'default' | 'info' | 'warning'> = {
  NOTE: 'info',
  TASK: 'default',
  QUESTION: 'info',
  IMPORTANT: 'warning',
  DECISION: 'default'
};

type MeetingObservationInput = {
  type: MeetingObservation['type'];
  timestampSeconds: number;
  content: string;
};

type MeetingObservationsPanelProps = {
  observations: MeetingObservation[];
  canWrite: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: MeetingObservationInput) => Promise<void>;
  getCurrentTimestampSeconds?: () => number;
};

const formatTimestamp = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const MeetingObservationsPanel = ({
  observations,
  canWrite,
  isSubmitting,
  onSubmit,
  getCurrentTimestampSeconds
}: MeetingObservationsPanelProps) => {
  const [type, setType] = useState<MeetingObservation['type']>('NOTE');
  const [timestampSeconds, setTimestampSeconds] = useState('0');
  const [content, setContent] = useState('');

  const sortedObservations = useMemo(
    () =>
      [...observations].sort((a, b) => {
        if (a.timestampSeconds !== b.timestampSeconds) {
          return a.timestampSeconds - b.timestampSeconds;
        }

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [observations]
  );

  const applyCurrentTimestamp = () => {
    if (!getCurrentTimestampSeconds) {
      return;
    }

    const current = Math.max(0, Math.floor(getCurrentTimestampSeconds()));
    setTimestampSeconds(String(current));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canWrite) {
      return;
    }

    await onSubmit({
      type,
      timestampSeconds: Number(timestampSeconds) || 0,
      content
    });

    setContent('');
    setTimestampSeconds('0');
    setType('NOTE');
  };

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="text-xl text-[#0A4C78]">Observações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite ? (
          <form className="grid gap-2 surface-soft p-3" onSubmit={handleSubmit}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={timestampSeconds}
                onChange={(event) => setTimestampSeconds(event.target.value)}
                type="number"
                min={0}
                placeholder="Tempo (segundos)"
              />
              <select
                className="h-10 rounded-full border border-[#0A4C78]/16 bg-white px-4 text-sm text-[#0A4C78]"
                value={type}
                onChange={(event) => setType(event.target.value as MeetingObservation['type'])}
              >
                {OBSERVATION_TYPES.map((entryType) => (
                  <option key={entryType} value={entryType}>
                    {typeLabel[entryType]}
                  </option>
                ))}
              </select>
            </div>
            <Textarea
              placeholder="Registrar observação manual"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
            />
            <div className="flex flex-wrap gap-2">
              {getCurrentTimestampSeconds ? (
                <Button type="button" variant="subtle" onClick={applyCurrentTimestamp} disabled={isSubmitting}>
                  Usar tempo do player
                </Button>
              ) : null}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Adicionar Observação'}
              </Button>
            </div>
          </form>
        ) : null}

        {sortedObservations.length ? (
          <div className="grid gap-2">
            {sortedObservations.map((observation) => (
              <div key={observation.id} className="surface-soft p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={typeBadgeVariant[observation.type]}>{typeLabel[observation.type]}</Badge>
                  <p className="text-xs text-[#567188]">
                    {formatTimestamp(observation.timestampSeconds)} · {observation.author.name}
                  </p>
                </div>
                <p className="mt-1 text-sm text-[#35536B]">{observation.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#567188]">Nenhuma observação registrada.</p>
        )}
      </CardContent>
    </Card>
  );
};
