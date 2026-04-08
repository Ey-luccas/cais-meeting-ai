import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold tracking-[0.01em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        default:
          'border border-[#F2B11B]/40 bg-accent text-accent-foreground shadow-soft hover:-translate-y-0.5 hover:bg-[#ffc13b]',
        secondary:
          'border border-[rgba(255,255,255,0.24)] bg-[rgba(255,255,255,0.07)] text-white hover:border-[rgba(255,255,255,0.35)] hover:bg-[rgba(255,255,255,0.16)]',
        ghost:
          'border border-[#0A4C78]/12 bg-white text-primary-dark shadow-none hover:border-[#0A4C78]/18 hover:bg-[#F2B11B]/12',
        destructive: 'border border-red-700/30 bg-red-600 text-white hover:bg-red-700'
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
