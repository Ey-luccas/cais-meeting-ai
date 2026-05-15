import { ChevronLeft, ChevronRight, Clock3, Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AiSearchThreadSummary } from '@/types/domain';

type AiSearchHistorySidebarProps = {
  threads: AiSearchThreadSummary[];
  selectedThreadId: string | null;
  isLoading: boolean;
  isCollapsed: boolean;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onOpenSearchModal: () => void;
  onToggleCollapse: () => void;
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
  isCollapsed,
  onSelectThread,
  onCreateThread,
  onOpenSearchModal,
  onToggleCollapse
}: AiSearchHistorySidebarProps) => {
  return (
    <aside
      className={`flex h-[320px] min-h-0 w-full flex-col border-b border-[#e5eaf4] bg-white transition-[width] duration-300 ease-out md:h-full md:overflow-hidden md:border-b-0 md:border-r ${
        isCollapsed ? 'md:w-[96px]' : 'md:w-[300px]'
      }`}
    >
      <div className="p-4">
        {isCollapsed ? (
          <div className="space-y-2">
            <Button
              type="button"
              className="h-10 w-full justify-center rounded-lg bg-[#005eb8] px-0 text-white hover:bg-[#004b93]"
              onClick={onCreateThread}
              title="Nova pesquisa"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Nova pesquisa</span>
            </Button>
            <Button
              type="button"
              variant="subtle"
              className="h-10 w-full justify-center px-0"
              onClick={onOpenSearchModal}
              title="Buscar"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">Buscar</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full justify-center text-[#667085]"
              onClick={onToggleCollapse}
              aria-label="Expandir histórico"
              title="Expandir histórico"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Expandir histórico</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-10 flex-1 justify-start gap-2 rounded-lg bg-[#005eb8] text-white hover:bg-[#004b93]"
              onClick={onCreateThread}
            >
              <Plus className="h-4 w-4" />
              Nova pesquisa
            </Button>
            <Button
              type="button"
              variant="subtle"
              className="h-10 gap-2 px-3"
              onClick={onOpenSearchModal}
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
        )}
      </div>

      {!isCollapsed ? (
        <>
          <div className="flex items-center justify-between gap-2 px-4 pb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#667085]">
            <div className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5" />
              Histórico
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-8 w-8 shrink-0 text-[#667085]"
              aria-label="Minimizar histórico"
              title="Minimizar histórico"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

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
                  <p className="mt-1.5 line-clamp-2 text-[11px] text-[#667085]">
                    {thread.lastMessagePreview?.trim() || 'Sem resposta registrada ainda.'}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </aside>
  );
};
