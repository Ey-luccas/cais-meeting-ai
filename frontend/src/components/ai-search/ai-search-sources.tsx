import Link from 'next/link';
import type { Route } from 'next';

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

const extractProjectId = (href: string): string | null => {
  const match = href.match(/\/projects\/([^/?#]+)/i);
  return match?.[1] ?? null;
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
    return <p className="text-xs text-[#667085]">Nenhum resultado encontrado</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-[#334155]">Fontes utilizadas</p>

      <div className="space-y-2">
        {sources.map((source) => {
          const projectId = extractProjectId(source.href);
          const projectName = projectId ? projectNamesById[projectId] ?? projectId : null;

          return (
            <article
              key={source.id}
              className="rounded-lg border border-[#dbe3f0] bg-[#f8fbff] px-3 py-2 text-xs text-[#334155]"
            >
              {showProjectOrigin ? (
                <p className="mb-0.5 text-[11px] text-[#667085]">Projeto: {projectName ?? 'Projeto'}</p>
              ) : null}

              <p className="font-semibold text-[#0f172a]">
                Fonte: {SOURCE_LABEL[source.sourceType]}
                {source.title ? ` - ${source.title}` : ''}
              </p>

              {source.excerpt ? <p className="mt-1 line-clamp-3">{source.excerpt}</p> : null}

              <Link
                href={source.href as Route}
                className="mt-1 inline-flex text-[11px] font-semibold text-[#005eb8] underline-offset-2 hover:underline"
              >
                Abrir origem
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
};
