'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Save, Shield, Trash2 } from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { SectionHeader } from '@/components/layout/section-header';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { DataPanel } from '@/components/ui/data-panel';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RoleBadge } from '@/components/ui/role-badge';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type { MemberRole, OrganizationMemberSummary, ProjectDetail, ProjectMemberSummary } from '@/types/domain';

const PROJECT_ROLE_OPTIONS: MemberRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

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

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  const session = useAppSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMemberSummary[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isUpdatingMemberId, setIsUpdatingMemberId] = useState<string | null>(null);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#1565C0');

  const [newMemberOrganizationId, setNewMemberOrganizationId] = useState('');
  const [newMemberProjectRole, setNewMemberProjectRole] = useState<MemberRole>('MEMBER');
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, MemberRole>>({});

  useConfigureAppShell({
    title: 'Configurações do projeto',
    searchValue: searchTerm,
    searchPlaceholder: 'Buscar membros por nome ou e-mail',
    onSearchChange: setSearchTerm,
    project: projectId ? { id: projectId, name: project?.name ?? 'Projeto', color: project?.color ?? undefined } : undefined
  });

  const canEditProject = session?.activeOrganization.role !== 'VIEWER';
  const canDeleteProject = session?.activeOrganization.role === 'OWNER' || session?.activeOrganization.role === 'ADMIN';
  const canManageProjectMembers =
    session?.activeOrganization.role === 'OWNER' || session?.activeOrganization.role === 'ADMIN';

  const roleOptions = useMemo(
    () =>
      session?.activeOrganization.role === 'OWNER'
        ? PROJECT_ROLE_OPTIONS
        : PROJECT_ROLE_OPTIONS.filter((role) => role !== 'OWNER'),
    [session?.activeOrganization.role]
  );

  const fetchData = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [projectPayload, orgMembersPayload] = await Promise.all([
        api.getProject(session.token, projectId),
        api.listOrganizationMembers(session.token).catch(() => ({ members: [] as OrganizationMemberSummary[] }))
      ]);

      setProject(projectPayload);
      setOrganizationMembers(orgMembersPayload.members);

      setName(projectPayload.name);
      setDescription(projectPayload.description ?? '');
      setColor(projectPayload.color ?? '#1565C0');
      setMemberRoleDrafts(
        projectPayload.members.reduce<Record<string, MemberRole>>((acc, member) => {
          acc[member.id] = member.role;
          return acc;
        }, {})
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar as configurações do projeto.');
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

  const filteredMembers = useMemo(() => {
    if (!project) {
      return [];
    }

    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return project.members;
    }

    return project.members.filter((member) => {
      const nameValue = member.user.name.toLowerCase();
      const emailValue = member.user.email.toLowerCase();
      return nameValue.includes(query) || emailValue.includes(query);
    });
  }, [project, searchTerm]);

  const canEditMember = useCallback(
    (member: ProjectMemberSummary) => {
      if (!session || !canManageProjectMembers) {
        return false;
      }

      if (member.user.id === session.user.id) {
        return false;
      }

      if (session.activeOrganization.role === 'ADMIN' && member.role === 'OWNER') {
        return false;
      }

      return true;
    },
    [canManageProjectMembers, session]
  );

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

  const handleUpdateMemberRole = async (member: ProjectMemberSummary) => {
    if (!session?.token || !projectId || !canEditMember(member)) {
      return;
    }

    const nextRole = memberRoleDrafts[member.id] ?? member.role;

    if (nextRole === member.role) {
      return;
    }

    setIsUpdatingMemberId(member.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedMember = await api.updateProjectMemberRole(session.token, projectId, member.id, {
        role: nextRole
      });

      setProject((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          members: current.members.map((entry) => (entry.id === member.id ? updatedMember : entry))
        };
      });

      setMemberRoleDrafts((current) => ({
        ...current,
        [member.id]: updatedMember.role
      }));
      setSuccessMessage('Papel do membro atualizado.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível atualizar o papel deste membro.');
      }
    } finally {
      setIsUpdatingMemberId(null);
    }
  };

  const handleRemoveProjectMember = async (member: ProjectMemberSummary) => {
    if (!session?.token || !projectId || !canEditMember(member)) {
      return;
    }

    if (!window.confirm(`Remover ${member.user.name} da equipe do projeto?`)) {
      return;
    }

    setIsUpdatingMemberId(member.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.removeProjectMember(session.token, projectId, member.id);

      setProject((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          members: current.members.filter((entry) => entry.id !== member.id)
        };
      });

      setMemberRoleDrafts((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });

      setSuccessMessage('Membro removido do projeto.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível remover o membro do projeto.');
      }
    } finally {
      setIsUpdatingMemberId(null);
    }
  };

  return (
    <>
      {isLoading && !project ? (
        <div className="rounded-xl border border-[#c2c6d4] bg-white px-4 py-3 text-sm text-[#424752]">
          Carregando configurações...
        </div>
      ) : null}

      {project ? (
        <>
          <PageHeader
            className="mb-6"
            title="Configurações"
            description="Edite dados do projeto e gerencie os membros vinculados."
          />

          <section className="app-page">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <DataPanel
                className="xl:col-span-5"
                header={<SectionHeader title="Editar projeto" description="Atualize nome, descrição e cor de identificação." />}
              >
                <form className="space-y-4" onSubmit={handleSaveProject}>
                  <FormField label="Nome do projeto">
                    <Input value={name} onChange={(event) => setName(event.target.value)} required disabled={!canEditProject || isSaving} />
                  </FormField>

                  <FormField label="Descrição">
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      disabled={!canEditProject || isSaving}
                      className="w-full resize-none rounded-xl border border-[#d3dceb] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#64748b] focus-visible:border-[#1565C0]/40 focus-visible:ring-2 focus-visible:ring-[#1565C0]/12 disabled:opacity-60"
                    />
                  </FormField>

                  <FormField label="Cor do projeto" hint="Use o formato hexadecimal, por exemplo #1565C0.">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        disabled={!canEditProject || isSaving}
                        className="h-11 w-16 rounded-xl border border-[#d3dceb] bg-white p-1 disabled:opacity-60"
                      />
                      <Input
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        pattern="^#([A-Fa-f0-9]{6})$"
                        required
                        disabled={!canEditProject || isSaving}
                      />
                    </div>
                  </FormField>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    {canDeleteProject ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteProject()}
                        disabled={isDeleting}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ffdad6] bg-[#ffdad6]/45 px-3.5 text-sm font-semibold text-[#93000a] transition-colors hover:bg-[#ffdad6] disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? 'Excluindo...' : 'Excluir projeto'}
                      </button>
                    ) : (
                      <span />
                    )}

                    {canEditProject ? (
                      <Button type="submit" variant="default" className="gap-2" disabled={isSaving}>
                        <Save className="h-4 w-4" />
                        {isSaving ? 'Salvando...' : 'Salvar alterações'}
                      </Button>
                    ) : null}
                  </div>
                </form>
              </DataPanel>

              <DataPanel
                className="xl:col-span-7"
                header={
                  <SectionHeader
                    title="Equipe"
                    description="Membros vinculados ao projeto."
                    actions={
                      canManageProjectMembers ? (
                        <button
                          type="button"
                          onClick={() => setShowAddMemberModal(true)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#dfe5ef] text-brand transition-colors hover:bg-[#eef4ff]"
                          aria-label="Adicionar membro"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : null
                    }
                  />
                }
              >
                {filteredMembers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#dfe5ef] bg-[#f8faff] px-4 py-5 text-sm text-[#64748b]">
                    Nenhum membro encontrado para este filtro.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {filteredMembers.map((member) => {
                      const editable = canEditMember(member);
                      const busy = isUpdatingMemberId === member.id;

                      return (
                        <li key={member.id} className="rounded-xl border border-[#e4e9f2] px-3 py-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2f8] text-xs font-semibold text-[#334155]">
                                {getInitials(member.user.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#111827]">{member.user.name}</p>
                                <p className="truncate text-xs text-[#64748b]">{member.user.email}</p>
                              </div>
                            </div>

                            {editable ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  className="h-8 rounded-lg border border-[#d3dceb] bg-white px-2 text-xs text-[#111827]"
                                  value={memberRoleDrafts[member.id] ?? member.role}
                                  onChange={(event) =>
                                    setMemberRoleDrafts((current) => ({
                                      ...current,
                                      [member.id]: event.target.value as MemberRole
                                    }))
                                  }
                                  disabled={busy}
                                >
                                  {roleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {roleLabel(role)}
                                    </option>
                                  ))}
                                </select>

                                <Button
                                  type="button"
                                  variant="subtle"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => void handleUpdateMemberRole(member)}
                                  disabled={busy}
                                >
                                  Salvar
                                </Button>

                                <button
                                  type="button"
                                  onClick={() => void handleRemoveProjectMember(member)}
                                  disabled={busy}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] transition-colors hover:bg-[#ffdad6]/40 hover:text-[#93000a] disabled:opacity-60"
                                  aria-label="Remover membro"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <RoleBadge role={member.role} />
                                {session?.user.id === member.user.id ? (
                                  <span className="text-xs font-semibold text-[#64748b]">Você</span>
                                ) : null}
                              </div>
                            )}
                          </div>

                          {editable ? (
                            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
                              <Shield className="h-3.5 w-3.5" />
                              Papel atual: {roleLabel(member.role)}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </DataPanel>
            </div>
          </section>
        </>
      ) : null}

      {(errorMessage || successMessage) ? (
        <div className="grid gap-3 md:grid-cols-2">
          {errorMessage ? (
            <p className="rounded-lg border border-[#ffdad6] bg-[#ffdad6]/40 px-4 py-3 text-sm text-[#93000a]">{errorMessage}</p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75]">
              {successMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <AppModal
        open={showAddMemberModal && canManageProjectMembers}
        title="Adicionar membro ao projeto"
        onClose={() => setShowAddMemberModal(false)}
        className="max-w-md"
      >
        <form className="space-y-4" onSubmit={handleAddProjectMember}>
          <FormField label="Membro da organização">
            <select
              value={newMemberOrganizationId}
              onChange={(event) => setNewMemberOrganizationId(event.target.value)}
              className="h-10 w-full rounded-xl border border-[#d3dceb] bg-white px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
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
          </FormField>

          <FormField label="Papel no projeto">
            <select
              value={newMemberProjectRole}
              onChange={(event) => setNewMemberProjectRole(event.target.value as MemberRole)}
              className="h-10 w-full rounded-xl border border-[#d3dceb] bg-white px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="subtle" onClick={() => setShowAddMemberModal(false)} className="text-[#424752]">
              Cancelar
            </Button>
            <Button type="submit" variant="default" disabled={isAddingMember || availableOrganizationMembers.length === 0}>
              {isAddingMember ? 'Adicionando...' : 'Adicionar membro'}
            </Button>
          </div>
        </form>
      </AppModal>
    </>
  );
}
