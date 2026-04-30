import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        default: 'bg-brand px-4 py-2 text-white hover:bg-brand-secondary',
        secondary: 'bg-cta px-4 py-2 text-[#191c21] hover:bg-[#e8a914]',
        ghost: 'text-brand hover:bg-app-active',
        subtle: 'border border-app bg-white text-[#334155] hover:border-app-softBorder hover:bg-app-active',
        warning:
          'bg-cta px-4 py-2 text-[#191c21] hover:bg-[#e8a914]'
      },
      size: {
        default: 'h-10',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10 rounded-[10px]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
