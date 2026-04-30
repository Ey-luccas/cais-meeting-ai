import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-[999px] border px-2.5 py-1 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'border-app bg-white text-brand',
      info: 'border-app-softBorder bg-app-active text-brand',
      warning: 'border-[#F9B51B]/35 bg-[#F9B51B]/18 text-[#7c5800]',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      danger: 'border-red-200 bg-red-50 text-red-700'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps): JSX.Element => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);
