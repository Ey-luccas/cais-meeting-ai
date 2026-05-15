import Link from 'next/link';
import type { Route } from 'next';
import type { ComponentType } from 'react';
import {
  BookOpenText,
  CalendarDays,
  CheckSquare2,
  File,
  FolderOpen,
  Gavel,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  SquareKanban
} from 'lucide-react';

import type { AiSearchMessageSource, AiSearchSourceType } from '@/types/domain';

const SOURCE_LABEL: Record<AiSearchSourceType, string> = {
  PROJECT: 'Projeto',
  MEETING: 'Reunião',
  TRANSCRIPT: 'Transcrição',
  MEETING_NOTE: 'Nota de reunião',
  DECISION: 'Decisão',
  TASK: 'Tarefa',
  CARD: 'Card',
  CARD_COMMENT: 'Comentário',
  FILE: 'Arquivo',
  LIBRARY_ITEM: 'Biblioteca'
};

const SOURCE_ICON: Record<AiSearchSourceType, ComponentType<{ className?: string }>> = {
  PROJECT: FolderOpen,
  MEETING: CalendarDays,
  TRANSCRIPT: MessageSquare,
  MEETING_NOTE: NotebookPen,
  DECISION: Gavel,
  TASK: CheckSquare2,
  CARD: SquareKanban,
  CARD_COMMENT: MessageCircle,
  FILE: File,
  LIBRARY_ITEM: BookOpenText
};

const extractProjectId = (href: string): string | null => {
  const match = href.match(/\/projects\/([^/?#]+)/i);
  return match?.[1] ?? null;
};

const formatDate = (value: string): string => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const buildSourceHref = (source: AiSearchMessageSource): string => {
  try {
    const url = new URL(source.href, 'http://localhost');
    const explicitHighlight = source.highlightTargetId?.trim() || url.searchParams.get('highlight')?.trim() || null;

    if (source.sourceType === 'FILE' && /\/projects\/[^/]+\/files$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/files$/i, '/library');
      url.searchParams.set('item', source.sourceId);
    }

    if (source.sourceType === 'LIBRARY_ITEM' && /\/projects\/[^/]+\/library$/i.test(url.pathname)) {
      url.searchParams.set('item', source.sourceId);
      url.searchParams.set('highlight', source.sourceId);
    }

    if (source.sourceType === 'LIBRARY_ITEM' && /\/projects\/[^/]+\/library\/documents\/[^/]+$/i.test(url.pathname)) {
      url.searchParams.set('highlight', source.sourceId);
    }

    if (source.sourceType === 'CARD') {
      url.searchParams.set('card', url.searchParams.get('card') ?? source.sourceId);
      url.searchParams.set('highlight', url.searchParams.get('card') ?? source.sourceId);
    }

    if (source.sourceType === 'CARD_COMMENT') {
      const cardId = url.searchParams.get('card');

      if (cardId) {
        url.searchParams.set('highlight', cardId);
      }
    }

    if (source.sourceType === 'MEETING') {
      url.searchParams.set('highlight', explicitHighlight ?? 'meeting-overview');
    }

    if (source.sourceType === 'TRANSCRIPT') {
      url.searchParams.set('highlight', explicitHighlight ?? 'meeting-transcription');
    }

    if (source.sourceType === 'MEETING_NOTE' || source.sourceType === 'DECISION') {
      url.searchParams.set('highlight', explicitHighlight ?? 'meeting-decisions');
    }

    if (source.sourceType === 'TASK') {
      url.searchParams.set('highlight', explicitHighlight ?? 'meeting-tasks');
    }

    if (source.sourceType !== 'MEETING' && source.sourceType !== 'TRANSCRIPT' && source.sourceType !== 'MEETING_NOTE' && source.sourceType !== 'DECISION' && source.sourceType !== 'TASK' && explicitHighlight) {
      url.searchParams.set('highlight', explicitHighlight);
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return source.href;
  }
};

const sourceLabel = (source: AiSearchMessageSource): string => {
  if (source.sourceType !== 'LIBRARY_ITEM') {
    return SOURCE_LABEL[source.sourceType];
  }

  if (/\/library\/documents\//i.test(source.href)) {
    return 'Documento';
  }

  return SOURCE_LABEL[source.sourceType];
};

type AiSearchSourcesProps = {
  sources: AiSearchMessageSource[];
  showProjectOrigin?: boolean;
  projectNamesById?: Record<string, string>;
};

export const AiSearchSources = ({
  sources,
  showProjectOrigin = false,
  projectNamesById = {}
}: AiSearchSourcesProps) => {
  if (sources.length === 0) {
    return <p className="text-xs text-[#667085]">Sem fontes encontradas.</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-[#334155]">Fontes encontradas</p>

      <div className="space-y-2">
        {sources.map((source) => {
          const Icon = SOURCE_ICON[source.sourceType];
          const projectId = source.projectId ?? extractProjectId(source.href);
          const projectName = source.projectName ?? (projectId ? projectNamesById[projectId] ?? projectId : null);
          const href = buildSourceHref(source);
          const label = sourceLabel(source);

          return (
            <article
              key={source.id}
              className="rounded-xl border border-[#dbe3f0] bg-[#f8fbff] px-3 py-3 text-xs text-[#334155]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1 rounded-full border border-[#d6e3f8] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1f4b85]">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </p>
                  <p className="mt-2 line-clamp-2 font-semibold text-[#0f172a]">{source.title || 'Fonte sem título'}</p>
                  {showProjectOrigin ? (
                    <p className="mt-1 text-[11px] text-[#667085]">Projeto: {projectName ?? 'Projeto'}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] text-[#667085]">{formatDate(source.createdAt)}</span>
              </div>

              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#5b6b84]">Trecho de evidência</p>
              <p className="mt-1 line-clamp-3 text-[12px] text-[#334155]">
                {source.excerpt?.trim() || 'Sem trecho disponível para esta fonte.'}
              </p>

              <div className="mt-2">
                <Link
                  href={href as Route}
                  className="inline-flex h-8 items-center rounded-lg border border-[#d6e6f8] bg-white px-3 text-[11px] font-semibold text-[#005eb8] transition-colors hover:bg-[#f3f8ff]"
                >
                  Abrir origem
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
