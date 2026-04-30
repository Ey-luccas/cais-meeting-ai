'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, Lock, Mail, UserRound } from 'lucide-react';

import { ApiError, api } from '@/lib/api';
import { getStoredSession, saveSession } from '@/lib/session';

const slugFromName = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

const randomSuffix = (): string => Math.random().toString(36).slice(2, 8);

export default function RegisterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const session = getStoredSession();

    if (session?.token) {
      router.replace('/dashboard');
    }
  }, [router]);

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      organizationName.trim().length >= 2 &&
      corporateEmail.trim().length > 0 &&
      password.length >= 8
    );
  }, [corporateEmail, fullName, organizationName, password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const generatedSlugBase = slugFromName(organizationName) || 'organization';
      const organizationSlug = `${generatedSlugBase}-${randomSuffix()}`;

      const session = await api.registerOrganization({
        organizationName: organizationName.trim(),
        organizationSlug,
        organizationEmail: corporateEmail.trim(),
        ownerName: fullName.trim(),
        ownerEmail: corporateEmail.trim(),
        ownerPassword: password
      });

      saveSession(session);
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível concluir o cadastro.');
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
            href="/login"
            className="inline-flex h-10 items-center rounded-[10px] border border-[#d5deec] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#f8faff]"
          >
            Já tenho conta
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1100px] gap-6 px-6 py-10 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-14">
        <section className="rounded-[10px] border border-[#dfe5ef] bg-white p-6">
          <h1 className="text-3xl font-bold text-[#0f172a]">Criar organização no Cais Teams</h1>
          <p className="mt-3 text-sm text-[#475569]">
            Estruture um espaço único para reuniões, projetos, board, arquivos e Pesquisa IA Central.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              Ambiente organizacional com controles de acesso por papel.
            </div>
            <div className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
              Escopo de dados por projeto para operação segura e rastreável.
            </div>
          </div>
        </section>

        <section className="rounded-[10px] border border-[#dfe5ef] bg-white p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#0f172a]">Cadastro inicial</h2>
            <p className="mt-1 text-sm text-[#64748b]">Preencha os dados para criar sua organização.</p>
          </div>

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
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ex: Rodrigo Silva"
                  className="h-11 w-full rounded-[10px] border border-[#d9e1ed] bg-white px-10 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="organization_name">
                Organização
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="organization_name"
                  type="text"
                  autoComplete="organization"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Ex: Cais Hub"
                  className="h-11 w-full rounded-[10px] border border-[#d9e1ed] bg-white px-10 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="email">
                E-mail corporativo
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={corporateEmail}
                  onChange={(event) => setCorporateEmail(event.target.value)}
                  placeholder="nome@empresa.com"
                  className="h-11 w-full rounded-[10px] border border-[#d9e1ed] bg-white px-10 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
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
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  className="h-11 w-full rounded-[10px] border border-[#d9e1ed] bg-white px-10 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#febb28] text-sm font-semibold text-[#3f2b00] transition-colors hover:bg-[#f5b20e] disabled:opacity-60"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {errorMessage ? (
            <p className="mt-4 rounded-[10px] border border-[#ffdad6] bg-[#fff1ef] px-4 py-3 text-sm text-[#93000a]">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-between border-t border-[#e4e9f2] pt-4">
            <p className="text-sm text-[#475569]">Já possui conta?</p>
            <Link href="/login" className="text-sm font-semibold text-brand hover:underline">
              Fazer login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
