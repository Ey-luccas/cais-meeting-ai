'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';

import { ApiError, api } from '@/lib/api';
import { getStoredSession, saveSession } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const session = getStoredSession();

    if (session?.token) {
      router.replace('/dashboard');
    }
  }, [router]);

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const session = await api.login({
        email: email.trim(),
        password
      });

      saveSession(session);
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível autenticar.');
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
              className="h-9 w-9 rounded-[10px]"
              priority
            />
            <span className="text-sm font-bold text-brand">Cais Teams</span>
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center rounded-[10px] border border-[#d5deec] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#f8faff]"
          >
            Criar conta
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1100px] gap-6 px-6 py-10 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-14">
        <section className="rounded-[10px] border border-[#dfe5ef] bg-white p-6">
          <h1 className="text-3xl font-bold text-[#0f172a]">Entrar no Cais Teams</h1>
          <p className="mt-3 text-sm text-[#475569]">
            Acesse o ambiente da sua organização para acompanhar decisões, tarefas, reuniões e projetos.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              Organização, equipe, quadro e arquivos em um único fluxo.
            </div>
            <div className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              Pesquisa IA Central com escopo por organização ou por projeto.
            </div>
          </div>
        </section>

        <section className="rounded-[10px] border border-[#dfe5ef] bg-white p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#0f172a]">Acesso</h2>
            <p className="mt-1 text-sm text-[#64748b]">Use seu e-mail e senha para continuar.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com"
                className="h-11 w-full rounded-[10px] border border-[#d9e1ed] bg-white px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="password">
                  Senha
                </label>
                <span className="text-xs text-[#64748b]">Recuperação de senha em breve.</span>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-[10px] border border-[#d9e1ed] bg-white px-3 pr-11 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#334155]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#febb28] text-sm font-semibold text-[#3f2b00] transition-colors hover:bg-[#f5b20e] disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {errorMessage ? (
            <p className="mt-4 rounded-[10px] border border-[#ffdad6] bg-[#fff1ef] px-4 py-3 text-sm text-[#93000a]">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-between border-t border-[#e4e9f2] pt-4">
            <p className="text-sm text-[#475569]">Ainda não tem conta?</p>
            <Link href="/register" className="text-sm font-semibold text-brand hover:underline">
              Criar conta
            </Link>
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-[#64748b]">
            <Lock className="h-3.5 w-3.5" />
            Segurança e rastreabilidade por organização.
          </p>
        </section>
      </main>
    </div>
  );
}
