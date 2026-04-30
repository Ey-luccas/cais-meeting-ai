import { AiSearchSources } from '@/components/ai-search/ai-search-sources';
import { cn } from '@/lib/utils';
import type { AiSearchMessage as AiSearchMessageType } from '@/types/domain';

type AiSearchMessageProps = {
  message: AiSearchMessageType;
  showProjectOrigin?: boolean;
  projectNamesById?: Record<string, string>;
};

const isAssistantMessage = (role: AiSearchMessageType['role']): boolean => role === 'ASSISTANT';

export const AiSearchMessage = ({
  message,
  showProjectOrigin = false,
  projectNamesById = {}
}: AiSearchMessageProps) => {
  const assistant = isAssistantMessage(message.role);

  return (
    <div className={cn('flex w-full', assistant ? 'justify-start' : 'justify-end')}>
      <article
        className={cn(
          'max-w-[900px] rounded-[12px] px-4 py-3',
          assistant
            ? 'border border-[#e2e8f3] bg-white text-[#111827]'
            : 'bg-[#005eb8] text-white shadow-[0_8px_18px_rgba(0,94,184,0.22)]'
        )}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

        {assistant ? (
          <AiSearchSources
            sources={message.sources}
            showProjectOrigin={showProjectOrigin}
            projectNamesById={projectNamesById}
          />
        ) : null}
      </article>
    </div>
  );
};
