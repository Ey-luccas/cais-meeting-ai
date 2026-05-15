'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';

import { ApiError, api } from '@/lib/api';

const GENERIC_SUCCESS_MESSAGE = 'Se o e-mail existir, enviaremos instruções para redefinir a senha.';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.trim().length > 0 && !loading, [email, loading]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await api.forgotPassword({
        email: email.trim()
      });

      setMessage(response.message || GENERIC_SUCCESS_MESSAGE);
      setEmail('');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível processar sua solicitação.');
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
          <h1 className="text-3xl font-bold text-[#0f172a]">Recuperar senha</h1>
          <p className="mt-3 text-sm text-[#475569]">
            Informe seu e-mail para receber o link temporário de redefinição de senha.
          </p>

          <div className="mt-6 rounded-xl border border-[#e4e9f2] bg-[#f8faff] px-4 py-3 text-sm text-[#334155]">
            Por segurança, mostramos a mesma resposta mesmo quando o e-mail não está cadastrado.
          </div>
        </section>

        <section className="rounded-xl border border-[#dfe5ef] bg-white p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#0f172a]">Esqueci minha senha</h2>
            <p className="mt-1 text-sm text-[#64748b]">Você receberá instruções por e-mail.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]" htmlFor="email">
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
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
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {message ? (
            <p className="mt-4 rounded-xl border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75]">
              {message}
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
