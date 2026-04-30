import { cn } from '@/lib/utils';

type SectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export const SectionHeader = ({ title, description, actions, className }: SectionHeaderProps) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
    <div className="min-w-0">
      <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
      {description ? <p className="mt-1 text-sm text-app-muted">{description}</p> : null}
    </div>
    {actions ? <div className="shrink-0">{actions}</div> : null}
  </div>
);
