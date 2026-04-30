import type { SessionResponse } from '@/types/domain';

const SESSION_STORAGE_KEY = 'cais_meeting_ai_session';

export const saveSession = (session: SessionResponse): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const getStoredSession = (): SessionResponse | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionResponse;
  } catch {
    return null;
  }
};

export const clearStoredSession = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
};
