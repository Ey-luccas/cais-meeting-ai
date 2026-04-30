import { Clock3, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AiSearchThreadSummary } from '@/types/domain';

export type AiSearchHistoryFilter = 'ALL' | 'ORGANIZATION' | 'PROJECTS';

type AiSearchHistorySidebarProps = {
  threads: AiSearchThreadSummary[];
  selectedThreadId: string | null;
  isLoading: boolean;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  showFilters?: boolean;
  filter?: AiSearchHistoryFilter;
  onFilterChange?: (filter: AiSearchHistoryFilter) => void;
};

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  });
};

export const AiSearchHistorySidebar = ({
  threads,
  selectedThreadId,
  isLoading,
  onSelectThread,
  onCreateThread,
  showFilters = false,
  filter = 'ALL',
  onFilterChange
}: AiSearchHistorySidebarProps) => {
  const filterOptions: Array<{ id: AiSearchHistoryFilter; label: string }> = [
    { id: 'ALL', label: 'Todos' },
    { id: 'ORGANIZATION', label: 'Organização' },
    { id: 'PROJECTS', label: 'Projetos' }
  ];

  return (
    <aside className="flex h-[320px] min-h-0 w-full flex-col border-b border-[#e5eaf4] bg-white md:h-full md:w-[300px] md:border-b-0 md:border-r">
      <div className="p-4">
        <Button
          type="button"
          className="h-10 w-full justify-start gap-2 rounded-lg bg-[#005eb8] text-white hover:bg-[#004b93]"
          onClick={onCreateThread}
        >
          <Plus className="h-4 w-4" />
          Nova pesquisa
        </Button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">
        <Clock3 className="h-3.5 w-3.5" />
        Histórico
      </div>

      {showFilters ? (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 rounded-lg border border-[#d8deeb] bg-white p-1">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onFilterChange?.(option.id)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[11px] font-semibold text-[#667085] transition-colors',
                  filter === option.id ? 'bg-[#eaf3ff] text-[#005eb8]' : 'hover:text-[#1f2937]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {isLoading ? <p className="px-2 py-3 text-xs text-[#667085]">Carregando histórico...</p> : null}

        {!isLoading && threads.length === 0 ? <p className="px-2 py-3 text-xs text-[#667085]">Sem pesquisas recentes.</p> : null}

        {threads.map((thread) => {
          const isActive = selectedThreadId === thread.id;

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-[#b8d5f7] bg-[#eef6ff]'
                  : 'border-transparent bg-transparent hover:border-[#d8deeb] hover:bg-[#f8fafd]'
              )}
            >
              <p className="truncate text-sm font-semibold text-[#111827]">{thread.title}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-[#667085]">
                  {thread.scope === 'PROJECT' ? thread.project?.name ?? 'Projeto' : 'Organização'}
                </span>
                <span className="shrink-0 text-[11px] text-[#667085]">{formatDate(thread.updatedAt)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
