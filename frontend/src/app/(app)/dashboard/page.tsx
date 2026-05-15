'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Folder, MessageSquare, TriangleAlert } from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageActions } from '@/components/layout/page-actions';
import { PageHeader } from '@/components/layout/page-header';
import { AppModal } from '@/components/ui/app-modal';
import { DataPanel } from '@/components/ui/data-panel';
import { FilterPills } from '@/components/ui/filter-pills';
import { MetricCard } from '@/components/ui/metric-card';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type { MeetingStatus, OrganizationDashboardResponse, OrganizationMemberSummary } from '@/types/domain';

type PeriodFilter = 'day' | 'week' | 'month' | 'custom';

const PERIOD_OPTIONS: Array<{ id: PeriodFilter; label: string }> = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'custom', label: 'Personalizado' }
];

const meetingStatusLabel: Record<MeetingStatus, string> = {
  PENDING: 'Pendente',
  UPLOADED: 'Áudio enviado',
  TRANSCRIBING: 'Transcrevendo',
  TRANSCRIBED: 'Transcrito',
  PROCESSING_AI: 'Processando IA',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou'
};

const meetingStatusClassName: Record<MeetingStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  UPLOADED: 'bg-blue-100 text-blue-700',
  TRANSCRIBING: 'bg-amber-100 text-amber-800',
  TRANSCRIBED: 'bg-cyan-100 text-cyan-800',
  PROCESSING_AI: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-700'
};

const priorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

const priorityClassName: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'border-[#d8e6d0] bg-[#eef8ea] text-[#2f6a1f]',
  MEDIUM: 'border-[#d6e3ff] bg-[#edf4ff] text-[#1c4f99]',
  HIGH: 'border-[#ffddb6] bg-[#fff1dd] text-[#9a4b00]',
  URGENT: 'border-[#ffd4d4] bg-[#ffeded] text-[#a01515]'
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

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateKey = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return toDateInputValue(date);
};

export default function DashboardPage() {
  const session = useAppSession();

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('month');
  const [customFrom, setCustomFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return toDateInputValue(date);
  });
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));
  const [searchTerm, setSearchTerm] = useState('');

  const [dashboard, setDashboard] = useState<OrganizationDashboardResponse | null>(null);
  const [principalOwnerName, setPrincipalOwnerName] = useState('');
  const [isMeetingsModalOpen, setIsMeetingsModalOpen] = useState(false);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [selectedMeetingDate, setSelectedMeetingDate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useConfigureAppShell({
    title: 'Painel',
    searchValue: searchTerm,
    searchPlaceholder: 'Buscar decisões, reuniões e pendências',
    onSearchChange: setSearchTerm
  });

  const loadDashboard = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    if (selectedPeriod === 'custom') {
      if (!customFrom || !customTo) {
        setErrorMessage('Selecione início e fim para o período personalizado.');
        return;
      }

      if (new Date(customFrom).getTime() > new Date(customTo).getTime()) {
        setErrorMessage('A data inicial não pode ser maior que a data final.');
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [dashboardPayload, membersPayload] = await Promise.all([
        api.getOrganizationDashboard(
          session.token,
          selectedPeriod === 'custom'
            ? { period: 'custom', from: customFrom, to: customTo }
            : { period: selectedPeriod }
        ),
        api.listOrganizationMembers(session.token).catch(() => ({ members: [] as OrganizationMemberSummary[] }))
      ]);

      const principalOwner = membersPayload.members.find((member) => member.role === 'OWNER');

      setDashboard(dashboardPayload);
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
  }, [customFrom, customTo, selectedPeriod, session?.token]);

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
        (entry.meetingTitle ?? '').toLowerCase().includes(query) ||
        entry.project.name.toLowerCase().includes(query) ||
        entry.stage.toLowerCase().includes(query) ||
        entry.assignees.some((assignee) => assignee.name.toLowerCase().includes(query))
      );
    });
  }, [dashboard, query]);

  const filteredMeetings = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return dashboard.recentMeetings.filter((meeting) => {
      const matchesQuery =
        !query ||
        meeting.title.toLowerCase().includes(query) ||
        meeting.project.name.toLowerCase().includes(query);

      const matchesDate = !selectedMeetingDate || toDateKey(meeting.createdAt) === selectedMeetingDate;

      return matchesQuery && matchesDate;
    });
  }, [dashboard, query, selectedMeetingDate]);

  return (
    <div className="app-page">
      <PageHeader
        title={`${greeting}, ${greetingName}`}
        description="Decisões e pendências das reuniões."
        actions={
          <PageActions>
            <FilterPills
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              items={PERIOD_OPTIONS}
            />

            {selectedPeriod === 'custom' ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#d8e0ee] bg-white px-3 py-1.5">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="rounded-lg border border-[#d8e0ee] px-2 py-1 text-xs text-[#111827] outline-none focus:border-brand"
                />
                <span className="text-xs text-[#64748b]">até</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="rounded-lg border border-[#d8e0ee] px-2 py-1 text-xs text-[#111827] outline-none focus:border-brand"
                />
              </div>
            ) : null}

            <Link
              href="/projects"
              className="inline-flex h-10 items-center rounded-xl bg-[#005eb8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#004b93]"
            >
              Novo projeto
            </Link>
          </PageActions>
        }
      />

      {isLoading && !dashboard ? (
        <div className="rounded-xl border border-[#dfe5ef] bg-white px-4 py-3 text-sm text-[#475569]">
          Carregando painel...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-[#ffdad6] bg-[#ffefed] px-4 py-3 text-sm text-[#93000a]">
          {errorMessage}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Total de projetos"
              value={dashboard.metrics.projects}
              suffix="ativos"
              icon={Folder}
              suffixClassName="text-emerald-700"
              href="/projects"
            />
            <MetricCard
              title="Reuniões no período"
              value={dashboard.metrics.recentMeetings}
              suffix="registradas"
              icon={MessageSquare}
              onClick={() => setIsMeetingsModalOpen(true)}
            />
            <MetricCard
              title="Pendências"
              value={dashboard.metrics.recentPendingItems}
              suffix="atenção"
              icon={TriangleAlert}
              valueClassName="text-[#ba1a1a]"
              suffixClassName="text-[#ba1a1a]/80"
              onClick={() => setIsPendingModalOpen(true)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <section className="flex flex-col gap-6 xl:col-span-8">
              <DataPanel
                header={
                  <h3 className="text-base font-semibold text-[#111827]">Decisões tomadas nas reuniões</h3>
                }
              >
                <ul className="divide-y divide-[#e5eaf3]">
                  {filteredDecisions.length === 0 ? (
                    <li className="py-6 text-sm text-[#64748b]">Nenhuma decisão encontrada para este filtro.</li>
                  ) : (
                    filteredDecisions.slice(0, 8).map((decision, index) => (
                      <li key={`${decision.meetingId}-${decision.createdAt}-${index}`} className="py-4">
                        <h4 className="text-sm font-semibold text-[#111827]">{decision.decision}</h4>
                        <p className="mt-1 text-sm text-[#475569]">
                          {decision.meetingTitle} • {decision.project.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#64748b]">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(decision.createdAt)}
                        </p>
                        <Link
                          href={`/projects/${decision.project.id}/meetings/${decision.meetingId}?highlight=meeting-decisions`}
                          className="mt-2 inline-flex text-xs font-semibold text-brand transition-colors hover:text-[#0A4C78]"
                        >
                          Abrir origem
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </DataPanel>
            </section>

            <section className="flex flex-col gap-6 xl:col-span-4">
              <section id="acao-necessaria">
                <DataPanel
                  header={
                    <div className="flex w-full items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">Ação necessária</h3>
                      <button
                        type="button"
                        onClick={() => setIsPendingModalOpen(true)}
                        className="inline-flex h-8 items-center rounded-lg bg-transparent px-0 text-xs font-semibold text-[#005eb8] transition-colors hover:bg-transparent hover:text-[#004b93]"
                      >
                        Ver todas
                      </button>
                    </div>
                  }
                >
                  <ul className="divide-y divide-[#e5eaf3]">
                    {filteredPending.length === 0 ? (
                      <li className="py-5 text-sm text-[#64748b]">Nenhuma pendência para este filtro.</li>
                    ) : (
                      filteredPending.slice(0, 5).map((entry) => (
                        <li key={entry.cardId} className="py-3.5">
                          <p className="text-sm font-semibold text-[#111827]">{entry.item}</p>
                          <p className="mt-1 text-xs text-[#475569]">Projeto: {entry.project.name}</p>
                          <p className="mt-1 text-xs text-[#475569]">Estágio atual: {entry.stage}</p>
                          <p className="mt-1 text-xs text-[#475569]">
                            Responsável:{' '}
                            {entry.assignees.length > 0 ? entry.assignees.map((assignee) => assignee.name).join(', ') : 'Não definido'}
                          </p>
                          <p className="mt-1 text-xs text-[#475569]">
                            Data de entrega: {entry.dueDate ? formatDate(entry.dueDate) : 'Não definida'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                entry.priority ? priorityClassName[entry.priority] : 'border-[#d7deea] bg-[#f4f7fb] text-[#5b677a]'
                              }`}
                            >
                              Prioridade: {entry.priority ? priorityLabel[entry.priority] : 'Não definida'}
                            </span>
                            <Link
                              href={`/projects/${entry.project.id}/board?card=${entry.cardId}`}
                              className="text-[11px] font-semibold text-[#005eb8] hover:underline"
                            >
                              Abrir no quadro
                            </Link>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </DataPanel>
              </section>
            </section>
          </div>
        </>
      ) : null}

      <AppModal
        open={isMeetingsModalOpen}
        onClose={() => setIsMeetingsModalOpen(false)}
        title="Reuniões do período"
        description={`Período: ${dashboard ? `${formatDate(dashboard.period.from)} até ${formatDate(dashboard.period.to)}` : '-'}`}
        className="max-w-4xl"
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#475569]">
            Data específica
            <input
              type="date"
              value={selectedMeetingDate}
              onChange={(event) => setSelectedMeetingDate(event.target.value)}
              className="h-9 rounded-xl border border-app px-3 text-sm text-[#111827] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
          </label>
          <button
            type="button"
            onClick={() => setSelectedMeetingDate('')}
            className="inline-flex h-9 items-center rounded-xl border border-[#d8e0ee] px-3 text-xs font-semibold text-[#334155] transition-colors hover:bg-[#f8fafc]"
          >
            Limpar data
          </button>
        </div>

        <ul className="divide-y divide-[#e5eaf3]">
          {filteredMeetings.length === 0 ? (
            <li className="py-6 text-sm text-[#64748b]">Nenhuma reunião encontrada para os filtros selecionados.</li>
          ) : (
            filteredMeetings.map((meeting) => (
              <li key={meeting.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{meeting.title}</p>
                    <p className="mt-1 text-xs text-[#475569]">{meeting.project.name}</p>
                    <p className="mt-1 text-xs text-[#64748b]">Criada em {formatDateTime(meeting.createdAt)}</p>
                  </div>

                  <Link
                    href={`/projects/${meeting.project.id}/meetings/${meeting.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-[#d6e6f8] bg-[#f5faff] px-3 text-xs font-semibold text-[#005eb8] transition-colors hover:bg-[#eaf4ff]"
                  >
                    Abrir reunião
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${meetingStatusClassName[meeting.status]}`}>
                    {meetingStatusLabel[meeting.status]}
                  </span>
                  <span className="inline-flex rounded-full border border-[#dbe3ef] bg-[#f8fafc] px-2 py-1 text-[#334155]">
                    Transcrição: {meeting.hasTranscript ? 'sim' : 'não'}
                  </span>
                  <span className="inline-flex rounded-full border border-[#dbe3ef] bg-[#f8fafc] px-2 py-1 text-[#334155]">
                    Análise: {meeting.hasAnalysis ? 'sim' : 'não'}
                  </span>
                  <span className="inline-flex rounded-full border border-[#dbe3ef] bg-[#f8fafc] px-2 py-1 text-[#334155]">
                    Decisões: {meeting.decisionsCount}
                  </span>
                  <span className="inline-flex rounded-full border border-[#dbe3ef] bg-[#f8fafc] px-2 py-1 text-[#334155]">
                    Pendências: {meeting.pendingItemsCount}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </AppModal>

      <AppModal
        open={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        title="Pendências do período"
        description={`Período: ${dashboard ? `${formatDate(dashboard.period.from)} até ${formatDate(dashboard.period.to)}` : '-'}`}
        className="max-w-4xl"
      >
        <ul className="divide-y divide-[#e5eaf3]">
          {filteredPending.length === 0 ? (
            <li className="py-6 text-sm text-[#64748b]">Sem pendências neste período.</li>
          ) : (
            filteredPending.map((entry) => (
              <li key={entry.cardId} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827]">{entry.item}</p>
                    {entry.meetingTitle ? (
                      <p className="mt-1 text-xs text-[#475569]">Reunião: {entry.meetingTitle}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-[#475569]">Projeto: {entry.project.name}</p>
                    <p className="mt-1 text-xs text-[#475569]">Estágio atual: {entry.stage}</p>
                    <p className="mt-1 text-xs text-[#475569]">
                      Responsável:{' '}
                      {entry.assignees.length > 0 ? entry.assignees.map((assignee) => assignee.name).join(', ') : 'Não definido'}
                    </p>
                    <p className="mt-1 text-xs text-[#475569]">
                      Data de entrega: {entry.dueDate ? formatDate(entry.dueDate) : 'Não definida'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-start">
                    <Link
                      href={entry.meetingId ? `/projects/${entry.project.id}/meetings/${entry.meetingId}` : `/projects/${entry.project.id}`}
                      className="inline-flex h-8 items-center rounded-lg border border-[#d6e6f8] bg-white px-3 text-xs font-semibold text-[#005eb8] transition-colors hover:bg-[#f8fbff]"
                    >
                      Ver detalhes
                    </Link>
                    <Link
                      href={`/projects/${entry.project.id}/board?card=${entry.cardId}`}
                      className="inline-flex h-8 items-center rounded-lg border border-[#d6e6f8] bg-[#f5faff] px-3 text-xs font-semibold text-[#005eb8] transition-colors hover:bg-[#eaf4ff]"
                    >
                      Abrir no quadro
                    </Link>
                  </div>
                </div>

                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      entry.priority ? priorityClassName[entry.priority] : 'border-[#d7deea] bg-[#f4f7fb] text-[#5b677a]'
                    }`}
                  >
                    Prioridade: {entry.priority ? priorityLabel[entry.priority] : 'Não definida'}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </AppModal>
    </div>
  );
}
