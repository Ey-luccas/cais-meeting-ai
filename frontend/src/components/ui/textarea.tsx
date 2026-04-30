import * as React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'min-h-[120px] w-full rounded-[10px] border border-[#d3dceb] bg-white px-3.5 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#64748b] focus-visible:border-[#1565C0]/40 focus-visible:ring-2 focus-visible:ring-[#1565C0]/12',
      className
    )}
    ref={ref}
    {...props}
  />
));

Textarea.displayName = 'Textarea';

export { Textarea };
