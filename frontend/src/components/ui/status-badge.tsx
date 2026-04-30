import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  className?: string;
};

const toneClassName = {
  neutral: 'border-app bg-white text-app-muted',
  info: 'border-app-softBorder bg-app-active text-brand',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-[#F9B51B]/40 bg-[#F9B51B]/18 text-[#7c5800]',
  danger: 'border-red-200 bg-red-50 text-red-700'
};

export const StatusBadge = ({ label, tone = 'neutral', className }: StatusBadgeProps) => (
  <span className={cn('inline-flex items-center rounded-[999px] border px-2.5 py-1 text-xs font-semibold', toneClassName[tone], className)}>
    {label}
  </span>
);
