'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ProjectWorkspaceNavProps = {
  projectId: string;
  projectName: string;
  projectColor?: string | null;
  currentLabel?: string;
  actions?: ReactNode;
};

const navItems = [
  {
    label: 'Visão geral',
    href: (projectId: string) => `/projects/${projectId}`,
    isActive: (pathname: string, projectId: string) => pathname === `/projects/${projectId}`
  },
  {
    label: 'Reuniões',
    href: (projectId: string) => `/projects/${projectId}/meetings`,
    isActive: (pathname: string, projectId: string) =>
      pathname === `/projects/${projectId}/meetings` || pathname.startsWith(`/projects/${projectId}/meetings/`)
  },
  {
    label: 'Quadro',
    href: (projectId: string) => `/projects/${projectId}/board`,
    isActive: (pathname: string, projectId: string) => pathname.startsWith(`/projects/${projectId}/board`)
  },
  {
    label: 'Arquivos',
    href: (projectId: string) => `/projects/${projectId}/files`,
    isActive: (pathname: string, projectId: string) => pathname.startsWith(`/projects/${projectId}/files`)
  },
  {
    label: 'Relatórios',
    href: (projectId: string) => `/projects/${projectId}/reports`,
    isActive: (pathname: string, projectId: string) => pathname.startsWith(`/projects/${projectId}/reports`)
  }
] as const;

export const ProjectWorkspaceNav = ({
  projectId,
  projectName,
  projectColor,
  currentLabel,
  actions
}: ProjectWorkspaceNavProps) => {
  const pathname = usePathname();

  const activeItem = navItems.find((item) => item.isActive(pathname, projectId));
  const breadcrumbCurrent = currentLabel ?? activeItem?.label ?? 'Visão geral';

  return (
    <section className="surface-card overflow-hidden">
      <div className="h-1 w-full" style={{ background: projectColor ?? '#1565C0' }} />

      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="space-y-2">
          <p className="section-overline">
            <Link href="/dashboard" className="transition hover:text-[#0A4C78]">
              Painel
            </Link>{' '}
            /{' '}
            <Link href="/projects" className="transition hover:text-[#0A4C78]">
              Projetos
            </Link>{' '}
            /{' '}
            <Link href={`/projects/${projectId}`} className="transition hover:text-[#0A4C78]">
              {projectName}
            </Link>{' '}
            / <span className="text-[#0A4C78]">{breadcrumbCurrent}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-3.5 w-3.5 rounded-full border border-[#0A4C78]/20"
              style={{ backgroundColor: projectColor ?? '#1565C0' }}
            />
            <p className="font-display text-[1.35rem] font-semibold tracking-tight text-[#0A4C78]">{projectName}</p>
            <Badge variant="info">Projeto ativo</Badge>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <nav className="scrollbar-none flex gap-2 overflow-x-auto px-5 pb-4 sm:px-6">
        {navItems.map((item) => {
          const href = item.href(projectId);
          const active = item.isActive(pathname, projectId);

          return (
            <Link
              key={item.label}
              href={href as Route}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
                active
                  ? 'border-[#1565C0]/30 bg-[#1565C0]/12 text-[#0A4C78]'
                  : 'border-[#0A4C78]/12 bg-white text-[#4D667D] hover:border-[#1565C0]/32 hover:bg-[#F7FBFF] hover:text-[#0A4C78]'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
};
