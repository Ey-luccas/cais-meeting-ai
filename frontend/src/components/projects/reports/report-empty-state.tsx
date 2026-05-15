import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

type ReportEmptyStateProps = {
  projectId: string;
};

export const ReportEmptyState = ({ projectId }: ReportEmptyStateProps) => (
  <EmptyState
    icon={FileText}
    title="Ainda não há dados para gerar relatórios"
    description="Cadastre ou processe reuniões para visualizar decisões, tarefas, pendências e tópicos recorrentes."
    action={
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href={`/projects/${projectId}/meetings/new`}>
            <Plus className="h-4 w-4" />
            Criar reunião
          </Link>
        </Button>
        <Button asChild variant="subtle">
          <Link href={`/projects/${projectId}/meetings`}>Ver reuniões</Link>
        </Button>
      </div>
    }
  />
);
