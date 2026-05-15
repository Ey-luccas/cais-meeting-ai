'use client';

import { Archive, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { cn } from '@/lib/utils';
import type { AiSearchThreadSummary } from '@/types/domain';

export type AiSearchHistoryFilter = 'ALL' | 'ORGANIZATION' | 'PROJECTS';

type AiSearchHistoryModalProps = {
  open: boolean;
  threads: AiSearchThreadSummary[];
  selectedThreadId: string | null;
  isLoading: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => Promise<string | null> | string | null | void;
  onRequestRename: (thread: AiSearchThreadSummary) => void;
  onRequestArchive: (thread: AiSearchThreadSummary) => void;
  onRequestDelete: (thread: AiSearchThreadSummary) => void;
};

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const filterThreads = (threads: AiSearchThreadSummary[], filter: AiSearchHistoryFilter): AiSearchThreadSummary[] => {
  if (filter === 'ORGANIZATION') {
    return threads.filter((thread) => thread.scope === 'ORGANIZATION');
  }

  if (filter === 'PROJECTS') {
    return threads.filter((thread) => thread.scope === 'PROJECT');
  }

  return threads;
};

export const AiSearchHistoryModal = ({
  open,
  threads,
  selectedThreadId,
  isLoading,
  isBusy = false,
  onClose,
  onSelectThread,
  onCreateThread,
  onRequestRename,
  onRequestArchive,
  onRequestDelete
}: AiSearchHistoryModalProps) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AiSearchHistoryFilter>('ALL');

  const filterOptions: Array<{ id: AiSearchHistoryFilter; label: string }> = [
    { id: 'ALL', label: 'Todos' },
    { id: 'ORGANIZATION', label: 'Organização' },
    { id: 'PROJECTS', label: 'Projetos' }
  ];

  const visibleThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return filterThreads(threads, filter).filter((thread) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        thread.title,
        thread.project?.name ?? '',
        thread.lastMessagePreview ?? '',
        thread.scope === 'PROJECT' ? 'projeto' : 'organização'
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [filter, query, threads]);

  const handleCreateThread = async () => {
    const created = await onCreateThread();

    if (created !== null && created !== undefined) {
      onClose();
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Pesquisar e escolher chat"
      description="Busque pelo nome da pesquisa, filtre por escopo e abra ou renomeie uma conversa."
      className="max-w-4xl"
    >
      <div className="space-y-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar pelo nome da pesquisa, projeto ou última resposta"
        />

        <div className="grid grid-cols-3 rounded-lg border border-[#d8deeb] bg-white p-1">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={cn(
                'rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
                filter === option.id ? 'bg-[#eaf3ff] text-[#005eb8]' : 'text-[#667085] hover:text-[#1f2937]'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[#667085]">
            {isLoading ? 'Carregando histórico...' : `${visibleThreads.length} chat(s) encontrado(s)`}
          </p>
          {query || filter !== 'ALL' ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFilter('ALL');
              }}
              className="text-xs font-semibold text-[#005eb8] hover:underline"
            >
              Limpar
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          {isLoading ? <p className="py-3 text-sm text-[#667085]">Carregando histórico...</p> : null}

          {!isLoading && visibleThreads.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d8deeb] bg-[#fbfdff] px-4 py-5 text-sm text-[#667085]">
              Nenhum chat encontrado para este filtro.
            </p>
          ) : null}

          {visibleThreads.map((thread) => {
            const isActive = selectedThreadId === thread.id;

            return (
              <article
                key={thread.id}
                className={cn(
                  'rounded-xl border px-4 py-3 transition-colors',
                  isActive ? 'border-[#b8d5f7] bg-[#eef6ff]' : 'border-[#dbe3f0] bg-white'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{thread.title}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
                      <span className="inline-flex items-center rounded-full border border-[#d6e3f8] bg-white px-2 py-0.5 font-semibold text-[#1f4b85]">
                        {thread.scope === 'PROJECT' ? 'Projeto' : 'Organização'}
                      </span>
                      <span className="truncate">{thread.project?.name ?? 'Organização'}</span>
                      <span>{formatDate(thread.updatedAt)}</span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-[#475569]">
                      {thread.lastMessagePreview?.trim() || 'Sem resposta registrada ainda.'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="subtle"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => {
                          onSelectThread(thread.id);
                          onClose();
                        }}
                        className="gap-1"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Abrir
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => onRequestRename(thread)}
                        className="gap-1"
                      >
                        Renomear
                      </Button>
                      <Button
                        type="button"
                        variant="subtle"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => onRequestArchive(thread)}
                        className="gap-1"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Arquivar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => onRequestDelete(thread)}
                        className="gap-1 text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#8f0808]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Apagar
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5eaf4] pt-4">
          <Button type="button" variant="subtle" onClick={() => void handleCreateThread()} disabled={isBusy} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova pesquisa
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
            Fechar
          </Button>
        </div>
      </div>
    </AppModal>
  );
};
