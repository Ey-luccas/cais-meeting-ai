import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="surface-card w-full max-w-lg space-y-4 p-8 text-center text-[#12344F]">
        <p className="section-overline">Erro 404</p>
        <h1 className="text-4xl font-bold text-[#0A4C78]">Página não encontrada</h1>
        <p className="text-sm text-[#4B677F]">O conteúdo solicitado não existe ou foi movido na plataforma.</p>
        <Button asChild>
          <Link href="/dashboard">Ir para Painel</Link>
        </Button>
      </div>
    </div>
  );
}
