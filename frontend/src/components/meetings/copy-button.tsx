'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CopyButtonProps = {
  content: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

export const CopyButton = ({
  content,
  label = 'Copiar',
  copiedLabel = 'Copiado',
  className
}: CopyButtonProps): JSX.Element => {
  const [isCopied, setIsCopied] = useState(false);
  const [hasError, setHasError] = useState(false);

  const canCopy = useMemo(() => content.trim().length > 0, [content]);

  useEffect(() => {
    if (!isCopied && !hasError) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsCopied(false);
      setHasError(false);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [isCopied, hasError]);

  const handleCopy = async (): Promise<void> => {
    if (!canCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setHasError(false);
    } catch {
      setHasError(true);
      setIsCopied(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={!canCopy}
      onClick={() => void handleCopy()}
      className={cn('rounded-full border border-[#0A4C78]/14 bg-white text-[#0A4C78] hover:bg-[#F2B11B]/10', className)}
    >
      {isCopied ? <Check size={14} /> : <Copy size={14} />}
      {isCopied ? copiedLabel : hasError ? 'Falha ao copiar' : label}
    </Button>
  );
};
