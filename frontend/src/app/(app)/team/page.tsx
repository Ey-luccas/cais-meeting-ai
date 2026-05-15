'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  Shield,
  UserPlus2,
  UserX,
  X
} from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageActions } from '@/components/layout/page-actions';
import { PageHeader } from '@/components/layout/page-header';
import { AppModal } from '@/components/ui/app-modal';
import { AppTabs } from '@/components/ui/app-tabs';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { RoleBadge } from '@/components/ui/role-badge';
import { SearchInput } from '@/components/ui/search-input';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type {
  CollaboratorInvitationSummary,
  MemberRole,
  OrganizationMemberSummary,
  ProjectSummary
} from '@/types/domain';

const ALL_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

type TeamTab = 'all' | 'pending';

const roleLabel: Record<MemberRole, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
  VIEWER: 'Visualizador'
};

const formatJoinDate = (value: string): string => {
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

const getInitial = (name: string): string => {
  const trimmed = name.trim();

  if (!trimmed) {
    return 'C';
  }

  return trimmed.charAt(0).toUpperCase();
};

export default function TeamPage() {
  const session = useAppSession();

  const [members, setMembers] = useState<OrganizationMemberSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<CollaboratorInvitationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isMutatingMemberId, setIsMutatingMemberId] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TeamTab>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [roleDrafts, setRoleDrafts] = useState<Record<string, MemberRole>>({});
  const [roleEditorFor, setRoleEditorFor] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('MEMBER');
  const [inviteProjectIds, setInviteProjectIds] = useState<string[]>([]);

  useConfigureAppShell({
    title: 'Equipe',
    searchValue: searchTerm,
    onSearchChange: setSearchTerm
  });

  const canManageTeam =
    session?.activeOrganization.role === 'OWNER' || session?.activeOrganization.role === 'ADMIN';

  const roleOptions = useMemo(
    () =>
      session?.activeOrganization.role === 'OWNER'
        ? ALL_ROLES
        : ALL_ROLES.filter((role) => role !== 'OWNER'),
    [session?.activeOrganization.role]
  );

  const loadData = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [membersPayload, projectsPayload, invitationsPayload] = await Promise.all([
        api.listOrganizationMembers(session.token),
        api.listProjects(session.token),
        canManageTeam
          ? api.listPendingCollaboratorInvitations(session.token)
          : Promise.resolve({ invitations: [] as CollaboratorInvitationSummary[] })
      ]);

      setMembers(membersPayload.members);
      setProjects(projectsPayload.projects);
      setPendingInvitations(invitationsPayload.invitations);

      setRoleDrafts(
        membersPayload.members.reduce<Record<string, MemberRole>>((acc, member) => {
          acc[member.memberId] = member.role;
          return acc;
        }, {})
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar dados da equipe.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [canManageTeam, session?.token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const displayedMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const name = member.user.fullName.toLowerCase();
      const email = member.user.email.toLowerCase();

      return name.includes(query) || email.includes(query);
    });
  }, [members, searchTerm]);

  const displayedInvitations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return pendingInvitations;
    }

    return pendingInvitations.filter((invitation) => {
      const projectsLabel = invitation.projects.map((project) => project.name).join(' ').toLowerCase();
      return (
        invitation.email.toLowerCase().includes(query) ||
        invitation.role.toLowerCase().includes(query) ||
        projectsLabel.includes(query)
      );
    });
  }, [pendingInvitations, searchTerm]);

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === 'OWNER').length,
    [members]
  );

  const canEditMember = useCallback(
    (member: OrganizationMemberSummary): boolean => {
      if (!session || !canManageTeam) {
        return false;
      }

      if (member.memberId === session.activeOrganization.memberId) {
        return false;
      }

      if (session.activeOrganization.role === 'ADMIN' && member.role === 'OWNER') {
        return false;
      }

      return true;
    },
    [canManageTeam, session]
  );

  const toggleInviteProject = (projectId: string) => {
    setInviteProjectIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((entry) => entry !== projectId);
      }

      return [...current, projectId];
    });
  };

  const handleInviteCollaborator = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !canManageTeam) {
      return;
    }

    if (inviteProjectIds.length === 0) {
      setErrorMessage('Selecione ao menos um projeto para o convite.');
      return;
    }

    setIsInviting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await api.inviteCollaborator(session.token, {
        email: inviteEmail.trim(),
        role: inviteRole,
        projectIds: inviteProjectIds
      });

      setPendingInvitations((current) => [result.invitation, ...current]);
      setInviteEmail('');
      setInviteRole('MEMBER');
      setInviteProjectIds([]);
      setShowInviteModal(false);
      setActiveTab('pending');

      if (result.emailSent) {
        setSuccessMessage('Convite enviado por e-mail com sucesso.');
      } else {
        setSuccessMessage('Convite criado, mas o envio de e-mail não foi confirmado pelo SMTP.');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível enviar o convite.');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (member: OrganizationMemberSummary) => {
    if (!session?.token || !canEditMember(member)) {
      return;
    }

    const nextRole = roleDrafts[member.memberId] ?? member.role;

    if (nextRole === member.role) {
      setRoleEditorFor(null);
      return;
    }

    setIsMutatingMemberId(member.memberId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await api.updateOrganizationMemberRole(session.token, member.memberId, {
        role: nextRole
      });

      setMembers((current) =>
        current.map((entry) => (entry.memberId === member.memberId ? updated : entry))
      );
      setRoleDrafts((current) => ({ ...current, [member.memberId]: updated.role }));
      setRoleEditorFor(null);
      setSuccessMessage('Papel do colaborador atualizado.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível atualizar o papel do colaborador.');
      }
    } finally {
      setIsMutatingMemberId(null);
    }
  };

  const handleRemoveMember = async (member: OrganizationMemberSummary) => {
    if (!session?.token || !canEditMember(member)) {
      return;
    }

    if (!window.confirm(`Remover ${member.user.fullName} da organização?`)) {
      return;
    }

    setIsMutatingMemberId(member.memberId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.removeOrganizationMember(session.token, member.memberId);
      setMembers((current) => current.filter((entry) => entry.memberId !== member.memberId));
      setRoleEditorFor(null);
      setSuccessMessage('Colaborador removido da organização.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível remover colaborador.');
      }
    } finally {
      setIsMutatingMemberId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Gestão da equipe"
        description="Convide colaboradores, controle papéis e mantenha acesso por projeto."
        actions={
          canManageTeam ? (
            <PageActions>
              <Button variant="secondary" onClick={() => setShowInviteModal(true)} className="gap-2">
                <UserPlus2 className="h-4 w-4" />
                Convidar colaborador
              </Button>
            </PageActions>
          ) : null
        }
      />

      <DataTable
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AppTabs
              value={activeTab}
              onChange={(value) => setActiveTab(value as TeamTab)}
              items={[
                { id: 'all', label: 'Todos os membros' },
                { id: 'pending', label: 'Convites pendentes' }
              ]}
            />
            <div className="w-full max-w-xs">
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar" />
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-app-muted">
              Mostrando {activeTab === 'all' ? displayedMembers.length : displayedInvitations.length} resultado(s)
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                disabled
                className="rounded-lg p-1 text-[#c2c6d4] disabled:opacity-60"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg p-1 text-[#c2c6d4] disabled:opacity-60"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      >
        {activeTab === 'all' ? (
          <>
            <thead>
              <tr className="border-b border-app bg-app/25">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Membro</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">E-mail</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Papel</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Entrada</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-app">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-app-muted" colSpan={5}>
                    Carregando membros...
                  </td>
                </tr>
              ) : null}

              {!isLoading && displayedMembers.length === 0 ? (
                <tr>
                  <td className="px-6 py-8" colSpan={5}>
                    <EmptyState
                      title="Nenhum membro encontrado"
                      description="Ajuste os filtros ou convide um novo colaborador."
                    />
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? displayedMembers.map((member) => {
                    const editable = canEditMember(member);
                    const busy = isMutatingMemberId === member.memberId;
                    const currentDraftRole = roleDrafts[member.memberId] ?? member.role;
                    const roleEditorOpen = roleEditorFor === member.memberId;

                    return (
                      <tr key={member.memberId} className="group transition-colors hover:bg-white/70">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-app bg-app text-sm font-semibold text-[#424752]">
                              {getInitial(member.user.fullName)}
                            </div>
                            <div className="text-sm font-semibold text-[#191c21]">{member.user.fullName}</div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-[#424752]">{member.user.email}</td>

                        <td className="px-6 py-4">
                          <RoleBadge role={member.role} />
                        </td>

                        <td className="px-6 py-4 text-sm text-[#424752]">{formatJoinDate(member.createdAt)}</td>

                        <td className="px-6 py-4 text-right">
                          {editable ? (
                            <div className="inline-flex items-center justify-end gap-2 transition-opacity group-hover:opacity-100 md:opacity-0">
                              {roleEditorOpen ? (
                                <>
                                  <select
                                    className="h-8 rounded-lg border border-app bg-white px-2 text-xs text-[#191c21]"
                                    value={currentDraftRole}
                                    onChange={(event) =>
                                      setRoleDrafts((current) => ({
                                        ...current,
                                        [member.memberId]: event.target.value as MemberRole
                                      }))
                                    }
                                    disabled={busy}
                                  >
                                    {roleOptions.map((role) => (
                                      <option key={role} value={role}>
                                        {roleLabel[role]}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => void handleUpdateRole(member)}
                                    disabled={busy}
                                    className="rounded-lg p-1.5 text-brand transition-colors hover:bg-app-active disabled:opacity-60"
                                    title="Salvar papel"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRoleEditorFor(null);
                                      setRoleDrafts((current) => ({
                                        ...current,
                                        [member.memberId]: member.role
                                      }));
                                    }}
                                    disabled={busy}
                                    className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-active disabled:opacity-60"
                                    title="Cancelar"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setRoleEditorFor(member.memberId)}
                                    disabled={busy}
                                    className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-active hover:text-brand disabled:opacity-60"
                                    title="Editar papel"
                                  >
                                    <Shield className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void handleRemoveMember(member)}
                                    disabled={busy}
                                    className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                                    title="Remover membro"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          ) : canManageTeam ? (
                            <div className="inline-flex items-center gap-1 text-[#c2c6d4]" title="Sem permissão para editar este membro">
                              <Lock className="h-4 w-4" />
                            </div>
                          ) : (
                            <span className="text-xs text-[#c2c6d4]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </>
        ) : (
          <>
            <thead>
              <tr className="border-b border-app bg-app/25">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">E-mail</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Papel</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Projetos</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Expira em</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.05em] text-app-muted">Convidado por</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-app">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-app-muted" colSpan={5}>
                    Carregando convites...
                  </td>
                </tr>
              ) : null}

              {!isLoading && displayedInvitations.length === 0 ? (
                <tr>
                  <td className="px-6 py-8" colSpan={5}>
                    <EmptyState
                      title="Nenhum convite pendente"
                      description="Novos convites aparecerão aqui até serem aceitos ou expirarem."
                    />
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? displayedInvitations.map((invitation) => (
                    <tr key={invitation.id} className="transition-colors hover:bg-white/70">
                      <td className="px-6 py-4 text-sm text-[#191c21]">{invitation.email}</td>
                      <td className="px-6 py-4">
                        <RoleBadge role={invitation.role} />
                      </td>
                      <td className="px-6 py-4 text-sm text-[#424752]">
                        {invitation.projects.map((project) => project.name).join(', ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#424752]">{formatJoinDate(invitation.expiresAt)}</td>
                      <td className="px-6 py-4 text-sm text-[#424752]">{invitation.invitedBy.name}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </>
        )}
      </DataTable>

      {(errorMessage || successMessage) ? (
        <div className="grid gap-3 md:grid-cols-2">
          {errorMessage ? (
            <p className="rounded-lg border border-[#ffdad6] bg-[#ffdad6]/40 px-4 py-3 text-sm text-[#93000a]">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75]">
              {successMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <AppModal
        open={showInviteModal && canManageTeam}
        title="Convidar colaborador"
        onClose={() => setShowInviteModal(false)}
        className="max-w-lg"
      >
        <form className="space-y-3" onSubmit={handleInviteCollaborator}>
          <FormField label="E-mail do colaborador">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#727783]" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d3dceb] bg-white pl-10 pr-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
                required
              />
            </div>
          </FormField>

          <FormField label="Papel">
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as MemberRole)}
              className="h-10 w-full rounded-xl border border-[#d3dceb] bg-white px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabel[role]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Projetos permitidos">
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-[#d3dceb] bg-white p-3">
              {projects.length === 0 ? (
                <p className="text-xs text-[#727783]">Nenhum projeto disponível para vincular.</p>
              ) : (
                projects.map((project) => {
                  const checked = inviteProjectIds.includes(project.id);

                  return (
                    <label key={project.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#191c21]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInviteProject(project.id)}
                        className="h-4 w-4 rounded-lg border-[#c4cede] text-[#005EB8] focus:ring-[#005EB8]"
                      />
                      <span>{project.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="subtle" onClick={() => setShowInviteModal(false)} className="text-[#424752]">
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={isInviting || projects.length === 0}>
              {isInviting ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </AppModal>
    </>
  );
}
