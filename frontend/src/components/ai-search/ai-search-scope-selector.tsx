import { Building2, Folder } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AiSearchScope } from '@/types/domain';

type AiSearchScopeSelectorProps = {
  scope: AiSearchScope;
  allowOrganizationScope: boolean;
  allowProjectScope: boolean;
  onChange: (scope: AiSearchScope) => void;
};

const optionClass =
  'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00478d]/20';

export const AiSearchScopeSelector = ({
  scope,
  allowOrganizationScope,
  allowProjectScope,
  onChange
}: AiSearchScopeSelectorProps) => {
  return (
    <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Escopo da pesquisa">
      {allowOrganizationScope ? (
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'ORGANIZATION'}
          onClick={() => onChange('ORGANIZATION')}
          className={cn(
            optionClass,
            scope === 'ORGANIZATION'
              ? 'border-[#005eb8] bg-[#eaf3ff] text-[#003a75]'
              : 'border-[#d8deeb] bg-white text-[#1f2937] hover:border-[#c7d3e7]'
          )}
        >
          <span
            className={cn(
              'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              scope === 'ORGANIZATION' ? 'bg-[#d4e7ff] text-[#005eb8]' : 'bg-[#f0f3f9] text-[#667085]'
            )}
          >
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Toda a organização</span>
            <span className="mt-0.5 block text-xs text-[#667085]">
              Pesquise em projetos, reuniões, cards, arquivos e decisões da organização.
            </span>
            <span className="mt-1 block text-xs font-semibold text-[#005eb8]">Pesquisar em toda a organização</span>
          </span>
        </button>
      ) : null}

      {allowProjectScope ? (
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'PROJECT'}
          onClick={() => onChange('PROJECT')}
          className={cn(
            optionClass,
            scope === 'PROJECT'
              ? 'border-[#005eb8] bg-[#eaf3ff] text-[#003a75]'
              : 'border-[#d8deeb] bg-white text-[#1f2937] hover:border-[#c7d3e7]'
          )}
        >
          <span
            className={cn(
              'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              scope === 'PROJECT' ? 'bg-[#d4e7ff] text-[#005eb8]' : 'bg-[#f0f3f9] text-[#667085]'
            )}
          >
            <Folder className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Projeto específico</span>
            <span className="mt-0.5 block text-xs text-[#667085]">Limite a pesquisa aos dados de um projeto.</span>
            <span className="mt-1 block text-xs font-semibold text-[#005eb8]">Pesquisar neste projeto</span>
          </span>
        </button>
      ) : null}
    </div>
  );
};
