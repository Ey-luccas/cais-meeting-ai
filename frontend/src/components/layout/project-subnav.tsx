'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

type ProjectSubnavProps = {
  projectId: string;
  projectName?: string;
  projectColor?: string | null;
};

const tabs = [
  { label: 'Visão geral', href: '' },
  { label: 'Reuniões', href: '/meetings' },
  { label: 'Quadro', href: '/board' },
  { label: 'Biblioteca', href: '/library' },
  { label: 'Relatórios', href: '/reports' },
  { label: 'Pesquisa IA', href: '/ai-search' }
];

export const ProjectSubnav = ({ projectId, projectName = 'Projeto', projectColor }: ProjectSubnavProps) => {
  const pathname = usePathname();
  const baseHref = `/projects/${projectId}`;

  return (
    <div className="border-b border-app bg-white">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-2 px-6 py-4 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: projectColor ?? '#005EB8' }}
          />
          <p className="truncate text-sm font-semibold text-[#111827]">{projectName}</p>
          <span className="rounded-[999px] border border-[#d7e3f7] bg-[#eef5ff] px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            Projeto ativo
          </span>
        </div>

        <nav className="scrollbar-none flex min-w-0 gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const href = `${baseHref}${tab.href}` as Route;
            const isActive = tab.href === ''
              ? pathname === baseHref
              : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  'whitespace-nowrap rounded-[9px] px-3 py-2 text-xs font-semibold text-app-muted transition-colors hover:bg-app-active hover:text-brand',
                  isActive && 'bg-app-active text-brand'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
