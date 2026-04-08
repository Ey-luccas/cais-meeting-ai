import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFoundPage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[linear-gradient(155deg,#0A4C78,#1565C0,#0A5672)] px-6 text-center text-white">
      <h1 className="font-display text-5xl">404</h1>
      <p className="max-w-md text-sm text-white/85">
        A reunião solicitada não foi encontrada neste ambiente.
      </p>
      <Button variant="secondary" asChild>
        <Link href="/dashboard">Voltar ao painel</Link>
      </Button>
    </main>
  );
}
