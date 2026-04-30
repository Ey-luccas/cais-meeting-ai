'use client';

import { createContext, useContext } from 'react';

import type { SessionResponse } from '@/types/domain';

const AppSessionContext = createContext<SessionResponse | null>(null);

export const AppSessionProvider = ({
  session,
  children
}: {
  session: SessionResponse;
  children: React.ReactNode;
}) => {
  return <AppSessionContext.Provider value={session}>{children}</AppSessionContext.Provider>;
};

export const useAppSession = (): SessionResponse => {
  const session = useContext(AppSessionContext);

  if (!session) {
    throw new Error('useAppSession deve ser usado dentro de AppSessionProvider.');
  }

  return session;
};
