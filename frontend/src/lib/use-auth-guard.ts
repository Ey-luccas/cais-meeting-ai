'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { clearStoredSession, getStoredSession, saveSession } from '@/lib/session';
import type { SessionResponse } from '@/types/domain';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export const useAuthGuard = () => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<SessionResponse | null>(null);

  const signOut = useCallback(async () => {
    try {
      await api.logout(session?.token);
    } catch {
      // Ignora falha remota e encerra sessão local.
    }

    clearStoredSession();
    setSession(null);
    setStatus('unauthenticated');
  }, [session?.token]);

  const refreshSession = useCallback(async () => {
    const stored = getStoredSession();

    try {
      const fresh = await api.getSession(stored?.token);
      saveSession(fresh);
      setSession(fresh);
      setStatus('authenticated');
    } catch {
      try {
        await api.logout(stored?.token);
      } catch {
        // Ignora falha remota ao limpar cookie.
      }
      clearStoredSession();
      setSession(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return useMemo(
    () => ({
      status,
      session,
      signOut,
      refreshSession
    }),
    [refreshSession, session, signOut, status]
  );
};
