'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit3, FileText, Plus, X } from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { SectionHeader } from '@/components/layout/section-header';
import { Button } from '@/components/ui/button';
import { DataPanel } from '@/components/ui/data-panel';
import { KPICard } from '@/components/ui/kpi-card';
import { KPIGrid } from '@/components/ui/kpi-grid';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { formatBytes } from '@/lib/format';
import type { MemberRole, OrganizationMemberSummary, ProjectDetail, ProjectReportsResponse } from '@/types/domain';

const PROJECT_ROLE_OPTIONS: MemberRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

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

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const roleLabel = (role: MemberRole): string => {
  switch (role) {
    case 'OWNER':
      return 'Dono';
    case 'ADMIN':
      return 'Administrador';
    case 'MEMBER':
      return 'Membro';
    case 'VIEWER':
      return 'Visualizador';
    default:
      return role;
  }
};

const meetingStatusLabel: Record<string, string> = {
  PENDING: 'Pendente',
  UPLOADED: 'Áudio enviado',
  TRANSCRIBING: 'Transcrevendo',
  TRANSCRIBED: 'Transcrito',
  PROCESSING_AI: 'Processando IA',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou'
};

const priorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

export default function ProjectOverviewPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  const session = useAppSession();

  const [searchTerm, setSearchTerm] = useState('');

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [projectReports, setProjectReports] = useState<ProjectReportsResponse | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMemberSummary[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#1565C0');

  const [newMemberOrganizationId, setNewMemberOrganizationId] = useState('');
  const [newMemberProjectRole, setNewMemberProjectRole] = useState<MemberRole>('MEMBER');

  useConfigureAppShell({
    title: 'Visão geral do projeto',
    searchValue: searchTerm,
    searchPlaceholder: 'Buscar reuniões, decisões ou tarefas',
    onSearchChange: setSearchTerm,
    project: projectId ? { id: projectId, name: project?.name ?? 'Projeto', color: project?.color ?? undefined } : undefined
  });

  const canEditProject = session?.activeOrganization.role !== 'VIEWER';
  const canDeleteProject =
    session?.activeOrganization.role === 'OWNER' || session?.activeOrganization.role === 'ADMIN';
  const canManageProjectMembers =
    session?.activeOrganization.role === 'OWNER' || session?.activeOrganization.role === 'ADMIN';

  const fetchData = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [projectPayload, reportsPayload, orgMembersPayload] = await Promise.all([
        api.getProject(session.token, projectId),
        api.getProjectReports(session.token, projectId, 30).catch(() => null),
        api.listOrganizationMembers(session.token).catch(() => ({ members: [] as OrganizationMemberSummary[] }))
      ]);

      setProject(projectPayload);
      setProjectReports(reportsPayload);
      setOrganizationMembers(orgMembersPayload.members);

      setName(projectPayload.name);
      setDescription(projectPayload.description ?? '');
      setColor(projectPayload.color ?? '#1565C0');
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

  const availableOrganizationMembers = useMemo(() => {
    if (!project) {
      return [];
    }

    const assignedUserIds = new Set(project.members.map((member) => member.user.id));

    return organizationMembers.filter((member) => !assignedUserIds.has(member.user.id));
  }, [organizationMembers, project]);

  const query = searchTerm.trim().toLowerCase();

  const filteredDecisions = useMemo(() => {
    if (!projectReports) {
      return [];
    }

    if (!query) {
      return projectReports.recentDecisions;
    }

    return projectReports.recentDecisions.filter((entry) => {
      return (
        entry.decision.toLowerCase().includes(query) ||
        entry.meetingTitle.toLowerCase().includes(query)
      );
    });
  }, [projectReports, query]);

  const filteredMeetings = useMemo(() => {
    if (!project) {
      return [];
    }

    const meetings = [...project.meetings].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (!query) {
      return meetings;
    }

    return meetings.filter((meeting) => meeting.title.toLowerCase().includes(query));
  }, [project, query]);

  const filteredPriorityCards = useMemo(() => {
    const source = projectReports?.openTasksFromMeetings ?? [];

    if (!query) {
      return source;
    }

    return source.filter((card) => {
      return (
        card.title.toLowerCase().includes(query) ||
        (card.description ?? '').toLowerCase().includes(query)
      );
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

  const handleSaveProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canEditProject) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await api.updateProject(session.token, projectId, {
        name,
        description: description || null,
        color: color || null
      });

      setProject(updated);
      setShowEditModal(false);
      setSuccessMessage('Projeto atualizado com sucesso.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível atualizar o projeto.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!session?.token || !projectId || !canDeleteProject) {
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir este projeto?')) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await api.deleteProject(session.token, projectId);
      router.push('/projects');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível excluir o projeto.');
      }
      setIsDeleting(false);
    }
  };

  const handleAddProjectMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canManageProjectMembers || !newMemberOrganizationId) {
      return;
    }

    setIsAddingMember(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.addProjectMember(session.token, projectId, {
        organizationMemberId: newMemberOrganizationId,
        role: newMemberProjectRole
      });

      setShowAddMemberModal(false);
      setNewMemberOrganizationId('');
      setNewMemberProjectRole('MEMBER');
      await fetchData();
      setSuccessMessage('Membro adicionado ao projeto.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível adicionar o membro.');
      }
    } finally {
      setIsAddingMember(false);
    }
  };

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
                title="Visão geral"
                description={
                  project.description ||
                  'Projeto sem descrição detalhada. Atualize os dados para compartilhar contexto com a equipe.'
                }
                actions={
                  canEditProject ? (
                    <Button type="button" variant="subtle" onClick={() => setShowEditModal(true)} className="gap-2 text-[#191c21]">
                      <Edit3 className="h-4 w-4" />
                      Editar projeto
                    </Button>
                  ) : null
                }
              />

              <section className="app-page">
                <KPIGrid>
                  <KPICard
                    title="Reuniões"
                    value={project.metrics.meetings}
                    helper="Total registradas no projeto"
                  />
                  <KPICard
                    title="Cards em aberto"
                    value={project.metrics.cards}
                    helper="Itens ativos no quadro"
                  />
                  <KPICard
                    title="Decisões"
                    value={projectReports?.recentDecisions.length ?? project.metrics.reports}
                    helper="Últimas decisões extraídas"
                  />
                  <KPICard
                    title="Biblioteca"
                    value={project.metrics.files}
                    helper="Materiais registrados"
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
                      <p className="rounded-[10px] border border-dashed border-[#dfe5ef] bg-[#f8faff] px-4 py-5 text-sm text-[#64748b]">
                        Nenhuma decisão encontrada até o momento.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {filteredDecisions.slice(0, 4).map((decision, index) => (
                          <li
                            key={`${decision.meetingId}-${index}`}
                            className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-4 py-3"
                          >
                            <p className="text-sm font-medium text-[#111827]">{decision.decision}</p>
                            <p className="mt-1 text-xs text-[#64748b]">
                              {decision.meetingTitle} • {formatDateTime(decision.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DataPanel>

                  <DataPanel
                    className="xl:col-span-4"
                    header={
                      <SectionHeader
                        title="Equipe"
                        description="Membros vinculados ao projeto."
                        actions={
                          canManageProjectMembers ? (
                            <button
                              type="button"
                              onClick={() => setShowAddMemberModal(true)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#dfe5ef] text-brand transition-colors hover:bg-[#eef4ff]"
                              aria-label="Adicionar membro"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          ) : null
                        }
                      />
                    }
                  >
                    <ul className="space-y-3">
                      {project.members.slice(0, 5).map((member) => (
                        <li key={member.id} className="flex items-center gap-3 rounded-[10px] border border-[#e4e9f2] px-3 py-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2f8] text-xs font-semibold text-[#334155]">
                            {getInitials(member.user.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#111827]">{member.user.name}</p>
                            <p className="text-xs text-[#64748b]">{roleLabel(member.role)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {project.members.length > 5 ? (
                      <p className="mt-3 text-xs text-[#64748b]">+{project.members.length - 5} membros na equipe.</p>
                    ) : null}
                  </DataPanel>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <DataPanel
                    className="xl:col-span-6"
                    header={<SectionHeader title="Reuniões recentes" description="Últimas reuniões registradas no projeto." />}
                  >
                    {filteredMeetings.length === 0 ? (
                      <p className="rounded-[10px] border border-dashed border-[#dfe5ef] bg-[#f8faff] px-4 py-5 text-sm text-[#64748b]">
                        Nenhuma reunião encontrada.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {filteredMeetings.slice(0, 4).map((meeting) => (
                          <li key={meeting.id} className="rounded-[10px] border border-[#e4e9f2] px-4 py-3">
                            <p className="text-sm font-medium text-[#111827]">{meeting.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#64748b]">
                              <span>{formatDateTime(meeting.createdAt)}</span>
                              <span>•</span>
                              <span>{meetingStatusLabel[meeting.status] ?? meeting.status}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DataPanel>

                  <DataPanel
                    className="xl:col-span-6"
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
                      <p className="rounded-[10px] border border-dashed border-[#dfe5ef] bg-[#f8faff] px-4 py-5 text-sm text-[#64748b]">
                        Nenhum card prioritário encontrado.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {filteredPriorityCards.slice(0, 4).map((card) => (
                          <li key={card.cardId} className="rounded-[10px] border border-[#e4e9f2] px-4 py-3">
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
                        <li key={file.id} className="rounded-[10px] border border-[#e4e9f2] px-4 py-3">
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

          {successMessage ? (
            <p className="mt-4 rounded-lg border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75]">
              {successMessage}
            </p>
          ) : null}

      {showEditModal && project && canEditProject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#c2c6d4] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E7EEF7] px-5 py-4">
              <h3 className="text-lg font-semibold text-[#191c21]">Editar projeto</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-md p-1 text-[#727783] hover:bg-[#ecedf6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4 px-5 py-4" onSubmit={handleSaveProject}>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                  Nome do projeto
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 py-2 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                  Cor
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-10 w-14 rounded-lg border border-[#c2c6d4] bg-white p-1"
                  />
                  <input
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-10 flex-1 rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                    pattern="^#([A-Fa-f0-9]{6})$"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                {canDeleteProject ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteProject()}
                    disabled={isDeleting}
                    className="rounded-lg border border-[#ffdad6] bg-[#ffdad6]/45 px-4 py-2 text-sm font-semibold text-[#93000a] transition-colors hover:bg-[#ffdad6] disabled:opacity-60"
                  >
                    {isDeleting ? 'Excluindo...' : 'Excluir projeto'}
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="rounded-lg border border-[#c2c6d4] px-4 py-2 text-sm font-semibold text-[#424752] transition-colors hover:bg-[#ecedf6]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-[#005eb8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004f9b] disabled:opacity-60"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAddMemberModal && canManageProjectMembers ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#c2c6d4] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E7EEF7] px-5 py-4">
              <h3 className="text-lg font-semibold text-[#191c21]">Adicionar membro ao projeto</h3>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="rounded-md p-1 text-[#727783] hover:bg-[#ecedf6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4 px-5 py-4" onSubmit={handleAddProjectMember}>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                  Membro da organização
                </label>
                <select
                  value={newMemberOrganizationId}
                  onChange={(event) => setNewMemberOrganizationId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                  required
                >
                  <option value="">Selecione um membro</option>
                  {availableOrganizationMembers.map((member) => (
                    <option key={member.memberId} value={member.memberId}>
                      {member.user.fullName} - {member.user.email}
                    </option>
                  ))}
                </select>
                {availableOrganizationMembers.length === 0 ? (
                  <p className="mt-1 text-xs text-[#727783]">Todos os membros da organização já estão vinculados.</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                  Papel
                </label>
                <select
                  value={newMemberProjectRole}
                  onChange={(event) => setNewMemberProjectRole(event.target.value as MemberRole)}
                  className="h-10 w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                >
                  {PROJECT_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="rounded-lg border border-[#c2c6d4] px-4 py-2 text-sm font-semibold text-[#424752] transition-colors hover:bg-[#ecedf6]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAddingMember || availableOrganizationMembers.length === 0}
                  className="rounded-lg bg-[#005eb8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004f9b] disabled:opacity-60"
                >
                  {isAddingMember ? 'Adicionando...' : 'Adicionar membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
