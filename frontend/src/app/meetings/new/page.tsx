import Link from 'next/link';

import { MainLayout } from '@/components/layout/main-layout';
import { InformativeBlock } from '@/components/meetings/informative-block';
import { NewMeetingForm } from '@/components/meetings/new-meeting-form';
import { Button } from '@/components/ui/button';

export default function NewMeetingPage(): JSX.Element {
  return (
    <MainLayout
      title="Nova Reunião"
      description="Cadastre a reunião, envie o áudio e dispare o processamento de IA para gerar notas executivas estruturadas."
      actions={
        <Button variant="secondary" asChild>
          <Link href="/meetings">Voltar para listagem</Link>
        </Button>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <NewMeetingForm />

        <div className="space-y-4">
          <InformativeBlock
            title="Fluxo recomendado"
            text="Crie a reunião com metadados mínimos, envie o áudio e deixe o pipeline Groq + DeepSeek processar automaticamente."
          />
          <InformativeBlock
            title="MVP com uploads locais"
            text="O áudio é armazenado localmente no backend. A interface já está preparada para futura evolução para storage externo."
          />
          <InformativeBlock
            title="Governança"
            text="Cada reunião mantém histórico de status para rastrear pendências, erros e progresso do processamento."
          />
        </div>
      </section>
    </MainLayout>
  );
}
