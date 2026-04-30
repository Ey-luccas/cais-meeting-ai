import { AlertCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type AiSearchChatPanelProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  scopeControls?: ReactNode;
  errorMessage?: string | null;
  isMutatingThread?: boolean;
  body: ReactNode;
  input: ReactNode;
};

export const AiSearchChatPanel = ({
  title,
  description,
  actions,
  scopeControls,
  errorMessage = null,
  isMutatingThread = false,
  body,
  input
}: AiSearchChatPanelProps) => {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#f7f9fd]">
      <header className="border-b border-[#e5eaf4] bg-white px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#141a24]">{title}</h2>
            <p className="mt-1 text-sm text-[#667085]">{description}</p>
          </div>
          {actions}
        </div>

        {scopeControls ? <div className="mt-4">{scopeControls}</div> : null}

        {errorMessage ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#ffd8d3] bg-[#ffefed] px-3 py-2 text-xs text-[#93000a]">
            <AlertCircle className="h-3.5 w-3.5" />
            {errorMessage}
          </div>
        ) : null}

        {isMutatingThread ? <Loader2 className="mt-3 h-4 w-4 animate-spin text-[#727783]" /> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">{body}</div>

      <footer className="border-t border-[#e5eaf4] bg-white px-4 py-4 md:px-6">{input}</footer>
    </section>
  );
};
