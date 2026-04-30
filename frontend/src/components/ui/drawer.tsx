import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
  bodyClassName?: string;
};

export const Drawer = ({
  open,
  title,
  description,
  onClose,
  children,
  maxWidthClassName = 'max-w-2xl',
  bodyClassName
}: DrawerProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <aside className={cn('scrollbar-none h-full w-full overflow-y-auto bg-white shadow-xl', maxWidthClassName)}>
        <header className="sticky top-0 z-10 border-b border-app bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-[#111827]">{title}</h3>
              {description ? <p className="mt-1 text-sm text-app-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-app-muted transition-colors hover:bg-app-active hover:text-brand"
              aria-label="Fechar painel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className={cn('p-5', bodyClassName)}>{children}</div>
      </aside>
    </div>
  );
};
