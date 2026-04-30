'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { AppShellConfigProvider } from '@/components/layout/app-shell-config';
import { AppSessionProvider } from '@/lib/app-session';
import { useAuthGuard } from '@/lib/use-auth-guard';

export const AuthenticatedLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { status, session, signOut } = useAuthGuard();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#45607A]">
        Carregando sessão...
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleSignOut = () => {
    void signOut().finally(() => {
      router.push('/login');
    });
  };

  return (
    <AppSessionProvider session={session}>
      <AppShellConfigProvider>
        <AppShell
          userName={session.user.fullName}
          userEmail={session.user.email}
          userAvatarUrl={session.user.avatarUrl}
          userPhone={session.user.phone}
          onSignOut={handleSignOut}
        >
          {children}
        </AppShell>
      </AppShellConfigProvider>
    </AppSessionProvider>
  );
};
