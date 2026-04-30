'use client';

import { ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { AiSearchChatPanel } from '@/components/ai-search/ai-search-chat-panel';
import { AiSearchEmptyState } from '@/components/ai-search/ai-search-empty-state';
import {
  AiSearchHistorySidebar,
  type AiSearchHistoryFilter
} from '@/components/ai-search/ai-search-history-sidebar';
import { AiSearchInput } from '@/components/ai-search/ai-search-input';
import { AiSearchLoading } from '@/components/ai-search/ai-search-loading';
import { AiSearchMessageList } from '@/components/ai-search/ai-search-message-list';
import { AiSearchProjectSelect } from '@/components/ai-search/ai-search-project-select';
import { AiSearchScopeSelector } from '@/components/ai-search/ai-search-scope-selector';
import { AiSearchThreadActions } from '@/components/ai-search/ai-search-thread-actions';
import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import type {
  AiSearchScope,
  AiSearchThreadDetail,
  AiSearchThreadSummary,
  ProjectSummary
} from '@/types/domain';

type AiSearchPageProps = {
  projectId?: string;
};

const ORGANIZATION_EMPTY_SUGGESTIONS = [
  'Quais decisões foram tomadas nos últimos projetos?',
  'Quais tarefas ainda estão pendentes?',
  'Quais cards vieram de reuniões?',
  'O que foi discutido sobre o FarolDAO?'
];

const PROJECT_EMPTY_SUGGESTIONS = [
  'Quais tarefas ainda estão pendentes neste projeto?',
  'Quais decisões foram tomadas nas reuniões?',
  'Quais cards vieram de reuniões?',
  'O que foi discutido sobre o dashboard?'
];

const filterThreads = (
  threads: AiSearchThreadSummary[],
  filter: AiSearchHistoryFilter
): AiSearchThreadSummary[] => {
  if (filter === 'ORGANIZATION') {
    return threads.filter((thread) => thread.scope === 'ORGANIZATION');
  }

  if (filter === 'PROJECTS') {
    return threads.filter((thread) => thread.scope === 'PROJECT');
  }

  return threads;
};

export const AiSearchPage = ({ projectId }: AiSearchPageProps) => {
  const session = useAppSession();
  const searchParams = useSearchParams();

  const isProjectScopedRoute = Boolean(projectId);
  const [scope, setScope] = useState<AiSearchScope>(projectId ? 'PROJECT' : 'ORGANIZATION');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [historyFilter, setHistoryFilter] = useState<AiSearchHistoryFilter>('ALL');

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const [threads, setThreads] = useState<AiSearchThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<AiSearchThreadDetail | null>(null);

  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingThreadDetail, setIsLoadingThreadDetail] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMutatingThread, setIsMutatingThread] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seedConsumed, setSeedConsumed] = useState(false);

  useConfigureAppShell({
    title: isProjectScopedRoute ? 'Pesquisa IA do projeto' : 'Pesquisa IA Central',
    searchPlaceholder: 'Buscar projetos, reuniões, cards, decisões ou arquivos'
  });

  const activeProjectId = useMemo(() => {
    if (isProjectScopedRoute) {
      return projectId;
    }

    if (scope === 'PROJECT') {
      return selectedProjectId || undefined;
    }

    return undefined;
  }, [isProjectScopedRoute, projectId, scope, selectedProjectId]);

  const projectNamesById = useMemo<Record<string, string>>(
    () => Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects]
  );

  const selectedProjectName = useMemo(() => {
    if (!activeProjectId) {
      return null;
    }

    return projectNamesById[activeProjectId] ?? threadDetail?.project?.name ?? null;
  }, [activeProjectId, projectNamesById, threadDetail?.project?.name]);

  const scopeValidationMessage =
    scope === 'PROJECT' && !activeProjectId ? 'Selecione um projeto para pesquisar neste escopo.' : null;

  const canAskInCurrentScope = !scopeValidationMessage;

  const filteredThreads = useMemo(() => {
    if (isProjectScopedRoute) {
      return threads;
    }

    return filterThreads(threads, historyFilter);
  }, [historyFilter, isProjectScopedRoute, threads]);

  const effectiveSuggestions = useMemo(() => {
    if (isProjectScopedRoute) {
      return PROJECT_EMPTY_SUGGESTIONS;
    }

    if (scope === 'PROJECT' && selectedProjectName) {
      return [
        `Quais tarefas ainda estão pendentes no projeto "${selectedProjectName}"?`,
        `Quais decisões foram tomadas nas reuniões do projeto "${selectedProjectName}"?`,
        `Quais cards vieram de reuniões no projeto "${selectedProjectName}"?`,
        `O que foi discutido sobre o dashboard no projeto "${selectedProjectName}"?`
      ];
    }

    return scope === 'PROJECT' ? PROJECT_EMPTY_SUGGESTIONS : ORGANIZATION_EMPTY_SUGGESTIONS;
  }, [isProjectScopedRoute, scope, selectedProjectName]);

  const latestQuestion = useMemo(() => searchParams.get('q')?.trim() ?? '', [searchParams]);

  const loadProjects = useCallback(async () => {
    if (!session?.token || isProjectScopedRoute) {
      return;
    }

    setIsLoadingProjects(true);

    try {
      const payload = await api.listProjects(session.token);
      setProjects(payload.projects);
    } catch {
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [isProjectScopedRoute, session?.token]);

  const loadThreads = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setIsLoadingThreads(true);

    try {
      const payload = await api.listAiSearchThreads(
        session.token,
        isProjectScopedRoute && projectId
          ? {
              projectId
            }
          : undefined
      );

      setThreads(payload.threads);

      setSelectedThreadId((current) => {
        if (!current) {
          return payload.threads[0]?.id ?? null;
        }

        const exists = payload.threads.some((thread) => thread.id === current);
        return exists ? current : (payload.threads[0]?.id ?? null);
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar o histórico da Pesquisa IA Central.');
      }
    } finally {
      setIsLoadingThreads(false);
    }
  }, [isProjectScopedRoute, projectId, session?.token]);

  const loadThreadDetail = useCallback(
    async (threadId: string) => {
      if (!session?.token) {
        return;
      }

      setIsLoadingThreadDetail(true);

      try {
        const detail = await api.getAiSearchThread(session.token, threadId);
        setThreadDetail(detail);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Não foi possível carregar a conversa selecionada.');
        }
      } finally {
        setIsLoadingThreadDetail(false);
      }
    },
    [session?.token]
  );

  useEffect(() => {
    if (isProjectScopedRoute && scope !== 'PROJECT') {
      setScope('PROJECT');
    }
  }, [isProjectScopedRoute, scope]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (isProjectScopedRoute) {
      return;
    }

    void loadProjects();
  }, [isProjectScopedRoute, loadProjects]);

  useEffect(() => {
    if (selectedThreadId) {
      void loadThreadDetail(selectedThreadId);
      return;
    }

    setThreadDetail(null);
  }, [loadThreadDetail, selectedThreadId]);

  const createThread = useCallback(async (): Promise<string | null> => {
    if (!session?.token) {
      return null;
    }

    if (scope === 'PROJECT' && !activeProjectId) {
      setErrorMessage('Selecione um projeto para pesquisar neste escopo.');
      return null;
    }

    setIsMutatingThread(true);

    try {
      const created = await api.createAiSearchThread(session.token, {
        scope,
        projectId: scope === 'PROJECT' ? activeProjectId : undefined
      });

      setThreads((current) => [created, ...current.filter((thread) => thread.id !== created.id)]);
      setSelectedThreadId(created.id);

      return created.id;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível criar uma nova pesquisa.');
      }

      return null;
    } finally {
      setIsMutatingThread(false);
    }
  }, [activeProjectId, scope, session?.token]);

  const submitQuestion = useCallback(
    async (question: string) => {
      if (!session?.token) {
        return;
      }

      if (!canAskInCurrentScope) {
        setErrorMessage('Selecione um projeto para pesquisar neste escopo.');
        return;
      }

      setErrorMessage(null);
      setIsSending(true);

      try {
        let threadId = selectedThreadId;

        if (!threadId) {
          threadId = await createThread();
        }

        if (!threadId) {
          return;
        }

        await api.sendAiSearchMessage(session.token, {
          threadId,
          question,
          scope,
          projectId: scope === 'PROJECT' ? activeProjectId ?? null : null
        });

        await Promise.all([loadThreads(), loadThreadDetail(threadId)]);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Falha ao enviar pergunta para a Pesquisa IA Central.');
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      activeProjectId,
      canAskInCurrentScope,
      createThread,
      loadThreadDetail,
      loadThreads,
      scope,
      selectedThreadId,
      session?.token
    ]
  );

  const handleArchiveThread = useCallback(async () => {
    if (!session?.token || !selectedThreadId) {
      return;
    }

    setIsMutatingThread(true);

    try {
      await api.archiveAiSearchThread(session.token, selectedThreadId);

      setThreadDetail(null);
      setSelectedThreadId(null);
      await loadThreads();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível arquivar este histórico.');
      }
    } finally {
      setIsMutatingThread(false);
    }
  }, [loadThreads, selectedThreadId, session?.token]);

  const handleDeleteThread = useCallback(async () => {
    if (!session?.token || !selectedThreadId) {
      return;
    }

    const confirmed = window.confirm('Deseja apagar este histórico de pesquisa?');

    if (!confirmed) {
      return;
    }

    setIsMutatingThread(true);

    try {
      await api.deleteAiSearchThread(session.token, selectedThreadId);

      setThreadDetail(null);
      setSelectedThreadId(null);
      await loadThreads();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível apagar este histórico.');
      }
    } finally {
      setIsMutatingThread(false);
    }
  }, [loadThreads, selectedThreadId, session?.token]);

  useEffect(() => {
    if (!latestQuestion || seedConsumed || isSending) {
      return;
    }

    setSeedConsumed(true);
    void submitQuestion(latestQuestion);
  }, [isSending, latestQuestion, seedConsumed, submitQuestion]);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);

    if (isProjectScopedRoute) {
      return;
    }

    const selected = threads.find((thread) => thread.id === threadId);

    if (!selected) {
      return;
    }

    setScope(selected.scope);

    if (selected.scope === 'PROJECT') {
      setSelectedProjectId(selected.project?.id ?? '');
      return;
    }

    setSelectedProjectId('');
  };

  const messages = threadDetail?.messages ?? [];
  const showProjectOrigin = threadDetail?.scope === 'ORGANIZATION';

  const title = isProjectScopedRoute ? 'Pesquisa IA do projeto' : 'Pesquisa IA Central';
  const description = isProjectScopedRoute
    ? 'Converse com a IA sobre reuniões, tarefas, arquivos e decisões deste projeto.'
    : 'Pesquise em toda a organização ou em um projeto específico.';

  return (
    <div className="flex min-h-[calc(100vh-190px)] min-w-0 flex-col overflow-hidden rounded-[12px] border border-[#e3e8f2] bg-white shadow-[0_14px_34px_rgba(10,40,78,0.06)] md:flex-row">
      <AiSearchHistorySidebar
        threads={filteredThreads}
        selectedThreadId={selectedThreadId}
        isLoading={isLoadingThreads}
        onSelectThread={handleSelectThread}
        onCreateThread={() => {
          void createThread();
        }}
        showFilters={!isProjectScopedRoute}
        filter={historyFilter}
        onFilterChange={setHistoryFilter}
      />

      <AiSearchChatPanel
        title={title}
        description={description}
        actions={
          threadDetail ? (
            <AiSearchThreadActions
              disabled={isMutatingThread || isSending}
              onArchive={handleArchiveThread}
              onDelete={handleDeleteThread}
            />
          ) : null
        }
        scopeControls={
          !isProjectScopedRoute ? (
            <div className="rounded-xl border border-[#dbe3f0] bg-[#fbfdff] p-4">
              <p className="text-xs font-semibold text-[#667085]">Escopo da pesquisa</p>

              <div className="mt-3">
                <AiSearchScopeSelector
                  scope={scope}
                  allowOrganizationScope
                  allowProjectScope
                  onChange={(nextScope) => {
                    setScope(nextScope);
                    setSelectedThreadId(null);
                    setThreadDetail(null);
                  }}
                />

                {scope === 'PROJECT' ? (
                  <AiSearchProjectSelect
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    isLoading={isLoadingProjects}
                    onChange={(nextProjectId) => {
                      setSelectedProjectId(nextProjectId);
                      setSelectedThreadId(null);
                      setThreadDetail(null);
                    }}
                  />
                ) : null}

                {scopeValidationMessage ? <p className="mt-2 text-xs text-[#8b5e15]">{scopeValidationMessage}</p> : null}
              </div>
            </div>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-3 py-1 text-xs font-semibold text-[#005eb8]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Pesquisando apenas neste projeto
              </span>
            </div>
          )
        }
        errorMessage={errorMessage}
        isMutatingThread={isMutatingThread}
        body={
          isLoadingThreadDetail ? (
            <AiSearchLoading label="Carregando conversa..." />
          ) : messages.length > 0 ? (
            <AiSearchMessageList
              messages={messages}
              isAnswering={isSending}
              showProjectOrigin={showProjectOrigin}
              projectNamesById={projectNamesById}
            />
          ) : (
            <AiSearchEmptyState
              title={
                isProjectScopedRoute
                  ? 'Pergunte sobre este projeto.'
                  : 'Pesquise em toda a organização ou em um projeto específico.'
              }
              description={
                isProjectScopedRoute
                  ? 'Busque decisões, tarefas, reuniões, arquivos e cards vinculados a este projeto.'
                  : 'Faça perguntas sobre reuniões, decisões, tarefas, cards, arquivos e projetos.'
              }
              suggestions={effectiveSuggestions}
              onUseSuggestion={(question) => {
                void submitQuestion(question);
              }}
            />
          )
        }
        input={
          <AiSearchInput
            disabled={isMutatingThread || !canAskInCurrentScope}
            isSending={isSending}
            onSubmit={submitQuestion}
            initialValue={latestQuestion && !seedConsumed ? latestQuestion : ''}
            disabledReason={scopeValidationMessage}
            placeholder="Pergunte sobre reuniões, decisões, tarefas, arquivos e projetos."
          />
        }
      />
    </div>
  );
};
