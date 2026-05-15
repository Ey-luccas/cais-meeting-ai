'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';

import { ApiError, api } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [tokenLoaded, setTokenLoaded] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
    setToken(nextToken);
    setTokenLoaded(true);
  }, []);

  const canSubmit = useMemo(
    () => tokenLoaded && token.length > 0 && password.length >= 8 && confirmPassword.length >= 8 && !loading,
    [confirmPassword.length, loading, password.length, token.length, tokenLoaded]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação de senha não confere.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.resetPassword({
        token,
        password
      });

      setSuccessMessage('Senha redefinida com sucesso. Redirecionando para login...');
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 1200);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível redefinir sua senha.');
      }
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-bold text-[#0f172a]">Redefinir senha</h1>
          <p className="mt-3 text-sm text-[#475569]">
            Defina uma nova senha de acesso. Esse link pode ser usado uma única vez.
          </p>

          <div className="mt-6 rounded-xl border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
            Se o token estiver expirado, solicite um novo link em “Esqueci minha senha”.
          </div>
        </section>

        <section className="rounded-xl border border-[#dfe5ef] bg-white p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#0f172a]">Nova senha</h2>
            <p className="mt-1 text-sm text-[#64748b]">Use no mínimo 8 caracteres.</p>
          </div>

          {!tokenLoaded ? (
            <p className="rounded-xl border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              Validando link de redefinição...
            </p>
          ) : !token ? (
            <p className="rounded-xl border border-[#ffdad6] bg-[#fff1ef] px-4 py-3 text-sm text-[#93000a]">
              Token de redefinição ausente ou inválido.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="password">
                  Nova senha
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
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="confirm_password">
                  Confirmar nova senha
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
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#febb28] text-sm font-semibold text-[#3f2b00] transition-colors hover:bg-[#f5b20e] disabled:opacity-60"
              >
                {loading ? 'Salvando...' : 'Redefinir senha'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {successMessage ? (
            <p className="mt-4 rounded-xl border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75]">
              {successMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-[#ffdad6] bg-[#fff1ef] px-4 py-3 text-sm text-[#93000a]">
              {errorMessage}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
