import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectReportsResponse } from '@/types/domain';

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR');
};

type ProjectReportTimelineProps = {
  periodSummary: ProjectReportsResponse['periodSummary'];
};

export const ProjectReportTimeline = ({ periodSummary }: ProjectReportTimelineProps) => {
  const hasActivity = periodSummary.some(
    (item) => item.meetings > 0 || item.decisions > 0 || item.actionItems > 0 || item.pendingItems > 0
  );

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="text-xl text-[#0A4C78]">Linha do tempo do período</CardTitle>
        <CardDescription className="text-[#45607A]">
          Distribuição compacta de reuniões, decisões, tarefas e pendências.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {hasActivity ? (
          periodSummary.map((item) => (
            <div key={`${item.start}-${item.end}`} className="rounded-2xl border border-[#e4e9f2] bg-white px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">{item.label}</p>
                  <p className="mt-1 text-xs text-app-muted">
                    {formatDate(item.start)} a {formatDate(item.end)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="info">{item.meetings} reuniões</Badge>
                  <Badge variant="default">{item.decisions} decisões</Badge>
                  <Badge variant="warning">{item.actionItems} tarefas</Badge>
                  <Badge variant="success">{item.pendingItems} pendências</Badge>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-[#dfe5ef] bg-[#f8faff] px-4 py-5 text-sm text-[#64748b]">
            Nenhuma atividade registrada no período selecionado.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
