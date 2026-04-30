import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type MetricCardProps = {
  title: string;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  icon: LucideIcon;
  valueClassName?: string;
  suffixClassName?: string;
  className?: string;
};

export const MetricCard = ({
  title,
  value,
  suffix,
  icon: Icon,
  valueClassName,
  suffixClassName,
  className
}: MetricCardProps) => (
  <article
    className={cn(
      'relative min-h-[148px] overflow-hidden border border-[#c2c6d4]/50 bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.02)]',
      className
    )}
  >
    <Icon className="pointer-events-none absolute right-[-18px] top-1/2 h-28 w-28 -translate-y-1/2 text-[#727783] opacity-[0.08]" />

    <div className="relative z-10">
      <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#424752]">{title}</span>

      <div className="mt-4 flex items-end gap-2">
        <span className={cn('text-4xl font-bold text-[#191c21]', valueClassName)}>{value}</span>

        {suffix ? <span className={cn('text-sm font-semibold text-[#727783]', suffixClassName)}>{suffix}</span> : null}
      </div>
    </div>
  </article>
);
