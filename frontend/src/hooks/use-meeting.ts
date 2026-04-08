'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api';
import { meetingsModule } from '@/modules/meetings';
import type { Meeting } from '@/types/meeting';

type UseMeetingState = {
  meeting: Meeting | null;
  isLoading: boolean;
  error: string | null;
};

export const useMeeting = (id: string) => {
  const [state, setState] = useState<UseMeetingState>({
    meeting: null,
    isLoading: true,
    error: null
  });

  const loadMeeting = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const meeting = await meetingsModule.details(id);
      setState({ meeting, isLoading: false, error: null });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Não foi possível carregar a reunião.';
      setState({ meeting: null, isLoading: false, error: message });
    }
  }, [id]);

  useEffect(() => {
    void loadMeeting();
  }, [loadMeeting]);

  return {
    ...state,
    reload: loadMeeting
  };
};
