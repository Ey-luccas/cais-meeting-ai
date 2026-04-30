import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, FolderKanban, ShieldCheck, UsersRound } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cais Teams | Plataforma de equipes com IA'
};

const steps = [
  {
    title: 'Organize sua equipe',
    description: 'Crie sua organização, defina projetos e distribua papéis com governança.'
  },
  {
    title: 'Registre reuniões',
    description: 'Centralize gravações, decisões e observações em um fluxo contínuo.'
  },
  {
    title: 'Transforme em execução',
    description: 'Converta discussões em cards, responsáveis, prazos e prioridade.'
  },
  {
    title: 'Acompanhe com clareza',
    description: 'Consulte relatórios, pendências e histórico com Pesquisa IA Central.'
  }
];

const resources = [
  {
    icon: FolderKanban,
    title: 'Projetos, quadro e arquivos',
    description: 'Tudo em um fluxo único para operação diária, sem dispersão de contexto.'
  },
  {
    icon: UsersRound,
    title: 'Equipe com papéis definidos',
    description: 'Permissões por organização e projeto para manter segurança e responsabilidade.'
  },
  {
    icon: ShieldCheck,
    title: 'Pesquisa IA com escopo',
    description: 'Pesquise em toda a organização ou restrinja ao projeto atual quando necessário.'
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#111827]">
      <header className="sticky top-0 z-50 border-b border-[#dfe5ef] bg-[#faf9f6]/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-[1160px] items-center justify-between px-6 py-4 lg:px-8">
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

          <div className="hidden items-center gap-6 md:flex">
            <a href="#produto" className="text-sm font-medium text-[#334155] transition-colors hover:text-brand">
              Produto
            </a>
            <a href="#como-funciona" className="text-sm font-medium text-[#334155] transition-colors hover:text-brand">
              Como funciona
            </a>
            <a href="#seguranca" className="text-sm font-medium text-[#334155] transition-colors hover:text-brand">
              Segurança
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-[10px] px-4 text-sm font-semibold text-[#334155] hover:bg-white"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center rounded-[10px] bg-[#004d99] px-4 text-sm font-semibold text-white hover:bg-[#0a4c78]"
            >
              Começar agora
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="border-b border-[#e4e9f2] bg-[linear-gradient(180deg,#f7f9fd_0%,#faf9f6_100%)]">
          <div className="mx-auto grid w-full max-w-[1160px] gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-[10px] border border-[#d5deec] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a4c78]">
                Plataforma institucional com IA
              </span>
              <h1 className="max-w-[17ch] font-display text-4xl font-bold leading-tight text-[#0f172a] md:text-5xl">
                Transforme reuniões em decisões executáveis.
              </h1>
              <p className="max-w-[55ch] text-base text-[#475569] md:text-lg">
                O Cais Teams conecta reuniões, projetos, quadro e relatórios em um sistema único para equipes que
                precisam operar com contexto e previsibilidade.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#febb28] px-5 text-sm font-semibold text-[#3f2b00] hover:bg-[#f5b20e]"
                >
                  Começar gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex h-11 items-center rounded-[10px] border border-[#d5deec] bg-white px-5 text-sm font-semibold text-[#334155] hover:bg-[#f8faff]"
                >
                  Ver como funciona
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-[10px] border border-[#dfe5ef] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#64748b]">Pesquisa IA</p>
                <p className="mt-2 text-sm text-[#334155]">
                  Consulte decisões, tarefas e arquivos da organização ou de um projeto específico.
                </p>
              </article>
              <article className="rounded-[10px] border border-[#dfe5ef] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#64748b]">Fluxo contínuo</p>
                <p className="mt-2 text-sm text-[#334155]">
                  Da reunião ao board, mantenha responsáveis, prazos e andamento em um só lugar.
                </p>
              </article>
              <article className="rounded-[10px] border border-[#dfe5ef] bg-white p-5 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#64748b]">Operação do time</p>
                <p className="mt-2 text-sm text-[#334155]">
                  Painel, equipe, projetos e relatórios com linguagem única e foco em execução.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="produto" className="border-b border-[#e4e9f2] bg-[#faf9f6] py-14">
          <div className="mx-auto grid w-full max-w-[1160px] gap-4 px-6 md:grid-cols-3 lg:px-8">
            {resources.map((resource) => (
              <article key={resource.title} className="rounded-[10px] border border-[#dfe5ef] bg-white p-5">
                <resource.icon className="h-5 w-5 text-brand" />
                <h2 className="mt-3 text-lg font-semibold text-[#0f172a]">{resource.title}</h2>
                <p className="mt-2 text-sm text-[#475569]">{resource.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="border-b border-[#e4e9f2] bg-[#f7f9fd] py-14">
          <div className="mx-auto w-full max-w-[1160px] px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-[#0f172a]">Como funciona</h2>
            <p className="mt-3 max-w-[60ch] text-sm text-[#475569]">
              O Cais Teams foi desenhado para reduzir retrabalho e manter o time orientado por decisões reais.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {steps.map((step, index) => (
                <article key={step.title} className="rounded-[10px] border border-[#dfe5ef] bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Etapa {index + 1}</p>
                  <h3 className="mt-2 text-base font-semibold text-[#0f172a]">{step.title}</h3>
                  <p className="mt-2 text-sm text-[#475569]">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="seguranca" className="border-b border-[#e4e9f2] bg-[#faf9f6] py-14">
          <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-[#0f172a]">Segurança e governança</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[10px] border border-[#dfe5ef] bg-white p-4 text-sm text-[#334155]">
                Controle de acesso por organização e papel.
              </div>
              <div className="rounded-[10px] border border-[#dfe5ef] bg-white p-4 text-sm text-[#334155]">
                Escopo de dados por projeto para evitar vazamento de contexto.
              </div>
              <div className="rounded-[10px] border border-[#dfe5ef] bg-white p-4 text-sm text-[#334155]">
                Histórico de ações e decisões para rastreabilidade operacional.
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#004d99] py-14 text-white">
          <div className="mx-auto w-full max-w-[940px] px-6 text-center lg:px-8">
            <h2 className="text-3xl font-bold">Pronto para estruturar a operação da sua equipe?</h2>
            <p className="mx-auto mt-3 max-w-[62ch] text-sm text-white/90">
              Cadastre sua organização e comece a transformar discussões em entregas com o Cais Teams.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-[10px] bg-[#febb28] px-5 text-sm font-semibold text-[#3f2b00] hover:bg-[#f5b20e]"
              >
                Começar gratuitamente
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-[10px] border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Entrar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#f4f6fa]">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-6 py-10 text-sm text-[#475569] lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-3">
              <Image
                src="/caishub-svg-fonte-preta.svg"
                alt="Logo Cais Teams"
                width={32}
                height={32}
                className="h-8 w-8 rounded-[10px]"
              />
              <span className="font-semibold text-[#0f172a]">Cais Teams</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a href="#produto" className="hover:text-brand">
                Produto
              </a>
              <a href="#como-funciona" className="hover:text-brand">
                Como funciona
              </a>
              <a href="#seguranca" className="hover:text-brand">
                Segurança
              </a>
              <Link href="/login" className="hover:text-brand">
                Entrar
              </Link>
              <Link href="/register" className="hover:text-brand">
                Criar conta
              </Link>
            </div>
          </div>
          <div className="border-t border-[#dfe5ef] pt-4 text-xs">© 2026 Cais Teams. Todos os direitos reservados.</div>
        </div>
      </footer>

      <Link
        href="/register"
        aria-label="Começar agora"
        className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-[10px] bg-[#004d99] px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[#0a4c78] md:hidden"
      >
        Começar
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
