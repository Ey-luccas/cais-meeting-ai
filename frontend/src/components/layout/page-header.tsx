import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
};

export const PageHeader = ({ title, description, eyebrow, actions, className }: PageHeaderProps) => (
  <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand">{eyebrow}</p> : null}
      <h2 className="truncate text-[28px] font-semibold leading-tight text-[#111827]">{title}</h2>
      {description ? <p className="mt-1.5 max-w-3xl text-sm text-app-muted">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
