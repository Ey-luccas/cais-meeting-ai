import { cn } from '@/lib/utils';

type PageActionsProps = {
  children: React.ReactNode;
  className?: string;
};

export const PageActions = ({ children, className }: PageActionsProps) => (
  <div className={cn('flex shrink-0 flex-wrap items-center gap-2', className)}>{children}</div>
);
