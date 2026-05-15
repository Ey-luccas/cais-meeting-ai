'use client';

import Link from 'next/link';
import { AlertCircle, Sparkles } from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';

export default function ProjectAiSearchPage() {
  useConfigureAppShell({
    title: 'Pesquisa IA do projeto'
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesquisa IA"
        description="Esta área está em desenvolvimento. Por enquanto, a Pesquisa IA funciona apenas fora do projeto."
      />

      <section className="rounded-2xl border border-[#dbe3f0] bg-white p-6 shadow-[0_8px_20px_rgba(10,40,78,0.04)]">
        <div className="mb-4 inline-flex rounded-full border border-[#b9ddff] bg-[#eaf3ff] px-3 py-1 text-[11px] font-semibold text-[#005eb8]">
          Em desenvolvimento · atualização prevista para 22 de maio
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf3ff] text-[#005eb8]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold text-[#111827]">Pesquisa IA do projeto em desenvolvimento</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">
              Por enquanto, a pesquisa com escopo de projeto ainda não está disponível aqui. A Pesquisa IA Central continua
              funcionando normalmente.
            </p>
          </div>

          <div className="flex shrink-0 items-start">
            <Link
              href="/ai-search"
              className="inline-flex items-center gap-2 rounded-lg border border-[#d5deec] bg-white px-4 py-2 text-sm font-semibold text-[#005eb8] transition-colors hover:bg-[#eef4ff]"
            >
              <AlertCircle className="h-4 w-4" />
              Ir para Pesquisa IA Central
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
