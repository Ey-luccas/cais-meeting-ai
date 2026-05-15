import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
};

export const PageHeader = ({ title, description, eyebrow, actions, className }: PageHeaderProps) => (
  <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
    <div className="min-w-0 space-y-1.5">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">{eyebrow}</p> : null}
      <h2 className="truncate text-[28px] font-semibold leading-tight text-[#111827]">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-6 text-app-muted">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{actions}</div> : null}
  </div>
);
