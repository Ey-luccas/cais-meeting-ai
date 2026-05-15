'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Lock, Mail, UserRound } from 'lucide-react';

import { ApiError, api } from '@/lib/api';
import { saveSession } from '@/lib/session';
import type { InvitationValidationResponse } from '@/types/domain';

const roleLabel: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
  VIEWER: 'Visualizador'
};

const invitationStatusMessage = (invitation: InvitationValidationResponse | null): string | null => {
  if (!invitation) {
    return null;
  }

  if (invitation.isValid) {
    return null;
  }

  if (invitation.isAccepted) {
    return 'Este convite já foi aceito.';
  }

  if (invitation.isExpired) {
    return 'Este convite expirou. Solicite um novo convite ao administrador.';
  }

  return 'Convite inválido.';
};

export default function AcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [tokenLoaded, setTokenLoaded] = useState(false);

  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationValidationResponse | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const invitationStatus = useMemo(() => invitationStatusMessage(invitation), [invitation]);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
    setToken(nextToken);
    setTokenLoaded(true);
  }, []);

  useEffect(() => {
    if (!tokenLoaded) {
      return;
    }

    let isMounted = true;

    const loadInvitation = async () => {
      if (!token) {
        setInvitation(null);
        setIsLoadingInvitation(false);
        setErrorMessage('Token de convite ausente.');
        return;
      }

      setIsLoadingInvitation(true);
      setErrorMessage(null);

      try {
        const payload = await api.validateInvitationToken(token);

        if (!isMounted) {
          return;
        }

        setInvitation(payload);
      } catch {
        if (!isMounted) {
          return;
        }

        setInvitation(null);
        setErrorMessage('Não foi possível validar o convite.');
      } finally {
        if (isMounted) {
          setIsLoadingInvitation(false);
        }
      }
    };

    void loadInvitation();

    return () => {
      isMounted = false;
    };
  }, [token, tokenLoaded]);

  const canSubmit = Boolean(
    invitation?.isValid &&
      fullName.trim().length >= 2 &&
      password.length >= 8 &&
      confirmPassword.length >= 8 &&
      !isSubmitting
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!invitation?.isValid) {
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação de senha não confere.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const session = await api.acceptInvitation(token, {
        name: fullName.trim(),
        password
      });

      saveSession(session);
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível aceitar o convite.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#111827]">
      <header className="border-b border-[#dfe5ef] bg-[#f5f7fb]">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/caishub-svg-fonte-preta.svg"
              alt="Logo Cais Teams"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
              priority
            />
            <span className="text-sm font-bold text-brand">Cais Teams</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-xl border border-[#d5deec] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#f8faff]"
          >
            Voltar para login
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1100px] gap-6 px-6 py-10 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-14">
        <section className="rounded-xl border border-[#dfe5ef] bg-white p-6">
          <h1 className="text-3xl font-bold text-[#0f172a]">Aceitar convite</h1>
          <p className="mt-3 text-sm text-[#475569]">
            Finalize seu acesso definindo nome e senha para entrar na organização.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              O link de convite é temporário e expira automaticamente por segurança.
            </div>
            <div className="rounded-xl border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              Após concluir, você verá somente os projetos em que foi adicionado.
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#dfe5ef] bg-white p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#0f172a]">Dados do convite</h2>
            <p className="mt-1 text-sm text-[#64748b]">Confira os dados antes de criar sua senha.</p>
          </div>

          {isLoadingInvitation ? (
            <p className="rounded-xl border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              Validando convite...
            </p>
          ) : (
            <>
              <div className="mb-5 space-y-2 rounded-xl border border-[#e4e9f2] bg-[#f8faff] p-4 text-sm text-[#334155]">
                <p>
                  <strong>E-mail:</strong> {invitation?.email ?? '-'}
                </p>
                <p>
                  <strong>Papel:</strong> {invitation?.role ? (roleLabel[invitation.role] ?? invitation.role) : '-'}
                </p>
                <p>
                  <strong>Projetos:</strong>{' '}
                  {invitation?.projects.length
                    ? invitation.projects.map((project) => project.name).join(', ')
                    : 'Nenhum projeto associado'}
                </p>
              </div>

              {invitationStatus ? (
                <p className="mb-4 rounded-xl border border-[#ffdad6] bg-[#fff1ef] px-4 py-3 text-sm text-[#93000a]">
                  {invitationStatus}
                </p>
              ) : null}
            </>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="full_name">
                Nome completo
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="full_name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  className="h-11 w-full rounded-xl border border-[#d9e1ed] bg-white px-10 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                  disabled={!invitation?.isValid}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="password">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="h-11 w-full rounded-xl border border-[#d9e1ed] bg-white px-10 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                  disabled={!invitation?.isValid}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="confirm_password">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="h-11 w-full rounded-xl border border-[#d9e1ed] bg-white px-10 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                  disabled={!invitation?.isValid}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#febb28] text-sm font-semibold text-[#3f2b00] transition-colors hover:bg-[#f5b20e] disabled:opacity-60"
            >
              {isSubmitting ? 'Finalizando...' : 'Aceitar convite e entrar'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-[#ffdad6] bg-[#fff1ef] px-4 py-3 text-sm text-[#93000a]">
              {errorMessage}
            </p>
          ) : null}

          <p className="mt-6 flex items-center gap-2 text-xs text-[#64748b]">
            <Mail className="h-3.5 w-3.5" />
            O convite está vinculado ao e-mail informado pelo administrador.
          </p>
        </section>
      </main>
    </div>
  );
}
