'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { FilterPills } from '@/components/ui/filter-pills';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type { ProjectReportsResponse } from '@/types/domain';
import { ProjectReportInsights } from '@/components/projects/reports/project-report-insights';
import { ProjectReportSummaryCard } from '@/components/projects/reports/project-report-summary-card';
import { ProjectReportTimeline } from '@/components/projects/reports/project-report-timeline';
import { ReportEmptyState } from '@/components/projects/reports/report-empty-state';

const PERIOD_OPTIONS = [7, 30, 90] as const;

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR');
};

const formatPeriodRange = (from: string, to: string): string => `${formatDate(from)} a ${formatDate(to)}`;

export default function ProjectReportsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  const session = useAppSession();

  const [report, setReport] = useState<ProjectReportsResponse | null>(null);
  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useConfigureAppShell({
    title: 'Relatórios',
    project: projectId ? { id: projectId, name: report?.project.name ?? 'Projeto', color: report?.project.color } : undefined
  });

  const loadReport = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setReport(null);

    try {
      const payload = await api.getProjectReports(session.token, projectId, selectedDays);
      setReport(payload);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar os relatórios do projeto.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedDays, session?.token]);

  useEffect(() => {
    if (projectId) {
      void loadReport();
    }
  }, [loadReport, projectId]);

  const hasMeaningfulData = useMemo(() => {
    if (!report) {
      return false;
    }

    return (
      report.overview.totalMeetings > 0 ||
      report.overview.meetingsInPeriod > 0 ||
      report.overview.decisionsInPeriod > 0 ||
      report.overview.topicsMentionsInPeriod > 0 ||
      report.overview.pendingMentionsInPeriod > 0 ||
      report.overview.openTasksFromMeetings > 0 ||
      report.recurringTopics.length > 0 ||
      report.recentDecisions.length > 0 ||
      report.openTasksFromMeetings.length > 0 ||
      report.pendingHighlights.length > 0 ||
      report.periodSummary.some(
        (item) => item.meetings > 0 || item.decisions > 0 || item.topics > 0 || item.actionItems > 0 || item.pendingItems > 0
      )
    );
  }, [report]);

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          className="sm:items-start"
          title="Relatórios"
          description="Acompanhe reuniões, decisões, pendências e evolução do projeto."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <FilterPills
                value={selectedDays}
                onChange={(value) => setSelectedDays(value as 7 | 30 | 90)}
                items={PERIOD_OPTIONS.map((days) => ({ id: days, label: `${days} dias` }))}
              />
              <Button
                variant="ghost"
                onClick={() => void loadReport()}
                disabled={isLoading}
                className="h-auto gap-2 rounded-none bg-transparent px-0 py-0 text-[#005eb8] hover:bg-transparent hover:text-[#004b93]"
              >
                <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Atualizar
              </Button>
            </div>
          }
        />

        {isLoading && !report ? (
          <div className="rounded-2xl border border-[#dfe5ef] bg-white px-4 py-3 text-sm text-[#64748b]">
            Carregando relatórios...
          </div>
        ) : null}

        {report ? (
          <>
            <ProjectReportSummaryCard
              projectName={report.project.name}
              periodLabel={`${selectedDays} dias`}
              periodRangeLabel={formatPeriodRange(report.period.from, report.period.to)}
              totalMeetings={report.overview.totalMeetings}
              meetingsInPeriod={report.overview.meetingsInPeriod}
              decisions={report.overview.decisionsInPeriod}
              openTasks={report.overview.openTasksFromMeetings}
              pendingItems={report.overview.pendingMentionsInPeriod}
            />

            {hasMeaningfulData ? (
              <>
                <ProjectReportInsights projectId={projectId ?? ''} report={report} />
                <ProjectReportTimeline periodSummary={report.periodSummary} />
              </>
            ) : (
              <ReportEmptyState projectId={projectId ?? ''} />
            )}
          </>
        ) : null}

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
        ) : null}
      </div>
    </>
  );
}
