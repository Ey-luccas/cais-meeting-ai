import { CalendarDays, MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BoardCard } from '@/types/domain';

type KanbanCardProps = {
  card: BoardCard;
  isSelected?: boolean;
  onClick?: () => void;
};

const priorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

export const KanbanCard = ({ card, isSelected, onClick }: KanbanCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full rounded-lg border bg-white p-4 text-left transition-colors hover:border-app-softBorder',
      isSelected ? 'border-brand' : 'border-app'
    )}
  >
    <div className="mb-2 flex flex-wrap gap-1.5">
      {card.sourceType === 'AI' ? (
        <span className="rounded bg-app-active px-2 py-0.5 text-[10px] font-bold text-brand">IA</span>
      ) : null}
      {card.priority ? (
        <span className="rounded bg-app px-2 py-0.5 text-[10px] font-bold text-app-muted">{priorityLabel[card.priority]}</span>
      ) : null}
    </div>
    <h4 className="text-sm font-bold text-[#111827]">{card.title}</h4>
    {card.description ? <p className="mt-1 line-clamp-2 text-xs text-app-muted">{card.description}</p> : null}
    <div className="mt-3 flex items-center gap-3 text-xs text-app-muted">
      <span className="inline-flex items-center gap-1">
        <CalendarDays className="h-3.5 w-3.5" />
        {card.dueDate ? new Date(card.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageSquare className="h-3.5 w-3.5" />
        {card.comments.length}
      </span>
    </div>
  </button>
);
