'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilterPills } from '@/components/ui/filter-pills';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type { ProjectReportsResponse } from '@/types/domain';

const PERIOD_OPTIONS = [7, 30, 90] as const;

const priorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('pt-BR');
};

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR');
};

export default function ProjectReportsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  const session = useAppSession();

  const [report, setReport] = useState<ProjectReportsResponse | null>(null);
  const [selectedDays, setSelectedDays] = useState<30 | 7 | 90>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useConfigureAppShell({
    title: 'Relatórios',
    project: { id: projectId ?? '', name: report?.project.name ?? 'Projeto', color: report?.project.color }
  });

  const loadReport = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

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

  const periodMaxMeetings = useMemo(() => {
    if (!report?.periodSummary.length) {
      return 1;
    }

    return Math.max(1, ...report.periodSummary.map((entry) => entry.meetings));
  }, [report?.periodSummary]);

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Relatórios"
          description="Visão consolidada de reuniões, decisões, tópicos recorrentes, tarefas e pendências do projeto."
          actions={
            <div className="flex flex-wrap gap-2">
              <FilterPills
                value={selectedDays}
                onChange={(value) => setSelectedDays(value as 7 | 30 | 90)}
                items={PERIOD_OPTIONS.map((days) => ({ id: days, label: `${days} dias` }))}
              />
              <Button variant="subtle" onClick={() => void loadReport()} disabled={isLoading}>
                Atualizar
              </Button>
            </div>
          }
        />

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Resumo do período</CardTitle>
            <CardDescription>{report?.project.name ?? 'Projeto'}</CardDescription>
          </CardHeader>
          {report ? (
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="info">
                Período: {formatDate(report.period.from)} a {formatDate(report.period.to)}
              </Badge>
              <Badge variant="default">{report.period.meetingsInPeriod} reuniões no período</Badge>
              <Badge variant="warning">{report.overview.openTasksFromMeetings} tarefas abertas de reuniões</Badge>
            </CardContent>
          ) : null}
        </Card>

        {isLoading ? <p className="text-sm text-[#567188]">Consolidando dados do projeto...</p> : null}

        {!isLoading && !report ? (
          <div className="rounded-xl border border-dashed border-[#0A4C78]/20 bg-[#F8FBFF] px-4 py-4 text-sm text-[#567188]">
            <p className="font-semibold text-[#35536B]">Ainda não há dados suficientes.</p>
            <p className="mt-1">Processe reuniões para gerar relatórios executivos.</p>
          </div>
        ) : null}

        {report ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Card className="surface-card">
                <CardHeader>
                  <CardDescription>Total de reuniões</CardDescription>
                  <CardTitle className="text-3xl text-[#0A4C78]">{report.overview.totalMeetings}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="surface-card">
                <CardHeader>
                  <CardDescription>Reuniões no período</CardDescription>
                  <CardTitle className="text-3xl text-[#0A4C78]">{report.overview.meetingsInPeriod}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="surface-card">
                <CardHeader>
                  <CardDescription>Decisões recentes</CardDescription>
                  <CardTitle className="text-3xl text-[#0A4C78]">{report.overview.decisionsInPeriod}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="surface-card">
                <CardHeader>
                  <CardDescription>Tópicos citados</CardDescription>
                  <CardTitle className="text-3xl text-[#0A4C78]">{report.overview.topicsMentionsInPeriod}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="surface-card">
                <CardHeader>
                  <CardDescription>Pendências citadas</CardDescription>
                  <CardTitle className="text-3xl text-[#0A4C78]">
                    {report.overview.pendingMentionsInPeriod}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="surface-card">
                <CardHeader>
                  <CardDescription>Tarefas abertas de reuniões</CardDescription>
                  <CardTitle className="text-3xl text-[#0A4C78]">{report.overview.openTasksFromMeetings}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="surface-card">
                <CardHeader>
                  <CardTitle className="text-xl text-[#0A4C78]">Principais Tópicos Recorrentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.recurringTopics.length === 0 ? (
                    <p className="text-sm text-[#567188]">Sem tópicos recorrentes no período selecionado.</p>
                  ) : (
                    report.recurringTopics.map((topic) => (
                      <div key={topic.topic} className="surface-soft px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[#0A4C78]">{topic.topic}</p>
                          <Badge variant="info">{topic.count}x</Badge>
                        </div>
                        <p className="mt-1 text-xs text-[#567188]">Última menção: {formatDateTime(topic.lastSeenAt)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="surface-card">
                <CardHeader>
                  <CardTitle className="text-xl text-[#0A4C78]">Pendências Mais Citadas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.pendingHighlights.length === 0 ? (
                    <p className="text-sm text-[#567188]">Sem pendências registradas no período selecionado.</p>
                  ) : (
                    report.pendingHighlights.map((item) => (
                      <div key={item.item} className="surface-soft px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[#0A4C78]">{item.item}</p>
                          <Badge variant="warning">{item.count}x</Badge>
                        </div>
                        <p className="mt-1 text-xs text-[#567188]">Última menção: {formatDateTime(item.lastSeenAt)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="text-xl text-[#0A4C78]">Decisões Recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.recentDecisions.length === 0 ? (
                  <p className="text-sm text-[#567188]">Nenhuma decisão consolidada neste período.</p>
                ) : (
                  report.recentDecisions.map((decision, index) => (
                    <div
                      key={`${decision.meetingId}-${index}`}
                      className="surface-soft px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-[#0A4C78]">{decision.decision}</p>
                      <p className="mt-1 text-xs text-[#567188]">
                        {decision.meetingTitle} - {formatDateTime(decision.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-xl text-[#0A4C78]">Tarefas Abertas Vindas de Reuniões</CardTitle>
                <Button asChild variant="subtle">
                  <Link href={`/projects/${projectId}/board`}>Abrir quadro</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.openTasksFromMeetings.length === 0 ? (
                  <p className="text-sm text-[#567188]">Sem tarefas abertas derivadas de reuniões.</p>
                ) : (
                  report.openTasksFromMeetings.map((task) => (
                    <div key={task.cardId} className="surface-soft px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#0A4C78]">{task.title}</p>
                          {task.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-[#35536B]">{task.description}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="info">{task.columnTitle}</Badge>
                          {task.priority ? <Badge variant="default">{priorityLabel[task.priority]}</Badge> : null}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[#567188]">
                        Reunião: {task.meeting.title} {task.dueDate ? `• Prazo: ${formatDateTime(task.dueDate)}` : ''}
                      </p>
                      {task.assignees.length > 0 ? (
                        <p className="mt-1 text-xs text-[#567188]">
                          Responsáveis: {task.assignees.map((assignee) => assignee.name).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="text-xl text-[#0A4C78]">Visão Resumida por Período</CardTitle>
                <CardDescription className="text-[#45607A]">
                  Distribuição de reuniões e itens estratégicos ao longo do período selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.periodSummary.length === 0 ? (
                  <p className="text-sm text-[#567188]">Sem dados para o período selecionado.</p>
                ) : (
                  report.periodSummary.map((item) => (
                    <div key={`${item.start}-${item.end}`} className="surface-soft p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[#0A4C78]">{item.label}</p>
                        <p className="text-xs text-[#567188]">
                          {item.meetings} reuniões • {item.decisions} decisões • {item.actionItems} tarefas • {item.pendingItems}{' '}
                          pendências
                        </p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#0A4C78]/10">
                        <div
                          className="h-2 rounded-full bg-[linear-gradient(90deg,#1565C0,#0A5672)]"
                          style={{
                            width: `${Math.max(6, Math.round((item.meetings / periodMaxMeetings) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </>
  );
}
