import { MoreHorizontal } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import type { BoardCard, BoardColumn as BoardColumnType } from '@/types/domain';
import { KanbanCard } from '@/components/board/kanban-card';

type KanbanColumnProps = {
  column: BoardColumnType;
  selectedCardId?: string | null;
  onCardSelect?: (card: BoardCard) => void;
};

export const KanbanColumn = ({ column, selectedCardId, onCardSelect }: KanbanColumnProps) => (
  <section className="flex h-full w-[280px] shrink-0 flex-col">
    <header className="mb-3 flex items-center justify-between gap-2">
      <h3 className="truncate text-xs font-bold uppercase tracking-[0.08em] text-[#111827]">
        {column.title}
        <span className="ml-2 font-semibold text-app-muted">{column.cards.length}</span>
      </h3>
      <button type="button" className="rounded-md p-1 text-app-muted hover:bg-app-active" aria-label="Opções da coluna">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </header>

    <div className="scrollbar-none min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      {column.cards.length ? (
        column.cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            isSelected={selectedCardId === card.id}
            onClick={() => onCardSelect?.(card)}
          />
        ))
      ) : (
        <EmptyState title="Nenhum card nesta coluna." description="Adicione um card manualmente ou gere tarefas a partir de uma reunião." />
      )}
    </div>
  </section>
);
