'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { SectionHeader } from '@/components/layout/section-header';
import { DataPanel } from '@/components/ui/data-panel';
import { KPICard } from '@/components/ui/kpi-card';
import { KPIGrid } from '@/components/ui/kpi-grid';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { formatBytes } from '@/lib/format';
import type { ProjectDetail, ProjectReportsResponse } from '@/types/domain';

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('pt-BR', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatFileSize = (sizeBytes: number | null): string => {
  if (sizeBytes === null) {
    return 'Tamanho não informado';
  }

  return formatBytes(sizeBytes);
};

const priorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  const session = useAppSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [projectReports, setProjectReports] = useState<ProjectReportsResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useConfigureAppShell({
    title: 'Visão geral do projeto',
    searchValue: searchTerm,
    searchPlaceholder: 'Buscar reuniões, decisões ou tarefas',
    onSearchChange: setSearchTerm,
    project: projectId ? { id: projectId, name: project?.name ?? 'Projeto', color: project?.color ?? undefined } : undefined
  });

  const fetchData = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [projectPayload, reportsPayload] = await Promise.all([
        api.getProject(session.token, projectId),
        api.getProjectReports(session.token, projectId, 30).catch(() => null)
      ]);

      setProject(projectPayload);
      setProjectReports(reportsPayload);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar a visão geral do projeto.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session?.token]);

  useEffect(() => {
    if (projectId) {
      void fetchData();
    }
  }, [fetchData, projectId]);

  const query = searchTerm.trim().toLowerCase();

  const filteredDecisions = useMemo(() => {
    if (!projectReports) {
      return [];
    }

    if (!query) {
      return projectReports.recentDecisions;
    }

    return projectReports.recentDecisions.filter((entry) => {
      return entry.decision.toLowerCase().includes(query) || entry.meetingTitle.toLowerCase().includes(query);
    });
  }, [projectReports, query]);

  const filteredPriorityCards = useMemo(() => {
    const source = projectReports?.openTasksFromMeetings ?? [];

    if (!query) {
      return source;
    }

    return source.filter((card) => {
      return card.title.toLowerCase().includes(query) || (card.description ?? '').toLowerCase().includes(query);
    });
  }, [projectReports?.openTasksFromMeetings, query]);

  const recentFiles = useMemo(() => {
    if (!project) {
      return [];
    }

    const files = [...project.files].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (!query) {
      return files;
    }

    return files.filter((file) => file.name.toLowerCase().includes(query));
  }, [project, query]);

  return (
    <>
      {isLoading && !project ? (
        <div className="rounded-xl border border-[#c2c6d4] bg-white px-4 py-3 text-sm text-[#424752]">
          Carregando projeto...
        </div>
      ) : null}

      {project ? (
        <>
          <PageHeader
            className="mb-6"
            title="Visão geral"
            description={
              project.description ||
              'Projeto sem descrição detalhada. Atualize os dados na configuração para compartilhar contexto com a equipe.'
            }
          />

          <section className="app-page">
            <KPIGrid className="xl:grid-cols-3">
              <KPICard title="Reuniões" value={project.metrics.meetings} helper="Total registradas no projeto" />
              <KPICard title="Cards em aberto" value={project.metrics.cards} helper="Itens ativos no quadro" />
              <KPICard
                title="Decisões"
                value={projectReports?.recentDecisions.length ?? project.metrics.reports}
                helper="Últimas decisões extraídas"
              />
            </KPIGrid>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <DataPanel
                className="xl:col-span-8"
                header={
                  <SectionHeader
                    title="Decisões recentes"
                    description="Principais decisões capturadas nas reuniões."
                    actions={
                      <Link href={`/projects/${projectId}/reports`} className="text-sm font-semibold text-brand hover:underline">
                        Ver relatório
                      </Link>
                    }
                  />
                }
              >
                {filteredDecisions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#dfe5ef] bg-[#f8faff] px-4 py-5 text-sm text-[#64748b]">
                    Nenhuma decisão encontrada até o momento.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {filteredDecisions.slice(0, 4).map((decision, index) => (
                      <li key={`${decision.meetingId}-${index}`} className="rounded-xl border border-[#e4e9f2] bg-[#f8faff] px-4 py-3">
                        <p className="text-sm font-medium text-[#111827]">{decision.decision}</p>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {decision.meetingTitle} • {formatDateTime(decision.createdAt)}
                        </p>
                        <Link
                          href={`/projects/${projectId}/meetings/${decision.meetingId}?highlight=meeting-decisions`}
                          className="mt-2 inline-flex text-xs font-semibold text-brand transition-colors hover:text-[#0A4C78]"
                        >
                          Abrir origem
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </DataPanel>

              <DataPanel
                className="xl:col-span-4"
                header={
                  <SectionHeader
                    title="Cards prioritários"
                    description="Pendências com maior criticidade."
                    actions={
                      <Link href={`/projects/${projectId}/board`} className="text-sm font-semibold text-brand hover:underline">
                        Abrir quadro
                      </Link>
                    }
                  />
                }
              >
                {filteredPriorityCards.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#dfe5ef] bg-[#f8faff] px-4 py-5 text-sm text-[#64748b]">
                    Nenhum card prioritário encontrado.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {filteredPriorityCards.slice(0, 4).map((card) => (
                      <li key={card.cardId} className="rounded-xl border border-[#e4e9f2] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[#111827]">{card.title}</p>
                          <span className="text-xs font-medium text-[#64748b]">
                            {card.priority ? priorityLabel[card.priority] : 'Baixa'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#64748b]">{card.columnTitle}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </DataPanel>
            </div>

            {recentFiles.length > 0 ? (
              <DataPanel
                header={
                  <SectionHeader
                    title="Biblioteca recente"
                    description="Materiais adicionados no projeto."
                    actions={
                      <Link href={`/projects/${projectId}/library`} className="text-sm font-semibold text-brand hover:underline">
                        Ver biblioteca
                      </Link>
                    }
                  />
                }
              >
                <ul className="grid gap-3 sm:grid-cols-2">
                  {recentFiles.slice(0, 4).map((file) => (
                    <li key={file.id} className="rounded-xl border border-[#e4e9f2] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-4 w-4 text-[#64748b]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#111827]">{file.name}</p>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {file.uploadedBy.name} • {formatDateTime(file.createdAt)}
                          </p>
                          <p className="text-xs text-[#64748b]">{formatFileSize(file.sizeBytes)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </DataPanel>
            ) : null}
          </section>
        </>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-[#ffdad6] bg-[#ffdad6]/45 px-4 py-3 text-sm text-[#93000a]">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
