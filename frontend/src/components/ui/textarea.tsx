import * as React from 'react';

import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[120px] w-full rounded-2xl border border-[#0A4C78]/16 bg-white px-4 py-3 text-sm text-[#0A4C78] outline-none placeholder:text-[#0A4C78]/45 focus-visible:border-[#0A4C78]/30 focus-visible:ring-2 focus-visible:ring-[#F2B11B]/65',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
