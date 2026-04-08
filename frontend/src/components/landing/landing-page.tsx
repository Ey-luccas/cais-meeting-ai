import Link from 'next/link';
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Database, FileAudio2, Layers3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const chips = ['Transcrição automática', 'Resumo inteligente', 'Decisões e tarefas', 'Histórico consultável'] as const;

const howItWorks = [
  {
    step: '01',
    title: 'Capture a reunião',
    text: 'Grave no navegador ou faça upload do áudio já consolidado.'
  },
  {
    step: '02',
    title: 'Transcreva com Groq',
    text: 'A plataforma converte fala em texto com alta velocidade operacional.'
  },
  {
    step: '03',
    title: 'Organize com DeepSeek',
    text: 'A IA estrutura resumo, tópicos, decisões, tarefas e pendências.'
  },
  {
    step: '04',
    title: 'Consulte e evolua',
    text: 'Todo histórico fica acessível para gestão e acompanhamento contínuo.'
  }
] as const;

const deliverables = [
  {
    title: 'Transcrição completa',
    text: 'Registro integral da conversa para governança e auditoria.',
    icon: FileAudio2
  },
  {
    title: 'Notas executivas',
    text: 'Resumo objetivo com foco em contexto profissional e acionável.',
    icon: BrainCircuit
  },
  {
    title: 'Decisões e tarefas',
    text: 'Consolidação de encaminhamentos com clareza de responsabilidade.',
    icon: CheckCircle2
  },
  {
    title: 'Base institucional',
    text: 'Memória operacional persistida para consulta e aprendizado contínuo.',
    icon: Database
  }
] as const;

const results = [
  { value: 'Menos retrabalho', text: 'Padroniza o pós-reunião e reduz perda de informação.' },
  { value: 'Mais velocidade', text: 'Acelera síntese e acompanhamento de decisões.' },
  { value: 'Mais visibilidade', text: 'Cria uma trilha clara do que foi discutido e definido.' }
] as const;

export const LandingPage = (): JSX.Element => {
  return (
    <div className="relative min-h-screen overflow-hidden text-[#F8F7F4]">
      <div className="pointer-events-none absolute inset-0 bg-hero-grid bg-[length:44px_44px] opacity-22" />
      <div className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-[#F2B11B]/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-6 right-0 h-80 w-80 rounded-full bg-[#0A5672]/40 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-5 py-8 md:px-10 md:py-10 lg:gap-24">
        <header className="cais-glass px-5 py-4 md:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="font-display text-lg tracking-tight text-white">CAIS Meeting AI</p>

            <nav className="flex flex-wrap gap-2 text-sm text-white/82">
              <a
                href="#como-funciona"
                className="rounded-full px-3 py-1.5 tracking-[0.06em] uppercase transition hover:bg-white/10 hover:text-white"
              >
                Como funciona
              </a>
              <a
                href="#recursos"
                className="rounded-full px-3 py-1.5 tracking-[0.06em] uppercase transition hover:bg-white/10 hover:text-white"
              >
                Recursos
              </a>
              <a
                href="#resultados"
                className="rounded-full px-3 py-1.5 tracking-[0.06em] uppercase transition hover:bg-white/10 hover:text-white"
              >
                Resultados
              </a>
              <a
                href="#contato"
                className="rounded-full px-3 py-1.5 tracking-[0.06em] uppercase transition hover:bg-white/10 hover:text-white"
              >
                Contato
              </a>
            </nav>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-7">
            <p className="cais-section-title">PLATAFORMA DE REUNIÕES COM IA</p>
            <h1 className="max-w-3xl font-display text-4xl leading-tight tracking-tight md:text-6xl lg:text-[4rem]">
              Transforme reuniões em decisões, notas e memória operacional
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/84 md:text-lg">
              Grave, envie, transcreva e organize automaticamente suas reuniões com IA em uma
              experiência simples, moderna e profissional.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard" className="gap-2">
                  Conhecer a plataforma
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/dashboard">Ver demonstração</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[rgba(255,255,255,0.24)] bg-white/12 px-4 py-2 text-xs font-semibold tracking-[0.06em] text-white/88 uppercase"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="relative isolate mx-auto w-full max-w-[500px]">
            <div className="cais-glass aspect-[1.05] rounded-[2rem] p-5">
              <div className="relative h-full w-full overflow-hidden rounded-[1.5rem] border border-[rgba(255,255,255,0.2)] bg-[radial-gradient(circle_at_20%_20%,rgba(242,177,27,0.24),transparent_35%),radial-gradient(circle_at_84%_18%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(140deg,rgba(10,76,120,0.94),rgba(10,86,114,0.84))]">
                <div className="absolute left-8 top-9 h-24 w-24 rounded-full border border-[#F2B11B]/50 bg-[#F2B11B]/22" />
                <div className="absolute right-8 top-20 h-28 w-28 rounded-full border border-white/26 bg-white/10" />
                <div className="absolute bottom-10 left-14 h-16 w-40 rounded-full border border-white/22 bg-white/10" />
                <div className="absolute bottom-24 right-12 h-20 w-20 rounded-2xl border border-white/22 bg-[#F2B11B]/20" />
                <div className="absolute left-10 top-1/2 h-px w-24 bg-white/36" />
                <div className="absolute right-14 top-[54%] h-px w-20 bg-white/36" />
                <div className="absolute bottom-16 left-1/2 h-16 w-px -translate-x-1/2 bg-white/30" />
                <div className="absolute inset-x-8 bottom-7 rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
                  <p className="text-xs tracking-[0.12em] text-white/70 uppercase">Pipeline operacional</p>
                  <p className="mt-1 text-sm text-white">Upload → Groq STT → DeepSeek Insights → Base institucional</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="space-y-6">
          <div className="space-y-2">
            <p className="cais-section-title">Como funciona</p>
            <h2 className="font-display text-3xl md:text-4xl">Do áudio à ação em um fluxo contínuo</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {howItWorks.map((item) => (
              <Card key={item.step} className="border-white/20 bg-white/10 text-white shadow-panel backdrop-blur-sm">
                <CardContent className="space-y-3 p-5">
                  <span className="inline-flex rounded-full bg-[#F2B11B] px-3 py-1 text-[11px] font-semibold tracking-[0.1em] text-[#0A4C78] uppercase">
                    {item.step}
                  </span>
                  <h3 className="font-display text-xl leading-tight">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-white/80">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="recursos" className="space-y-6">
          <div className="space-y-2">
            <p className="cais-section-title">O que a plataforma entrega</p>
            <h2 className="font-display text-3xl md:text-4xl">Inteligência prática para rotina de reuniões</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {deliverables.map((feature) => {
              const Icon = feature.icon;

              return (
                <Card key={feature.title} className="border-white/20 bg-white/10 text-white shadow-panel backdrop-blur-sm">
                  <CardContent className="space-y-3 p-5">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F2B11B] text-[#0A4C78]">
                      <Icon size={18} />
                    </div>
                    <h3 className="font-display text-xl">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-[#F8F7F4]/80">{feature.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="resultados" className="space-y-6">
          <div className="space-y-2">
            <p className="cais-section-title">Resultados esperados</p>
            <h2 className="font-display text-3xl md:text-4xl">Mais clareza para decidir e executar</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {results.map((result) => (
              <Card key={result.value} className="border-white/20 bg-white/10 text-white shadow-panel backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2 text-2xl">
                    <Layers3 size={20} />
                    {result.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm leading-relaxed text-white/80">{result.text}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <footer
          id="contato"
          className="cais-glass flex flex-col gap-3 px-5 py-6 text-sm text-white/76 md:flex-row md:items-center md:justify-between"
        >
          <p className="font-display text-base text-white">CAIS Meeting AI</p>
          <p>Contato: contato@caismeeting.ai</p>
          <p className="inline-flex items-center gap-1">
            <BarChart3 size={14} />
            Plataforma de reuniões com IA para operação e gestão
          </p>
        </footer>
      </main>
    </div>
  );
};
