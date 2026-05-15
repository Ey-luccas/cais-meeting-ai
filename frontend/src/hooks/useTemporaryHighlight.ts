'use client';

import { useEffect, useState } from 'react';

type UseTemporaryHighlightInput = {
  highlightId?: string | null;
  durationMs?: number;
};

const escapeSelector = (value: string): string => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
};

export const useTemporaryHighlight = ({
  highlightId,
  durationMs = 4500
}: UseTemporaryHighlightInput): { activeHighlightId: string | null } => {
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  useEffect(() => {
    const normalized = highlightId?.trim() ?? '';

    if (!normalized) {
      setActiveHighlightId(null);
      return;
    }

    setActiveHighlightId(normalized);

    const timeoutId = window.setTimeout(() => {
      setActiveHighlightId((current) => (current === normalized ? null : current));
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, highlightId]);

  useEffect(() => {
    if (!activeHighlightId) {
      return;
    }

    let attempts = 0;
    const escaped = escapeSelector(activeHighlightId);

    const scrollToTarget = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-highlight-id="${escaped}"], #highlight-${escaped}`
      );

      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });

        return true;
      }

      return false;
    };

    if (scrollToTarget()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      attempts += 1;

      if (scrollToTarget() || attempts >= 25) {
        window.clearInterval(intervalId);
      }
    }, 160);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeHighlightId]);

  return { activeHighlightId };
};
