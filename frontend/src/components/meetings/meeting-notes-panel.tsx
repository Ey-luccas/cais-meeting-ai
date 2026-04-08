import { CheckCircle2, ClipboardList, ListChecks, MessageSquareText, Target, TimerReset } from 'lucide-react';

import { CopyButton } from '@/components/meetings/copy-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { asActionItems, asStringArray } from '@/lib/meeting-helpers';
import type { MeetingNote } from '@/types/meeting';

type MeetingNotesPanelProps = {
  note: MeetingNote | null;
};

const Empty = ({ label }: { label: string }): JSX.Element => (
  <p className="rounded-lg border border-dashed border-[#0A4C78]/22 bg-white px-3 py-2 text-sm text-[#0A4C78]/65">
    {label}
  </p>
);

const asListForClipboard = (items: string[]): string => {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
};

type NotesListCardProps = {
  title: string;
  items: string[];
  emptyLabel: string;
  copyLabel: string;
  icon: JSX.Element;
};

const NotesListCard = ({
  title,
  items,
  emptyLabel,
  copyLabel,
  icon
}: NotesListCardProps): JSX.Element => (
  <Card className="cais-paper">
    <CardHeader className="pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="inline-flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CopyButton content={asListForClipboard(items)} label={copyLabel} copiedLabel="Copiado" />
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      {items.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[#0A4C78]/84">
          {items.map((item, index) => (
            <li key={`${title}-${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <Empty label={emptyLabel} />
      )}
    </CardContent>
  </Card>
);

export const MeetingNotesPanel = ({ note }: MeetingNotesPanelProps): JSX.Element => {
  const topics = asStringArray(note?.topicsJson);
  const decisions = asStringArray(note?.decisionsJson);
  const pendings = asStringArray(note?.pendingItemsJson);
  const comments = asStringArray(note?.commentsJson);
  const actions = asActionItems(note?.actionItemsJson);
  const actionItemsClipboard = actions
    .map((action, index) => {
      const owner = action.owner ?? 'N/D';
      const deadline = action.deadline ?? 'N/D';
      const status = action.status ?? 'N/D';
      return `${index + 1}. ${action.item} | Responsável: ${owner} | Prazo: ${deadline} | Status: ${status}`;
    })
    .join('\n');

  return (
    <div className="space-y-4">
      <Card className="cais-paper">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="inline-flex items-center gap-2 text-xl">
              <ClipboardList size={18} />
              Resumo Geral
            </CardTitle>
            <CopyButton content={note?.summary ?? ''} label="Copiar resumo" copiedLabel="Resumo copiado" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {note?.summary ? (
            <p className="text-sm leading-relaxed text-[#0A4C78]/86">{note.summary}</p>
          ) : (
            <Empty label="O resumo será gerado após o processamento com DeepSeek." />
          )}
        </CardContent>
      </Card>

      <NotesListCard
        title="Tópicos Principais"
        items={topics}
        emptyLabel="Sem tópicos mapeados."
        copyLabel="Copiar tópicos"
        icon={<CheckCircle2 size={16} />}
      />

      <NotesListCard
        title="Decisões Tomadas"
        items={decisions}
        emptyLabel="Sem decisões registradas."
        copyLabel="Copiar decisões"
        icon={<Target size={16} />}
      />

      <Card className="cais-paper">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <ListChecks size={16} />
              Tarefas
            </CardTitle>
            <CopyButton content={actionItemsClipboard} label="Copiar tarefas" copiedLabel="Tarefas copiadas" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {actions.length > 0 ? (
            <div className="space-y-2">
              {actions.map((action, index) => (
                <div key={`${action.item}-${index}`} className="rounded-lg border border-[#0A4C78]/10 bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-[#0A4C78]">{action.item}</p>
                  <p className="text-xs text-[#0A4C78]/72">
                    Responsável: {action.owner ?? 'N/D'} | Prazo: {action.deadline ?? 'N/D'} | Status:{' '}
                    {action.status ?? 'N/D'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty label="Sem tarefas definidas." />
          )}
        </CardContent>
      </Card>

      <NotesListCard
        title="Pendências"
        items={pendings}
        emptyLabel="Sem pendências abertas."
        copyLabel="Copiar pendências"
        icon={<TimerReset size={16} />}
      />

      <NotesListCard
        title="Comentários Automáticos"
        items={comments}
        emptyLabel="Sem comentários adicionais."
        copyLabel="Copiar comentários"
        icon={<MessageSquareText size={16} />}
      />
    </div>
  );
};
