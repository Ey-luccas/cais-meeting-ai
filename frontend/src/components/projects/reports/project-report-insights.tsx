'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import { AppTabs } from '@/components/ui/app-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectReportsResponse } from '@/types/domain';

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

type InsightTabId = 'decisions' | 'pending' | 'tasks' | 'topics';

const priorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

type ProjectReportInsightsProps = {
  projectId: string;
  report: ProjectReportsResponse;
};

export const ProjectReportInsights = ({ projectId, report }: ProjectReportInsightsProps) => {
  const tabs = useMemo(
    () =>
      [
        { id: 'decisions' as const, label: 'Decisões', count: report.recentDecisions.length },
        { id: 'pending' as const, label: 'Pendências', count: report.pendingHighlights.length },
        { id: 'tasks' as const, label: 'Tarefas', count: report.openTasksFromMeetings.length },
        { id: 'topics' as const, label: 'Tópicos', count: report.recurringTopics.length }
      ].filter((tab) => tab.count > 0),
    [report.openTasksFromMeetings.length, report.pendingHighlights.length, report.recentDecisions.length, report.recurringTopics.length]
  );

  const [activeTab, setActiveTab] = useState<InsightTabId | null>(tabs[0]?.id ?? null);

  useEffect(() => {
    if (!tabs.length) {
      setActiveTab(null);
      return;
    }

    if (!activeTab || !tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  if (tabs.length === 0) {
    return (
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-xl text-[#0A4C78]">Principais achados</CardTitle>
          <CardDescription className="text-[#45607A]">
            Ainda não há informações suficientes para gerar achados neste período.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const decisions = report.recentDecisions;
  const pendingHighlights = report.pendingHighlights;
  const openTasks = report.openTasksFromMeetings;
  const recurringTopics = report.recurringTopics;
  const hasTasks = openTasks.length > 0;

  return (
    <Card className="surface-card">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-xl text-[#0A4C78]">Principais achados</CardTitle>
            <CardDescription className="text-[#45607A]">
              Decisões, pendências, tarefas e tópicos organizados de forma executiva.
            </CardDescription>
          </div>

          {hasTasks ? (
            <Button asChild variant="subtle" size="sm" className="gap-2">
              <Link href={`/projects/${projectId}/board`}>
                <ExternalLink className="h-4 w-4" />
                Abrir quadro
              </Link>
            </Button>
          ) : null}
        </div>

        {tabs.length > 1 ? <AppTabs value={activeTab ?? tabs[0].id} onChange={(value) => setActiveTab(value as InsightTabId)} items={tabs.map((tab) => ({ id: tab.id, label: tab.label }))} /> : <Badge variant="info">{tabs[0].label}</Badge>}
      </CardHeader>

      <CardContent>
        {activeTab === 'decisions' ? (
          <div className="space-y-2">
            {decisions.map((decision, index) => (
              <div key={`${decision.meetingId}-${index}`} className={cn('rounded-2xl border border-[#e4e9f2] bg-white px-4 py-3')}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">Reunião</Badge>
                      <p className="text-sm font-semibold text-[#111827]">{decision.meetingTitle}</p>
                    </div>
                    <p className="mt-2 text-sm text-[#35536B]">{decision.decision}</p>
                    <p className="mt-2 text-xs text-app-muted">{formatDateTime(decision.createdAt)}</p>
                  </div>

                  <Button asChild variant="subtle" size="sm" className="shrink-0">
                    <Link href={`/projects/${projectId}/meetings/${decision.meetingId}?highlight=meeting-decisions`}>
                      Abrir origem
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'pending' ? (
          <div className="space-y-2">
            {pendingHighlights.map((item) => (
              <div key={item.item} className="rounded-2xl border border-[#e4e9f2] bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827]">{item.item}</p>
                    <p className="mt-1 text-xs text-app-muted">Última menção: {formatDateTime(item.lastSeenAt)}</p>
                  </div>
                  <Badge variant="warning">{item.count}x</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'tasks' ? (
          <div className="space-y-2">
            {openTasks.map((task) => (
              <div key={task.cardId} className="rounded-2xl border border-[#e4e9f2] bg-white px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{task.columnTitle}</Badge>
                      {task.priority ? <Badge variant="warning">{priorityLabel[task.priority]}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#111827]">{task.title}</p>
                    {task.description ? <p className="mt-2 text-sm text-[#35536B]">{task.description}</p> : null}
                    <p className="mt-2 text-xs text-app-muted">Reunião: {task.meeting.title}</p>
                    {task.dueDate ? <p className="mt-1 text-xs text-app-muted">Prazo: {formatDateTime(task.dueDate)}</p> : null}
                    {task.assignees.length > 0 ? (
                      <p className="mt-1 text-xs text-app-muted">Responsáveis: {task.assignees.map((assignee) => assignee.name).join(', ')}</p>
                    ) : null}
                  </div>

                  <Button asChild variant="subtle" size="sm" className="shrink-0">
                    <Link href={`/projects/${projectId}/board?highlight=${task.cardId}`}>Abrir origem</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'topics' ? (
          <div className="space-y-2">
            {recurringTopics.map((topic) => (
              <div key={topic.topic} className="rounded-2xl border border-[#e4e9f2] bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827]">{topic.topic}</p>
                    <p className="mt-1 text-xs text-app-muted">Última menção: {formatDateTime(topic.lastSeenAt)}</p>
                  </div>
                  <Badge variant="info">{topic.count}x</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
