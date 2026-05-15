'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { AppShellConfigProvider } from '@/components/layout/app-shell-config';
import { AppSessionProvider } from '@/lib/app-session';
import { useAuthGuard } from '@/lib/use-auth-guard';
import type { SessionResponse } from '@/types/domain';

export const AuthenticatedLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { status, session, signOut } = useAuthGuard();
  const [sessionState, setSessionState] = useState<SessionResponse | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  useEffect(() => {
    setSessionState(session);
  }, [session]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#45607A]">
        Carregando sessão...
      </div>
    );
  }

  if (!sessionState) {
    return null;
  }

  const handleSignOut = () => {
    void signOut().finally(() => {
      router.push('/login');
    });
  };

  return (
    <AppSessionProvider session={sessionState}>
      <AppShellConfigProvider>
        <AppShell
          userName={sessionState.user.fullName}
          userEmail={sessionState.user.email}
          userAvatarUrl={sessionState.user.avatarUrl}
          userPhone={sessionState.user.phone}
          onSessionUpdate={setSessionState}
          onSignOut={handleSignOut}
        >
          {children}
        </AppShell>
      </AppShellConfigProvider>
    </AppSessionProvider>
  );
};
