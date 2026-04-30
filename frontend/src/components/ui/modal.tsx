import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export const Modal = ({ open, title, description, onClose, children, className }: ModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className={cn('w-full max-w-xl rounded-[14px] border border-app bg-white shadow-soft', className)}>
        <div className="flex items-start justify-between gap-4 border-b border-app px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-[#111827]">{title}</h3>
            {description ? <p className="mt-1 text-sm text-app-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-app-muted transition-colors hover:bg-app-active hover:text-brand"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-none max-h-[72vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
};
