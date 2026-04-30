import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';

type PermissionLockedStateProps = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
};

export const PermissionLockedState = ({
  title = 'Permissão necessária.',
  description = 'Você não tem permissão para esta ação.',
  ctaLabel,
  onCtaClick
}: PermissionLockedStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-app bg-white px-5 py-8 text-center">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-app-active text-brand">
      <Lock className="h-5 w-5" />
    </div>
    <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-app-muted">{description}</p>
    {ctaLabel ? (
      <Button className="mt-4" variant="subtle" onClick={onCtaClick}>
        {ctaLabel}
      </Button>
    ) : null}
  </div>
);
