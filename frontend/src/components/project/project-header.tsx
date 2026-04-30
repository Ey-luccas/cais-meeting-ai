import { StatusBadge } from '@/components/ui/status-badge';

type ProjectHeaderProps = {
  name: string;
  description?: string | null;
  color?: string | null;
  actions?: React.ReactNode;
};

export const ProjectHeader = ({ name, description, color, actions }: ProjectHeaderProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color ?? '#005EB8' }} />
        <StatusBadge label="Projeto ativo" tone="info" />
      </div>
      <h2 className="truncate text-[28px] font-semibold leading-tight text-[#111827]">{name}</h2>
      {description ? <p className="mt-1.5 max-w-3xl text-sm text-app-muted">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
