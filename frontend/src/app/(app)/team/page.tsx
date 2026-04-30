'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Shield,
  UserPlus2,
  UserRound,
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
import type { MemberRole, OrganizationMemberSummary } from '@/types/domain';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isMutatingMemberId, setIsMutatingMemberId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<TeamTab>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [roleDrafts, setRoleDrafts] = useState<Record<string, MemberRole>>({});
  const [roleEditorFor, setRoleEditorFor] = useState<string | null>(null);

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState<MemberRole>('MEMBER');

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

  const loadMembers = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await api.listOrganizationMembers(session.token);

      setMembers(payload.members);
      setRoleDrafts(
        payload.members.reduce<Record<string, MemberRole>>((acc, member) => {
          acc[member.memberId] = member.role;
          return acc;
        }, {})
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar a equipe.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const displayedMembers = useMemo(() => {
    if (activeTab === 'pending') {
      return [] as OrganizationMemberSummary[];
    }

    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const name = member.user.fullName.toLowerCase();
      const email = member.user.email.toLowerCase();

      return name.includes(query) || email.includes(query);
    });
  }, [activeTab, members, searchTerm]);

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

  const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !canManageTeam) {
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await api.addOrganizationMember(session.token, {
        fullName: memberName,
        email: memberEmail,
        password: memberPassword || undefined,
        role: memberRole
      });

      setMembers((current) => [...current, created]);
      setRoleDrafts((current) => ({ ...current, [created.memberId]: created.role }));
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      setMemberRole('MEMBER');
      setShowAddForm(false);
      setSuccessMessage('Colaborador adicionado com sucesso.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível adicionar colaborador.');
      }
    } finally {
      setIsAdding(false);
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
        description="Gerencie os membros da organização e seus níveis de acesso."
        actions={
          canManageTeam ? (
            <PageActions>
              <Button variant="secondary" onClick={() => setShowAddForm(true)} className="gap-2">
                <UserPlus2 className="h-4 w-4" />
                Adicionar colaborador
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
              onChange={(value) => setActiveTab(value)}
              items={[
                { id: 'all', label: 'Todos os membros' },
                { id: 'pending', label: 'Convites pendentes' }
              ]}
            />
            <div className="w-full max-w-xs">
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar membro" />
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-app-muted">
              Mostrando {displayedMembers.length === 0 ? 0 : 1} a {displayedMembers.length} de {displayedMembers.length} resultados
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                disabled
                className="rounded p-1 text-[#c2c6d4] disabled:opacity-60"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled
                className="rounded p-1 text-[#c2c6d4] disabled:opacity-60"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      >
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
                  title={activeTab === 'pending' ? 'Nenhum convite pendente' : 'Nenhum membro encontrado'}
                  description="Ajuste os filtros ou adicione um novo colaborador para a organização."
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
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[10px] border border-app bg-app text-sm font-semibold text-[#424752]">
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
                                className="h-8 rounded-md border border-app bg-white px-2 text-xs text-[#191c21]"
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
                                className="rounded-md p-1.5 text-brand transition-colors hover:bg-app-active disabled:opacity-60"
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
                                className="rounded-md p-1.5 text-app-muted transition-colors hover:bg-app-active disabled:opacity-60"
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
                                className="rounded-md p-1.5 text-app-muted transition-colors hover:bg-app-active hover:text-brand disabled:opacity-60"
                                title="Editar papel"
                              >
                                <Shield className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleRemoveMember(member)}
                                disabled={busy}
                                className="rounded-md p-1.5 text-app-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
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
      </DataTable>

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

              {!errorMessage && !successMessage ? (
                <p className="rounded-lg border border-[#e1e2ea] bg-white px-4 py-3 text-sm text-[#727783] md:col-span-2">
                  Organização: {session.activeOrganization.name} • Donos: {ownerCount} • Membros: {members.length}
                </p>
              ) : null}
            </div>
      <AppModal
        open={showAddForm && canManageTeam}
        title="Adicionar colaborador"
        onClose={() => setShowAddForm(false)}
        className="max-w-md"
      >
        <form className="space-y-3" onSubmit={handleAddMember}>
          <FormField label="Nome completo">
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#727783]" />
              <input
                type="text"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                className="h-10 w-full rounded-[10px] border border-[#d3dceb] bg-white pl-10 pr-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
                required
              />
            </div>
          </FormField>

          <FormField label="E-mail">
            <input
              type="email"
              value={memberEmail}
              onChange={(event) => setMemberEmail(event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[#d3dceb] bg-white px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
              required
            />
          </FormField>

          <FormField label="Senha inicial (opcional)">
            <input
              type="password"
              minLength={8}
              value={memberPassword}
              onChange={(event) => setMemberPassword(event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[#d3dceb] bg-white px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
            />
          </FormField>

          <FormField label="Papel">
            <select
              value={memberRole}
              onChange={(event) => setMemberRole(event.target.value as MemberRole)}
              className="h-10 w-full rounded-[10px] border border-[#d3dceb] bg-white px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005EB8] focus:ring-2 focus:ring-[#005EB8]/15"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabel[role]}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="subtle" onClick={() => setShowAddForm(false)} className="text-[#424752]">
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={isAdding}>
              {isAdding ? 'Salvando...' : 'Salvar colaborador'}
            </Button>
          </div>
        </form>
      </AppModal>
    </>
  );
}
