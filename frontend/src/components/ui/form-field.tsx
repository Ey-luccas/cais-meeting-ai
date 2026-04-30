import { cn } from '@/lib/utils';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

export const FormField = ({ label, htmlFor, hint, className, children }: FormFieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#64748b]">
      {label}
    </label>
    {children}
    {hint ? <p className="text-xs text-[#64748b]">{hint}</p> : null}
  </div>
);
