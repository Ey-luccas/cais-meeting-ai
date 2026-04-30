import { Archive, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

type AiSearchThreadActionsProps = {
  disabled?: boolean;
  onArchive: () => void;
  onDelete: () => void;
};

export const AiSearchThreadActions = ({
  disabled = false,
  onArchive,
  onDelete
}: AiSearchThreadActionsProps) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="subtle"
        size="sm"
        disabled={disabled}
        className="gap-1"
        onClick={onArchive}
      >
        <Archive className="h-3.5 w-3.5" />
        Arquivar
      </Button>
      <Button
        type="button"
        variant="subtle"
        size="sm"
        disabled={disabled}
        className="gap-1 text-[#ba1a1a] hover:bg-[#ffdad6]"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Apagar
      </Button>
    </div>
  );
};
