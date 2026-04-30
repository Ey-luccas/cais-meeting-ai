import type { BoardCard, BoardColumn } from '@/types/domain';
import { KanbanColumn } from '@/components/board/kanban-column';

type KanbanBoardProps = {
  columns: BoardColumn[];
  selectedCardId?: string | null;
  onCardSelect?: (card: BoardCard) => void;
};

export const KanbanBoard = ({ columns, selectedCardId, onCardSelect }: KanbanBoardProps) => (
  <div className="scrollbar-none min-w-0 overflow-x-auto pb-3">
    <div className="flex min-h-[520px] w-max gap-5">
      {columns.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          selectedCardId={selectedCardId}
          onCardSelect={onCardSelect}
        />
      ))}
    </div>
  </div>
);
