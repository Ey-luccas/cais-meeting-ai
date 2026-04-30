import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'h-11 w-full rounded-[10px] border border-[#d3dceb] bg-white px-3.5 text-sm text-[#111827] outline-none transition placeholder:text-[#64748b] focus-visible:border-[#1565C0]/40 focus-visible:ring-2 focus-visible:ring-[#1565C0]/12',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = 'Input';

export { Input };
