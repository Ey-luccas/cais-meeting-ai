import { cn } from '@/lib/utils';

type KPIGridProps = {
  children: React.ReactNode;
  className?: string;
};

export const KPIGrid = ({ children, className }: KPIGridProps) => (
  <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
);
