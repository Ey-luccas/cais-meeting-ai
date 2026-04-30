import { cn } from '@/lib/utils';

type KPICardProps = {
  title: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  className?: string;
};

export const KPICard = ({ title, value, helper, className }: KPICardProps) => (
  <article className={cn('rounded-[10px] border border-[#dfe5ef] bg-white p-5 shadow-[0_10px_22px_-22px_rgba(17,24,39,0.35)]', className)}>
    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#64748b]">{title}</p>
    <p className="mt-2 text-3xl font-semibold text-[#111827]">{value}</p>
    {helper ? <p className="mt-1 text-xs text-[#64748b]">{helper}</p> : null}
  </article>
);
