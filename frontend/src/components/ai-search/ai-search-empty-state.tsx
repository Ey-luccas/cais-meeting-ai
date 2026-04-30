import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

type AiSearchEmptyStateProps = {
  title: string;
  description: string;
  suggestions: string[];
  onUseSuggestion: (question: string) => void;
};

export const AiSearchEmptyState = ({ title, description, suggestions, onUseSuggestion }: AiSearchEmptyStateProps) => {
  return (
    <div className="mx-auto max-w-3xl rounded-[12px] border border-[#e3e8f2] bg-white px-5 py-7 text-center shadow-[0_8px_20px_rgba(10,40,78,0.04)] md:px-7">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf3ff] text-[#005eb8]">
        <Sparkles className="h-5 w-5" />
      </div>

      <h3 className="text-xl font-semibold text-[#111827]">{title}</h3>
      <p className="mt-2 text-sm text-[#667085]">{description}</p>

      {suggestions.length > 0 ? (
        <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
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
  );
};
