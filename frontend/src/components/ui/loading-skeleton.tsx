import { cn } from '@/lib/utils';

type LoadingSkeletonProps = {
  lines?: number;
  className?: string;
};

export const LoadingSkeleton = ({ lines = 3, className }: LoadingSkeletonProps) => (
  <div className={cn('surface-card p-5', className)}>
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded bg-app"
          style={{ width: `${Math.max(45, 100 - index * 12)}%` }}
        />
      ))}
    </div>
  </div>
);
