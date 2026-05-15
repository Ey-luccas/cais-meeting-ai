'use client';

import { Loader2, SendHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type AiSearchInputProps = {
  disabled?: boolean;
  isSending?: boolean;
  initialValue?: string;
  resetKey?: string | number | null;
  placeholder?: string;
  disabledReason?: string | null;
  onValueChange?: (value: string) => void;
  onSubmit: (question: string) => Promise<void> | void;
};

export const AiSearchInput = ({
  disabled = false,
  isSending = false,
  initialValue = '',
  resetKey,
  placeholder = 'Pergunte sobre reuniões, decisões, tarefas, arquivos e projetos.',
  disabledReason = null,
  onValueChange,
  onSubmit
}: AiSearchInputProps) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
    onValueChange?.(initialValue);
  }, [initialValue, onValueChange, resetKey]);

  const canSubmit = !disabled && !isSending && value.trim().length >= 2;

  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    const question = value.trim();
    setValue('');
    onValueChange?.('');
    await onSubmit(question);
  };

  return (
    <div className="rounded-xl border border-[#d7dfec] bg-white p-3 shadow-[0_8px_20px_rgba(10,40,78,0.05)]">
      <textarea
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          onValueChange?.(nextValue);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled || isSending}
        className="min-h-[128px] w-full resize-none border-none bg-transparent px-2 py-1 text-sm leading-relaxed text-[#111827] outline-none placeholder:text-[#667085]"
      />

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e5eaf4] pt-3">
        <p className="text-xs text-[#667085]">{disabledReason ?? 'Enter envia. Shift + Enter quebra linha.'}</p>
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="h-10 gap-2 rounded-lg bg-[#005eb8] px-4 text-white hover:bg-[#004b93]"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          {isSending ? 'Buscando...' : 'Enviar'}
        </Button>
      </div>
    </div>
  );
};
