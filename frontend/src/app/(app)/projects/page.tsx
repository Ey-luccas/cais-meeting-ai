'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';
import {
  Plus
} from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageActions } from '@/components/layout/page-actions';
import { PageHeader } from '@/components/layout/page-header';
import { ProjectCard } from '@/components/project/project-card';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type { ProjectSummary } from '@/types/domain';

export default function ProjectsPage() {
  const session = useAppSession();

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#1565C0');

  useConfigureAppShell({
    title: 'Projetos',
    searchValue: searchTerm,
    searchPlaceholder: 'Buscar projetos por nome ou descrição',
    onSearchChange: setSearchTerm
  });

  const canManageProjects = session?.activeOrganization.role !== 'VIEWER';

  const fetchProjects = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await api.listProjects(session.token);
      const sorted = [...payload.projects].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setProjects(sorted);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar os projetos.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

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

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !canManageProjects) {
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await api.createProject(session.token, {
        name,
        description: description || undefined,
        color: color || undefined
      });

      setProjects((current) => [created, ...current]);
      setName('');
      setDescription('');
      setColor('#1565C0');
      setShowCreateModal(false);
      setSuccessMessage('Projeto criado com quadro e colunas padrão.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível criar o projeto.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Gerencie e acesse todos os espaços de reuniões com IA."
        actions={
          <PageActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => canManageProjects && setShowCreateModal(true)}
              disabled={!canManageProjects}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo projeto
            </Button>
          </PageActions>
        }
      />

            {isLoading ? (
              <div className="rounded-[10px] border border-[#dfe5ef] bg-white px-4 py-3 text-sm text-[#475569]">
                Carregando projetos...
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {!isLoading && filteredProjects.length === 0 ? (
                <div className="md:col-span-2 lg:col-span-3">
                  <EmptyState
                    title="Nenhum projeto encontrado"
                    description="Crie seu primeiro projeto para organizar reuniões, arquivos e tarefas."
                  />
                </div>
              ) : null}

              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  href={`/projects/${project.id}` as Route}
                />
              ))}

              {canManageProjects ? (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="group flex min-h-[260px] h-full flex-col items-center justify-center rounded-[10px] border border-dashed border-[#cdd7e7] bg-[#f8faff] p-6 text-center transition-colors hover:bg-[#f1f6fd]"
                >
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#dbe3f0] bg-white transition-transform group-hover:scale-105">
                    <Plus className="h-5 w-5 text-[#005eb8]" />
                  </span>
                  <h3 className="mb-1 text-base font-semibold text-[#111827]">Criar novo projeto</h3>
                  <p className="max-w-[220px] text-sm text-[#475569]">
                    Inicie um novo espaço para suas reuniões com IA.
                  </p>
                </button>
              ) : null}
            </div>

            {errorMessage ? (
              <p className="rounded-[10px] border border-[#ffdad6] bg-[#ffefed] px-4 py-3 text-sm text-[#93000a]">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="rounded-[10px] border border-[#d6e3ff] bg-[#eef5ff] px-4 py-3 text-sm text-[#003a75]">
                {successMessage}
              </p>
            ) : null}
      <AppModal open={showCreateModal && canManageProjects} title="Novo projeto" onClose={() => setShowCreateModal(false)}>
        <form className="space-y-4" onSubmit={handleCreateProject}>
          <FormField label="Nome do projeto">
            <Input
              placeholder="Ex: FarolDAO"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </FormField>

          <FormField label="Descrição">
            <textarea
              placeholder="Descrição estratégica"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="w-full rounded-[10px] border border-[#d3dceb] bg-white px-3.5 py-3 text-sm text-[#111827] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
          </FormField>

          <FormField label="Cor">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-11 w-14 rounded-[10px] border border-app bg-white p-1"
              />
              <Input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#1565C0"
                pattern="^#([A-Fa-f0-9]{6})$"
                required
              />
            </div>
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="subtle"
              onClick={() => setShowCreateModal(false)}
              className="text-[#424752]"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={isCreating}>
              {isCreating ? 'Criando...' : 'Criar projeto'}
            </Button>
          </div>
        </form>
      </AppModal>
    </>
  );
}
