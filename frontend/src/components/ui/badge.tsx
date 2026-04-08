import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.1)] text-white',
        success: 'border-[#0A5672]/24 bg-[#0A5672]/12 text-[#0A5672]',
        warning: 'border-[#F2B11B]/45 bg-[#F2B11B]/18 text-[#7A5B10]',
        danger: 'border-red-500/20 bg-red-500/10 text-red-600'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
