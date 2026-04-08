import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/site-header';

type MainLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
};

export const MainLayout = ({
  title,
  description,
  children,
  actions,
  eyebrow = 'Plataforma CAIS Meeting AI'
}: MainLayoutProps): JSX.Element => {
  return (
    <div className="relative min-h-screen overflow-hidden text-[#F8F7F4]">
      <div className="pointer-events-none absolute inset-0 bg-hero-grid bg-[length:44px_44px] opacity-18" />
      <div className="pointer-events-none absolute -left-36 top-20 h-72 w-72 rounded-full bg-[#F2B11B]/16 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-[#0A5672]/40 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 md:px-10 md:py-10 lg:gap-10">
        <SiteHeader />

        <section className="cais-glass space-y-4 p-5 md:p-8">
          <p className="cais-section-title">{eyebrow}</p>
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <h1 className="max-w-4xl font-display text-3xl leading-tight tracking-tight md:text-5xl">{title}</h1>
              <p className="max-w-3xl text-sm leading-relaxed text-[#F8F7F4]/82 md:text-base">{description}</p>
            </div>

            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        </section>

        <section className="space-y-6">{children}</section>
      </main>
    </div>
  );
};
