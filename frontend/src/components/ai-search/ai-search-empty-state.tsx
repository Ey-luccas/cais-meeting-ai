import { Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

type AiSearchEmptyStateProps = {
  title: string;
  description: string;
  suggestions: string[];
  showSuggestions?: boolean;
  canRestoreSuggestions?: boolean;
  onUseSuggestion: (question: string) => void;
  onDismissSuggestions?: () => void;
  onRestoreSuggestions?: () => void;
};

export const AiSearchEmptyState = ({
  title,
  description,
  suggestions,
  showSuggestions = true,
  canRestoreSuggestions = false,
  onUseSuggestion,
  onDismissSuggestions,
  onRestoreSuggestions
}: AiSearchEmptyStateProps) => {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-[#e3e8f2] bg-white px-5 py-7 text-center shadow-[0_8px_20px_rgba(10,40,78,0.04)] md:px-7">
      <div className="relative mb-3">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf3ff] text-[#005eb8]">
          <Sparkles className="h-5 w-5" />
        </div>

        {showSuggestions && suggestions.length > 0 && onDismissSuggestions ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDismissSuggestions}
            className="absolute right-0 top-0 h-8 w-8 rounded-full text-[#667085] hover:bg-[#f3f7fc] hover:text-[#111827]"
            aria-label="Ocultar sugestões"
            title="Ocultar sugestões"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <h3 className="text-xl font-semibold text-[#111827]">{title}</h3>
      <p className="mt-2 text-sm text-[#667085]">{description}</p>

      {!showSuggestions && canRestoreSuggestions && onRestoreSuggestions ? (
        <div className="mt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onRestoreSuggestions} className="text-[#005eb8]">
            Mostrar sugestões
          </Button>
        </div>
      ) : null}

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          showSuggestions ? 'mt-6 max-h-[500px] opacity-100' : 'mt-0 max-h-0 opacity-0'
        }`}
      >
        {suggestions.length > 0 ? (
          <div className="grid gap-2 text-left sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="subtle"
                className="h-auto justify-start rounded-lg border border-[#dbe3f0] bg-white px-3 py-2 text-xs leading-relaxed text-[#1f2937] hover:bg-[#f3f8ff]"
                onClick={() => onUseSuggestion(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
