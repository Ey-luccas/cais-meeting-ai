import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-full border border-[#0A4C78]/16 bg-white px-4 py-2 text-sm text-[#0A4C78] outline-none placeholder:text-[#0A4C78]/45 focus-visible:border-[#0A4C78]/30 focus-visible:ring-2 focus-visible:ring-[#F2B11B]/65',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
