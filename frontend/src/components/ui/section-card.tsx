import { cn } from '@/lib/utils';

type SectionCardProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
};

export const SectionCard = ({ title, description, action, children, className, bodyClassName }: SectionCardProps) => (
  <section className={cn('surface-card overflow-hidden', className)}>
    {(title || description || action) ? (
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app px-5 py-4">
        <div className="min-w-0">
          {title ? <h3 className="text-base font-bold text-[#111827]">{title}</h3> : null}
          {description ? <p className="mt-1 text-sm text-app-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    ) : null}
    <div className={cn('p-5', bodyClassName)}>{children}</div>
  </section>
);
