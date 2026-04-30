'use client';

import { useEffect, useRef } from 'react';

import { AiSearchLoading } from '@/components/ai-search/ai-search-loading';
import { AiSearchMessage } from '@/components/ai-search/ai-search-message';
import type { AiSearchMessage as AiSearchMessageType } from '@/types/domain';

type AiSearchMessageListProps = {
  messages: AiSearchMessageType[];
  isAnswering: boolean;
  showProjectOrigin?: boolean;
  projectNamesById?: Record<string, string>;
};

export const AiSearchMessageList = ({
  messages,
  isAnswering,
  showProjectOrigin = false,
  projectNamesById = {}
}: AiSearchMessageListProps) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isAnswering, messages]);

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <AiSearchMessage
          key={message.id}
          message={message}
          showProjectOrigin={showProjectOrigin}
          projectNamesById={projectNamesById}
        />
      ))}

      {isAnswering ? <AiSearchLoading /> : null}

      <div ref={bottomRef} />
    </div>
  );
};
