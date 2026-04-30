'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  Gavel,
  History,
  KanbanSquare,
  MessageSquare,
  TriangleAlert,
} from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageActions } from '@/components/layout/page-actions';
import { PageHeader } from '@/components/layout/page-header';
import { DataPanel } from '@/components/ui/data-panel';
import { FilterPills } from '@/components/ui/filter-pills';
import { MetricCard } from '@/components/ui/metric-card';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { cn } from '@/lib/utils';
import type {
  OrganizationDashboardResponse,
  OrganizationMemberSummary,
  ProjectSummary
} from '@/types/domain';

const PERIOD_OPTIONS = [7, 30, 90] as const;

const activityTypeLabel: Record<OrganizationDashboardResponse['teamRecentActivity'][number]['type'], string> = {
  MEETING_CREATED: 'Reunião',
  OBSERVATION_ADDED: 'Observação',
  CARD_CREATED: 'Card',
  FILE_UPLOADED: 'Arquivo',
  MEMBER_ADDED: 'Equipe'
};

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

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const getProjectProgress = (project: ProjectSummary): number => {
  const activitySignal = project.metrics.meetings + project.metrics.reports;
  const totalSignal =
    project.metrics.meetings +
    project.metrics.cards +
    project.metrics.files +
    project.metrics.members +
    1;

  const percentage = Math.round((activitySignal / totalSignal) * 100);
  return Math.max(8, Math.min(95, percentage));
};

export default function DashboardPage() {
  const session = useAppSession();

  const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);
  const [searchTerm, setSearchTerm] = useState('');

  const [dashboard, setDashboard] = useState<OrganizationDashboardResponse | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [principalOwnerName, setPrincipalOwnerName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useConfigureAppShell({
    title: 'Painel',
    searchValue: searchTerm,
    searchPlaceholder: 'Buscar projetos, decisões ou atividades',
    onSearchChange: setSearchTerm
  });

  const loadDashboard = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [dashboardPayload, projectsPayload, membersPayload] = await Promise.all([
        api.getOrganizationDashboard(session.token, selectedDays),
        api.listProjects(session.token),
        api.listOrganizationMembers(session.token).catch(() => ({ members: [] as OrganizationMemberSummary[] }))
      ]);

      const sortedProjects = [...projectsPayload.projects].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      const principalOwner = membersPayload.members.find((member) => member.role === 'OWNER');

      setDashboard(dashboardPayload);
      setProjects(sortedProjects);
      setPrincipalOwnerName(principalOwner?.user.fullName?.trim() ?? '');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar os dados do painel.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDays, session?.token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Bom dia';
    }

    if (hour < 18) {
      return 'Boa tarde';
    }

    return 'Boa noite';
  }, []);

  const greetingName = useMemo(() => {
    const organizationName = dashboard?.organization.name?.trim() || session?.activeOrganization.name?.trim();

    if (organizationName) {
      return organizationName;
    }

    const ownerName = principalOwnerName.trim() || session?.user.fullName?.trim();
    return ownerName || 'Equipe';
  }, [dashboard?.organization.name, principalOwnerName, session?.activeOrganization.name, session?.user.fullName]);

  const query = searchTerm.trim().toLowerCase();

  const filteredProjects = useMemo(() => {
    if (!query) {
      return projects;
    }

    return projects.filter((project) => {
      return (
        project.name.toLowerCase().includes(query) ||
        (project.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [projects, query]);

  const filteredDecisions = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    if (!query) {
      return dashboard.recentDecisions;
    }

    return dashboard.recentDecisions.filter((entry) => {
      return (
        entry.decision.toLowerCase().includes(query) ||
        entry.meetingTitle.toLowerCase().includes(query) ||
        entry.project.name.toLowerCase().includes(query)
      );
    });
  }, [dashboard, query]);

  const filteredPending = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    if (!query) {
      return dashboard.recentPendingItems;
    }

    return dashboard.recentPendingItems.filter((entry) => {
      return (
        entry.item.toLowerCase().includes(query) ||
        entry.meetingTitle.toLowerCase().includes(query) ||
        entry.project.name.toLowerCase().includes(query)
      );
    });
  }, [dashboard, query]);

  const filteredActivity = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    if (!query) {
      return dashboard.teamRecentActivity;
    }

    return dashboard.teamRecentActivity.filter((entry) => {
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        (entry.actor?.name ?? '').toLowerCase().includes(query) ||
        (entry.project?.name ?? '').toLowerCase().includes(query)
      );
    });
  }, [dashboard, query]);

  return (
    <div className="app-page">
      <PageHeader
        title={`${greeting}, ${greetingName}`}
        description="Aqui está a inteligência mais recente das suas reuniões com IA."
        actions={
          <PageActions>
            <FilterPills
              value={selectedDays}
              onChange={(value) => setSelectedDays(value as 7 | 30 | 90)}
              items={PERIOD_OPTIONS.map((days) => ({ id: days, label: `${days}d` }))}
            />
            {/* <Link
              href="/team"
              className="inline-flex h-10 items-center rounded-[10px] border border-[#f9b51b]/35 bg-[#fff6de] px-4 text-sm font-semibold text-[#7c5800] transition-colors hover:bg-[#ffefc3]"
            >
              Adicionar colaborador
            </Link> */}
            <Link
              href="/projects"
              className="inline-flex h-10 items-center rounded-[10px] bg-[#005eb8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#004b93]"
            >
              Novo projeto
            </Link>
          </PageActions>
        }
      />

      {isLoading && !dashboard ? (
        <div className="rounded-[10px] border border-[#dfe5ef] bg-white px-4 py-3 text-sm text-[#475569]">
          Carregando painel...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[10px] border border-[#ffdad6] bg-[#ffefed] px-4 py-3 text-sm text-[#93000a]">
          {errorMessage}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Total de projetos"
              value={dashboard.metrics.projects}
              suffix="ativos"
              icon={Folder}
              suffixClassName="text-emerald-700"
            />
            <MetricCard
              title="Reuniões analisadas"
              value={dashboard.metrics.recentMeetings}
              suffix="período"
              icon={MessageSquare}
            />
            <MetricCard title="Cards em aberto" value={dashboard.metrics.openCards} suffix="ativos" icon={KanbanSquare} />
            <MetricCard
              title="Decisões extraídas"
              value={dashboard.metrics.recentDecisions}
              suffix="neste período"
              icon={Gavel}
              valueClassName="text-[#00478d]"
              suffixClassName="text-[#00478d]/80"
            />
            <MetricCard
              title="Pendências"
              value={dashboard.metrics.recentPendingItems}
              suffix="atenção"
              icon={TriangleAlert}
              valueClassName="text-[#ba1a1a]"
              suffixClassName="text-[#ba1a1a]/80"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <section className="flex flex-col gap-6 xl:col-span-8">
              <DataPanel
                header={
                  <>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
                      <Gavel className="h-4 w-4 text-[#005eb8]" />
                      Decisões recentes da IA
                    </h3>
                    <Link href="/projects" className="text-sm font-semibold text-[#005eb8] hover:underline">
                      Ver tudo
                    </Link>
                  </>
                }
              >
                <ul className="divide-y divide-[#e5eaf3]">
                  {filteredDecisions.length === 0 ? (
                    <li className="py-6 text-sm text-[#64748b]">Nenhuma decisão encontrada para este filtro.</li>
                  ) : (
                    filteredDecisions.slice(0, 4).map((decision) => (
                      <li key={`${decision.meetingId}-${decision.createdAt}`} className="py-4">
                        <h4 className="text-sm font-semibold text-[#111827]">{decision.decision}</h4>
                        <p className="mt-1 text-sm text-[#475569]">
                          {decision.meetingTitle} • {decision.project.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#64748b]">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(decision.createdAt)}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </DataPanel>

              <DataPanel
                header={
                  <>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
                      <Briefcase className="h-4 w-4 text-[#64748b]" />
                      Projetos ativos
                    </h3>
                    <div className="flex gap-1 text-[#64748b]">
                      <button type="button" className="rounded-[8px] p-1 transition-colors hover:bg-[#ecf2fb]" aria-label="Anterior">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded-[8px] p-1 transition-colors hover:bg-[#ecf2fb]" aria-label="Próximo">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                }
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredProjects.length === 0 ? (
                    <p className="text-sm text-[#64748b] md:col-span-2">Nenhum projeto encontrado para este filtro.</p>
                  ) : (
                    filteredProjects.slice(0, 4).map((project) => {
                      const progress = getProjectProgress(project);

                      return (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className="rounded-[10px] border border-[#dfe5ef] p-4 transition-colors hover:border-[#b8d4f5] hover:bg-[#fbfdff]"
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#eef4ff] text-[#005eb8]">
                              <FolderOpen className="h-4 w-4" />
                            </div>
                            <span className="text-xs text-[#64748b]">Atualizado {formatDateTime(project.updatedAt)}</span>
                          </div>

                          <h4 className="text-sm font-semibold text-[#111827]">{project.name}</h4>
                          <p className="mt-1 line-clamp-2 text-xs text-[#475569]">
                            {project.description || 'Projeto operacional com reuniões, quadro e relatórios.'}
                          </p>

                          <div className="mt-3 h-1.5 w-full rounded-full bg-[#e9edf5]">
                            <div className="h-1.5 rounded-full bg-[#005eb8]" style={{ width: `${progress}%` }} />
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </DataPanel>
            </section>

            <section className="flex flex-col gap-6 xl:col-span-4">
              <section id="acao-necessaria">
                <DataPanel
                  header={<h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">Ação necessária</h3>}
                >
                  <ul className="divide-y divide-[#e5eaf3]">
                    {filteredPending.length === 0 ? (
                      <li className="py-5 text-sm text-[#64748b]">Nenhuma pendência para este filtro.</li>
                    ) : (
                      filteredPending.slice(0, 5).map((entry) => (
                        <li key={`${entry.meetingId}-${entry.createdAt}`} className="py-3.5">
                          <p className="text-sm font-medium text-[#111827]">{entry.item}</p>
                          <p className="mt-1 text-xs text-[#64748b]">{formatDateTime(entry.createdAt)}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </DataPanel>
              </section>

              <section id="atividade-equipe">
                <DataPanel
                  header={
                    <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
                      <History className="h-4 w-4 text-[#64748b]" />
                      Atividade da equipe
                    </h3>
                  }
                  className="min-h-[360px]"
                >
                  <div className="scrollbar-none h-full max-h-[340px] overflow-y-auto">
                    {filteredActivity.length === 0 ? (
                      <p className="text-sm text-[#64748b]">Nenhuma atividade encontrada para este filtro.</p>
                    ) : (
                      <div className="space-y-4">
                        {filteredActivity.slice(0, 6).map((activity, index) => (
                          <div key={`${activity.type}-${activity.occurredAt}-${index}`} className="rounded-[10px] border border-[#e4e9f2] p-3">
                            <p className="text-sm text-[#111827]">
                              <span className="font-semibold">{activity.actor?.name ?? activityTypeLabel[activity.type]}</span>{' '}
                              {activity.description}
                            </p>
                            <p className="mt-1 text-xs text-[#64748b]">{formatDateTime(activity.occurredAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DataPanel>
              </section>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
