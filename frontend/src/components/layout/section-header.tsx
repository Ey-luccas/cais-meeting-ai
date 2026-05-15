import { cn } from '@/lib/utils';

type SectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export const SectionHeader = ({ title, description, actions, className }: SectionHeaderProps) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
    <div className="min-w-0 space-y-1.5">
      <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
      {description ? <p className="text-sm leading-6 text-app-muted">{description}</p> : null}
    </div>
    {actions ? <div className="shrink-0 pt-0.5">{actions}</div> : null}
  </div>
);
