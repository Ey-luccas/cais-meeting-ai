'use client';

import { useCallback, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api';
import { meetingsModule } from '@/modules/meetings';
import type { Meeting } from '@/types/meeting';

type UseMeetingsState = {
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;
};

export const useMeetings = () => {
  const [state, setState] = useState<UseMeetingsState>({
    meetings: [],
    isLoading: true,
    error: null
  });

  const loadMeetings = useCallback(async () => {
    try {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: null
      }));

      const meetings = await meetingsModule.list();

      setState({
        meetings,
        isLoading: false,
        error: null
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Não foi possível carregar as reuniões.';

      setState((current) => ({
        ...current,
        isLoading: false,
        error: message
      }));
    }
  }, []);

  const prependMeeting = useCallback((meeting: Meeting) => {
    setState((current) => ({
      ...current,
      meetings: [meeting, ...current.meetings.filter((item) => item.id !== meeting.id)]
    }));
  }, []);

  const completedCount = useMemo(
    () => state.meetings.filter((meeting) => meeting.status === 'COMPLETED').length,
    [state.meetings]
  );

  const processingCount = useMemo(
    () =>
      state.meetings.filter(
        (meeting) =>
          meeting.status === 'TRANSCRIBING' ||
          meeting.status === 'TRANSCRIBED' ||
          meeting.status === 'PROCESSING_AI'
      ).length,
    [state.meetings]
  );

  return {
    ...state,
    completedCount,
    processingCount,
    loadMeetings,
    prependMeeting
  };
};
