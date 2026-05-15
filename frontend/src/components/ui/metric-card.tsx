import Link from 'next/link';
import type { Route } from 'next';
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
  onClick?: () => void;
  href?: Route;
};

export const MetricCard = ({
  title,
  value,
  suffix,
  icon: Icon,
  valueClassName,
  suffixClassName,
  className,
  onClick,
  href
}: MetricCardProps) => {
  const containerClassName = cn(
    'relative min-h-[148px] overflow-hidden rounded-2xl border border-[#c2c6d4]/50 bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.02)]',
    className
  );

  const content = (
    <>
      <Icon className="pointer-events-none absolute right-[-18px] top-1/2 h-28 w-28 -translate-y-1/2 text-[#727783] opacity-[0.08]" />

      <div className="relative z-10">
        <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#424752]">{title}</span>

        <div className="mt-4 flex items-end gap-2">
          <span className={cn('text-4xl font-bold text-[#191c21]', valueClassName)}>{value}</span>

          {suffix ? <span className={cn('text-sm font-semibold text-[#727783]', suffixClassName)}>{suffix}</span> : null}
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          containerClassName,
          'block w-full text-left transition-colors hover:border-[#b8d4f5] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20'
        )}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          containerClassName,
          'w-full text-left transition-colors hover:border-[#b8d4f5] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20'
        )}
      >
        {content}
      </button>
    );
  }

  return <article className={containerClassName}>{content}</article>;
};
