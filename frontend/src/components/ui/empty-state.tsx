import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
};

export const EmptyState = ({ title, description, action, icon: Icon }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-app bg-white px-5 py-8 text-center">
    {Icon ? (
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-app-active text-brand">
        <Icon className="h-5 w-5" />
      </div>
    ) : null}
    <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
    {description ? <p className="mt-1 max-w-sm text-sm text-app-muted">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);
