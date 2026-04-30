'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { getStoredSession, saveSession } from '@/lib/session';

type AuthScreenProps = {
  mode: 'login' | 'register';
};

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

export const AuthScreen = ({ mode }: AuthScreenProps) => {
  const router = useRouter();
  const isRegister = mode === 'register';

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationEmail, setOrganizationEmail] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const canSubmitRegister = useMemo(
    () =>
      userName.trim().length >= 2 &&
      userEmail.trim().length > 0 &&
      userPassword.length >= 8 &&
      organizationName.trim().length >= 2 &&
      organizationEmail.trim().length > 0,
    [organizationEmail, organizationName, userEmail, userName, userPassword]
  );

  useEffect(() => {
    const session = getStoredSession();

    if (session?.token) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmitRegister) {
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
        organizationEmail: organizationEmail.trim(),
        ownerName: userName.trim(),
        ownerEmail: userEmail.trim(),
        ownerPassword: userPassword
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

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const session = await api.login({
        email: loginEmail.trim(),
        password: loginPassword
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
    <div className="grid min-h-screen lg:grid-cols-[1.06fr_0.94fr]">
      <section className="relative hidden overflow-hidden bg-[linear-gradient(122deg,#08355E_0%,#1565C0_56%,#0A5672_100%)] p-12 text-white lg:block">
        <div className="pointer-events-none absolute inset-0 bg-hero-grid bg-[size:30px_30px] opacity-30" />
        <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-[#F2B11B]/22 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex h-full max-w-xl flex-col justify-between">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/24 bg-white px-4 py-2">
              <Image
                src="/caishub-svg-fonte-preta.svg"
                alt="Logo Cais"
                width={28}
                height={28}
                className="h-7 w-7 rounded-md"
                priority
              />
              <span className="text-sm font-bold text-brand">Cais Teams</span>
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight">
              Gestão de reuniões e projetos com inteligência operacional
            </h1>
            <p className="max-w-lg text-base text-white/80">
              Um ambiente institucional para organizar equipe, decisões, tarefas e execução em alto nível.
            </p>
          </div>

          <div className="rounded-2xl border border-white/22 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-sm text-white/85">
              Segurança de acesso por organização, permissões por papel e rastreabilidade completa do fluxo.
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[linear-gradient(165deg,#F8F7F4_0%,#EFF4FA_60%,#ECF2F8_100%)] px-6 py-12">
        <Card className="relative w-full max-w-xl overflow-hidden text-[#0B2239] shadow-[0_28px_65px_-44px_rgba(10,40,78,0.6)]">
          <div className="h-1 w-full bg-[linear-gradient(90deg,#0A4C78_0%,#1565C0_72%,#F2B11B_100%)]" />

          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">
              {isRegister ? 'Criar organização' : 'Entrar na organização'}
            </CardTitle>
            <CardDescription className="text-[#31506A]">
              {isRegister
                ? 'Abra o espaço institucional da sua empresa em poucos passos.'
                : 'Acesse seu ambiente colaborativo com segurança.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isRegister ? (
              <form className="space-y-4" onSubmit={handleRegister}>
                <Input
                  placeholder="Nome do usuário"
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  autoComplete="name"
                  required
                />
                <Input
                  placeholder="E-mail"
                  type="email"
                  value={userEmail}
                  onChange={(event) => setUserEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <Input
                  placeholder="Senha"
                  type="password"
                  minLength={8}
                  value={userPassword}
                  onChange={(event) => setUserPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <Input
                  placeholder="Nome da organização"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  autoComplete="organization"
                  required
                />
                <Input
                  placeholder="E-mail da organização"
                  type="email"
                  value={organizationEmail}
                  onChange={(event) => setOrganizationEmail(event.target.value)}
                  autoComplete="email"
                  required
                />

                <Button type="submit" className="w-full" disabled={loading || !canSubmitRegister}>
                  {loading ? 'Criando organização...' : 'Criar organização'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleLogin}>
                <Input
                  placeholder="E-mail"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <Input
                  placeholder="Senha"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Autenticando...' : 'Entrar'}
                </Button>
              </form>
            )}

            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2 text-sm text-[#4C6A82]">
              {isRegister ? (
                <>
                  <span>Já possui acesso?</span>
                  <Link href="/login" className="font-semibold text-[#0A4C78] hover:underline">
                    Fazer login
                  </Link>
                </>
              ) : (
                <>
                  <span>Não tem organização cadastrada?</span>
                  <Link href="/register" className="font-semibold text-[#0A4C78] hover:underline">
                    Criar conta
                  </Link>
                </>
              )}
            </div>

            <p className="text-xs text-[#4C6A82]">
              Ao continuar, você concorda com o modelo colaborativo de gestão do Cais Teams.
              <Link href="/" className="ml-1 font-semibold text-[#0A4C78] hover:underline">
                Ver visão do produto
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
