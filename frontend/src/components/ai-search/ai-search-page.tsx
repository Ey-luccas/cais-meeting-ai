'use client';

import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { AiSearchChatPanel } from '@/components/ai-search/ai-search-chat-panel';
import { AiSearchEmptyState } from '@/components/ai-search/ai-search-empty-state';
import { AiSearchHistoryModal } from '@/components/ai-search/ai-search-history-modal';
import { AiSearchHistorySidebar } from '@/components/ai-search/ai-search-history-sidebar';
import { AiSearchInput } from '@/components/ai-search/ai-search-input';
import { AiSearchLoading } from '@/components/ai-search/ai-search-loading';
import { AiSearchMessageList } from '@/components/ai-search/ai-search-message-list';
import { AiSearchProjectSelect } from '@/components/ai-search/ai-search-project-select';
import { AiSearchScopeSelector } from '@/components/ai-search/ai-search-scope-selector';
import { AiSearchThreadActions } from '@/components/ai-search/ai-search-thread-actions';
import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export const AiSearchPage = ({ projectId }: AiSearchPageProps) => {
  const session = useAppSession();
  const searchParams = useSearchParams();

  const isProjectScopedRoute = Boolean(projectId);
  const [scope, setScope] = useState<AiSearchScope>(projectId ? 'PROJECT' : 'ORGANIZATION');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isScopePanelCollapsed, setIsScopePanelCollapsed] = useState(false);
  const [isRecommendationsCollapsed, setIsRecommendationsCollapsed] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [renameThreadTarget, setRenameThreadTarget] = useState<AiSearchThreadSummary | null>(null);
  const [renameThreadTitle, setRenameThreadTitle] = useState('');

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
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads]
  );
  const isDraftQuestionEmpty = draftQuestion.trim().length === 0;
  const showEmptyStateSuggestions = isDraftQuestionEmpty && !isRecommendationsCollapsed;
  const canRestoreEmptyStateSuggestions = isDraftQuestionEmpty && isRecommendationsCollapsed;

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

  useEffect(() => {
    setIsRecommendationsCollapsed(false);
    setDraftQuestion('');
  }, [selectedThreadId]);

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
        setIsScopePanelCollapsed(true);
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

  const handleArchiveThread = useCallback(
    async (threadId?: string) => {
      if (!session?.token) {
        return;
      }

      const targetThreadId = threadId ?? selectedThreadId;

      if (!targetThreadId) {
        return;
      }

      setIsMutatingThread(true);

      try {
        await api.archiveAiSearchThread(session.token, targetThreadId);

        if (targetThreadId === selectedThreadId) {
          setThreadDetail(null);
          setSelectedThreadId(null);
        }

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
    },
    [loadThreads, selectedThreadId, session?.token]
  );

  const handleDeleteThread = useCallback(
    async (threadId?: string) => {
      if (!session?.token) {
        return;
      }

      const targetThreadId = threadId ?? selectedThreadId;

      if (!targetThreadId) {
        return;
      }

      const targetThreadTitle = threads.find((thread) => thread.id === targetThreadId)?.title ?? 'esta pesquisa';
      const confirmed = window.confirm(`Deseja apagar "${targetThreadTitle}"?`);

      if (!confirmed) {
        return;
      }

      setIsMutatingThread(true);

      try {
        await api.deleteAiSearchThread(session.token, targetThreadId);

        if (targetThreadId === selectedThreadId) {
          setThreadDetail(null);
          setSelectedThreadId(null);
        }

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
    },
    [loadThreads, selectedThreadId, session?.token, threads]
  );

  const handleRenameThread = useCallback(async () => {
    if (!session?.token || !renameThreadTarget) {
      return;
    }

    const nextTitle = renameThreadTitle.trim();

    if (nextTitle.length < 2) {
      setErrorMessage('O nome da pesquisa precisa ter ao menos 2 caracteres.');
      return;
    }

    setIsMutatingThread(true);
    setErrorMessage(null);

    try {
      const updated = await api.updateAiSearchThread(session.token, renameThreadTarget.id, {
        title: nextTitle
      });

      setThreads((current) =>
        current.map((thread) =>
          thread.id === updated.id
            ? {
                ...thread,
                title: updated.title,
                updatedAt: updated.updatedAt
              }
            : thread
        )
      );

      setThreadDetail((current) =>
        current && current.id === updated.id
          ? {
              ...current,
              title: updated.title,
              updatedAt: updated.updatedAt
            }
          : current
      );

      setRenameThreadTarget(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível renomear a pesquisa.');
      }
    } finally {
      setIsMutatingThread(false);
    }
  }, [renameThreadTarget, renameThreadTitle, session?.token]);

  useEffect(() => {
    if (!renameThreadTarget) {
      setRenameThreadTitle('');
      return;
    }

    setRenameThreadTitle(renameThreadTarget.title);
  }, [renameThreadTarget]);

  useEffect(() => {
    if (!latestQuestion || seedConsumed || isSending) {
      return;
    }

    setSeedConsumed(true);
    void submitQuestion(latestQuestion);
  }, [isSending, latestQuestion, seedConsumed, submitQuestion]);

  useEffect(() => {
    if ((threadDetail?.messages?.length ?? 0) > 0) {
      setIsScopePanelCollapsed(true);
    }
  }, [threadDetail?.messages?.length]);

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

  const handleOpenRenameThread = (thread: AiSearchThreadSummary) => {
    setRenameThreadTarget(thread);
    setRenameThreadTitle(thread.title);
  };

  const messages = threadDetail?.messages ?? [];
  const showProjectOrigin = true;
  const sourceProjectNamesById = useMemo(() => {
    if (!threadDetail?.project) {
      return projectNamesById;
    }

    return {
      ...projectNamesById,
      [threadDetail.project.id]: threadDetail.project.name
    };
  }, [projectNamesById, threadDetail?.project]);

  const title = isProjectScopedRoute ? 'Pesquisa IA do projeto' : 'Pesquisa IA Central';
  const panelTitle = threadDetail?.title ?? activeThread?.title ?? title;
  const scopeTitle = scope === 'PROJECT' ? selectedProjectName ?? 'Projeto específico' : 'Toda a organização';
  const scopeSubtitle =
    scope === 'PROJECT'
      ? selectedProjectName
        ? 'Pesquisa restrita ao projeto escolhido.'
        : 'Escolha um projeto para concluir a seleção.'
      : 'Pesquisa em projetos, reuniões, cards, arquivos e decisões permitidos.';

  return (
    <div className="flex min-h-[calc(100vh-190px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e3e8f2] bg-white shadow-[0_14px_34px_rgba(10,40,78,0.06)] md:flex-row">
      <AiSearchHistorySidebar
        threads={threads}
        selectedThreadId={selectedThreadId}
        isLoading={isLoadingThreads}
        isCollapsed={isHistoryCollapsed}
        onSelectThread={handleSelectThread}
        onCreateThread={() => {
          void createThread();
        }}
        onOpenSearchModal={() => setIsHistoryModalOpen(true)}
        onToggleCollapse={() => setIsHistoryCollapsed((current) => !current)}
      />

      <AiSearchChatPanel
        title={panelTitle}
        description={null}
        actions={
          activeThread ? (
            <AiSearchThreadActions
              disabled={isMutatingThread || isSending}
              onRename={() => handleOpenRenameThread(activeThread)}
              onArchive={handleArchiveThread}
              onDelete={handleDeleteThread}
            />
          ) : null
        }
        scopeControls={
          !isProjectScopedRoute ? (
            <div className="rounded-xl border border-[#dbe3f0] bg-[#fbfdff] p-4">
              {isScopePanelCollapsed ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#667085]">Escopo da pesquisa</p>
                    <p className="truncate text-sm font-semibold text-[#111827]">{scopeTitle}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-[#64748b]">{scopeSubtitle}</p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsScopePanelCollapsed(false)}
                    className="h-8 w-8 shrink-0 rounded-full text-[#005eb8]"
                    aria-label="Expandir escopo"
                    title="Expandir escopo"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#667085]">Escopo da pesquisa</p>
                      <p className="mt-1 text-sm font-semibold text-[#111827]">{scopeTitle}</p>
                      <p className="mt-1 text-xs text-[#64748b]">{scopeSubtitle}</p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsScopePanelCollapsed(true)}
                      className="h-8 w-8 shrink-0 rounded-full text-[#005eb8]"
                      aria-label="Minimizar escopo"
                      title="Minimizar escopo"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                  </div>

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

                    {scope === 'ORGANIZATION' ? (
                      <p className="mt-2 text-xs text-[#64748b]">
                        A pesquisa considera apenas os projetos que você tem permissão para acessar.
                      </p>
                    ) : null}

                    {scopeValidationMessage ? <p className="mt-2 text-xs text-[#8b5e15]">{scopeValidationMessage}</p> : null}
                  </div>
                </>
              )}
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
              projectNamesById={sourceProjectNamesById}
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
              showSuggestions={showEmptyStateSuggestions}
              canRestoreSuggestions={canRestoreEmptyStateSuggestions}
              onDismissSuggestions={() => setIsRecommendationsCollapsed(true)}
              onRestoreSuggestions={() => setIsRecommendationsCollapsed(false)}
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
            onValueChange={setDraftQuestion}
            resetKey={selectedThreadId ?? 'new'}
            initialValue={latestQuestion && !seedConsumed ? latestQuestion : ''}
            disabledReason={scopeValidationMessage}
            placeholder="Pergunte sobre reuniões, decisões, tarefas, arquivos e projetos."
          />
        }
      />
      <AiSearchHistoryModal
        open={isHistoryModalOpen}
        threads={threads}
        selectedThreadId={selectedThreadId}
        isLoading={isLoadingThreads}
        isBusy={isMutatingThread}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectThread={handleSelectThread}
        onCreateThread={createThread}
        onRequestRename={handleOpenRenameThread}
        onRequestArchive={(thread) => {
          void handleArchiveThread(thread.id);
        }}
        onRequestDelete={(thread) => {
          void handleDeleteThread(thread.id);
        }}
      />

      <AppModal
        open={renameThreadTarget !== null}
        onClose={() => setRenameThreadTarget(null)}
        title="Renomear pesquisa"
        description="Escolha um nome curto e fácil de encontrar."
        className="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            value={renameThreadTitle}
            onChange={(event) => setRenameThreadTitle(event.target.value)}
            placeholder="Nome da pesquisa"
            maxLength={160}
            autoFocus
          />

          <div className="flex items-center justify-end gap-2 border-t border-[#e5eaf4] pt-4">
            <Button type="button" variant="subtle" onClick={() => setRenameThreadTarget(null)} disabled={isMutatingThread}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleRenameThread()} disabled={isMutatingThread}>
              Salvar
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
};
