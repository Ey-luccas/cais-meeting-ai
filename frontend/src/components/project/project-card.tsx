import Link from 'next/link';
import type { Route } from 'next';
import { MoreHorizontal } from 'lucide-react';

import type { ProjectSummary } from '@/types/domain';

type ProjectCardProps = {
  project: ProjectSummary;
  href: Route;
};

export const ProjectCard = ({ project, href }: ProjectCardProps) => (
  <Link href={href} className="surface-card flex min-h-[260px] flex-col p-5 transition hover:border-app-softBorder">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? '#005EB8' }} />
        <h3 className="truncate text-lg font-bold text-[#111827]">{project.name}</h3>
      </div>
      <MoreHorizontal className="h-4 w-4 shrink-0 text-app-muted" />
    </div>

    <p className="line-clamp-3 flex-1 text-sm text-app-muted">{project.description || 'Projeto sem descrição.'}</p>

    <div className="mt-5 grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-app p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-app-muted">Reuniões</p>
        <p className="mt-1 text-lg font-bold text-[#111827]">{project.metrics.meetings}</p>
      </div>
      <div className="rounded-lg bg-app p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-app-muted">Cards</p>
        <p className="mt-1 text-lg font-bold text-[#111827]">{project.metrics.cards}</p>
      </div>
    </div>
  </Link>
);
