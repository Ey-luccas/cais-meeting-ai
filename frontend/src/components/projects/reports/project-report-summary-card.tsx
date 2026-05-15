import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ProjectReportSummaryCardProps = {
  projectName: string;
  periodLabel: string;
  periodRangeLabel: string;
  totalMeetings: number;
  meetingsInPeriod: number;
  decisions: number;
  openTasks: number;
  pendingItems: number;
};

const metricItems = [
  { key: 'totalMeetings', label: 'Total de reuniões' },
  { key: 'meetingsInPeriod', label: 'Reuniões no período' },
  { key: 'decisions', label: 'Decisões identificadas' },
  { key: 'openTasks', label: 'Tarefas abertas' },
  { key: 'pendingItems', label: 'Pendências citadas' }
] as const;

export const ProjectReportSummaryCard = ({
  projectName,
  periodLabel,
  periodRangeLabel,
  totalMeetings,
  meetingsInPeriod,
  decisions,
  openTasks,
  pendingItems
}: ProjectReportSummaryCardProps) => {
  const metrics: Record<(typeof metricItems)[number]['key'], number> = {
    totalMeetings,
    meetingsInPeriod,
    decisions,
    openTasks,
    pendingItems
  };

  return (
    <Card className="surface-card">
      <CardHeader className="space-y-2 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Resumo do período</CardTitle>
            <CardDescription className="mt-1 truncate text-sm text-[#35536B]">{projectName}</CardDescription>
          </div>
          <Badge variant="info">{periodLabel}</Badge>
        </div>
        <p className="text-sm text-app-muted">{periodRangeLabel}</p>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metricItems.map((item) => (
            <div key={item.key} className="rounded-2xl border border-[#dfe5ef] bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold leading-none text-[#0A4C78]">
                {metrics[item.key]}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
