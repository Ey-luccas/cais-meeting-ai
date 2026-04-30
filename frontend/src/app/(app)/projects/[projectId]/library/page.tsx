'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  BookOpenText,
  Download,
  FileText,
  FileUp,
  Folder,
  FolderPlus,
  Pencil,
  RefreshCw,
  Tag,
  Trash2
} from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { formatBytes, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  LibraryDocumentType,
  LibraryFolder,
  LibraryItemOrigin,
  LibraryItemStatus,
  LibraryItemSummary,
  LibraryItemType,
  LibraryTag,
  ProjectDetail
} from '@/types/domain';

type MainFilter = 'all' | 'documents' | 'files' | 'minutes' | 'draft' | 'archived';

type DocumentFormState = {
  title: string;
  description: string;
  folderId: string;
  documentType: LibraryDocumentType;
  contentMarkdown: string;
  tagIds: string[];
};

type UploadFormState = {
  file: File | null;
  title: string;
  description: string;
  folderId: string;
  tagIds: string[];
};

type EditItemFormState = {
  title: string;
  description: string;
  folderId: string;
  documentType: LibraryDocumentType | '';
  tagIds: string[];
};

const PROJECT_WRITER_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);
const PROJECT_ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

const MAIN_FILTERS: Array<{ id: MainFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'documents', label: 'Documentos' },
  { id: 'files', label: 'Arquivos' },
  { id: 'minutes', label: 'Atas' },
  { id: 'draft', label: 'Rascunhos' },
  { id: 'archived', label: 'Arquivados' }
];

const DOCUMENT_TYPE_LABEL: Record<LibraryDocumentType, string> = {
  MEETING_MINUTES: 'Ata',
  SCOPE: 'Escopo',
  REQUIREMENTS: 'Requisitos',
  PLANNING: 'Planejamento',
  PROPOSAL: 'Proposta',
  TECHNICAL: 'Técnico',
  MANUAL: 'Manual',
  DECISION_RECORD: 'Registro de decisão',
  ACTION_PLAN: 'Plano de ação',
  OTHER: 'Outro'
};

const STATUS_LABEL: Record<LibraryItemStatus, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado'
};

const ORIGIN_LABEL: Record<LibraryItemOrigin, string> = {
  MANUAL: 'Manual',
  AI: 'IA',
  MEETING: 'Reunião',
  UPLOAD: 'Upload'
};

const TYPE_LABEL: Record<LibraryItemType, string> = {
  DOCUMENT: 'Documento',
  FILE: 'Arquivo'
};

const getRelativeTime = (isoDate: string): string => {
  const parsed = new Date(isoDate).getTime();

  if (Number.isNaN(parsed)) {
    return 'agora';
  }

  const diffSeconds = Math.floor((Date.now() - parsed) / 1000);

  if (diffSeconds < 60) {
    return 'agora';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `há ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `há ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
};

const toggleTag = (current: string[], tagId: string): string[] => {
  if (current.includes(tagId)) {
    return current.filter((id) => id !== tagId);
  }

  return [...current, tagId];
};

const buildDownload = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

export default function ProjectLibraryPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedItemId = searchParams.get('item');
  const session = useAppSession();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [items, setItems] = useState<LibraryItemSummary[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);

  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSubmittingDocument, setIsSubmittingDocument] = useState(false);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mainFilter, setMainFilter] = useState<MainFilter>('all');
  const [originFilter, setOriginFilter] = useState<'ALL' | LibraryItemOrigin>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LibraryItemStatus>('ALL');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  const [documentForm, setDocumentForm] = useState<DocumentFormState>({
    title: '',
    description: '',
    folderId: '',
    documentType: 'OTHER',
    contentMarkdown: '',
    tagIds: []
  });

  const [uploadForm, setUploadForm] = useState<UploadFormState>({
    file: null,
    title: '',
    description: '',
    folderId: '',
    tagIds: []
  });

  const [folderForm, setFolderForm] = useState({
    name: '',
    parentId: ''
  });

  const [tagForm, setTagForm] = useState({
    name: '',
    color: '#005EB8'
  });

  const [editingItem, setEditingItem] = useState<LibraryItemSummary | null>(null);
  const [editItemForm, setEditItemForm] = useState<EditItemFormState>({
    title: '',
    description: '',
    folderId: '',
    documentType: '',
    tagIds: []
  });

  useConfigureAppShell({
    title: 'Biblioteca',
    project: projectId ? { id: projectId, name: project?.name ?? 'Projeto', color: project?.color } : undefined
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const canWrite = useMemo(() => {
    if (!session) {
      return false;
    }

    if (session.activeOrganization.role === 'OWNER' || session.activeOrganization.role === 'ADMIN') {
      return true;
    }

    const membership = project?.members.find((member) => member.user.id === session.user.id);
    return Boolean(membership && PROJECT_WRITER_ROLES.has(membership.role));
  }, [project?.members, session]);

  const canAdmin = useMemo(() => {
    if (!session) {
      return false;
    }

    if (session.activeOrganization.role === 'OWNER' || session.activeOrganization.role === 'ADMIN') {
      return true;
    }

    const membership = project?.members.find((member) => member.user.id === session.user.id);
    return Boolean(membership && PROJECT_ADMIN_ROLES.has(membership.role));
  }, [project?.members, session]);

  const loadBaseData = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoadingBase(true);
    setErrorMessage(null);

    try {
      const [projectPayload, foldersPayload, tagsPayload] = await Promise.all([
        api.getProject(session.token, projectId),
        api.listLibraryFolders(session.token, projectId),
        api.listLibraryTags(session.token, projectId)
      ]);

      setProject(projectPayload);
      setFolders(foldersPayload.folders);
      setTags(tagsPayload.tags);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar a biblioteca do projeto.');
      }
    } finally {
      setIsLoadingBase(false);
    }
  }, [projectId, session?.token]);

  const loadItems = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoadingItems(true);
    setErrorMessage(null);

    let typeFilter: LibraryItemType | undefined;
    let derivedStatusFilter: LibraryItemStatus | undefined;

    if (mainFilter === 'documents' || mainFilter === 'minutes') {
      typeFilter = 'DOCUMENT';
    }

    if (mainFilter === 'files') {
      typeFilter = 'FILE';
    }

    if (mainFilter === 'draft') {
      derivedStatusFilter = 'DRAFT';
    }

    if (mainFilter === 'archived') {
      derivedStatusFilter = 'ARCHIVED';
    }

    if (statusFilter !== 'ALL') {
      derivedStatusFilter = statusFilter;
    }

    try {
      const response = await api.listLibraryItems(session.token, projectId, {
        q: debouncedSearch || undefined,
        type: typeFilter,
        origin: originFilter === 'ALL' ? undefined : originFilter,
        status: derivedStatusFilter,
        folderId: folderFilter === 'all' ? undefined : folderFilter,
        tagId: tagFilter === 'all' ? undefined : tagFilter
      });

      const nextItems = mainFilter === 'minutes'
        ? response.items.filter((item) => item.documentType === 'MEETING_MINUTES')
        : response.items;

      setItems(nextItems);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível listar os itens da biblioteca.');
      }
    } finally {
      setIsLoadingItems(false);
    }
  }, [debouncedSearch, folderFilter, mainFilter, originFilter, projectId, session?.token, statusFilter, tagFilter]);

  useEffect(() => {
    if (!projectId || !session?.token) {
      return;
    }

    void loadBaseData();
  }, [loadBaseData, projectId, session?.token]);

  useEffect(() => {
    if (!projectId || !session?.token) {
      return;
    }

    void loadItems();
  }, [loadItems, projectId, session?.token]);

  const resetDocumentForm = () => {
    setDocumentForm({
      title: '',
      description: '',
      folderId: '',
      documentType: 'OTHER',
      contentMarkdown: '',
      tagIds: []
    });
  };

  const resetUploadForm = () => {
    setUploadForm({
      file: null,
      title: '',
      description: '',
      folderId: '',
      tagIds: []
    });
  };

  const handleRefresh = async () => {
    setSuccessMessage(null);
    await Promise.all([loadBaseData(), loadItems()]);
  };

  const handleCreateDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    setIsSubmittingDocument(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await api.createLibraryDocument(session.token, projectId, {
        title: documentForm.title.trim(),
        description: documentForm.description.trim() ? documentForm.description.trim() : null,
        folderId: documentForm.folderId || null,
        tagIds: documentForm.tagIds,
        documentType: documentForm.documentType,
        contentMarkdown: documentForm.contentMarkdown.trim() ? documentForm.contentMarkdown : null
      });

      setShowDocumentModal(false);
      resetDocumentForm();
      setSuccessMessage('Documento criado com sucesso.');
      router.push(`/projects/${projectId}/library/documents/${created.id}` as Route);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível criar o documento.');
      }
    } finally {
      setIsSubmittingDocument(false);
    }
  };

  const handleUploadFile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canWrite || !uploadForm.file) {
      return;
    }

    setIsSubmittingUpload(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.uploadLibraryFile(session.token, projectId, {
        file: uploadForm.file,
        title: uploadForm.title.trim() || undefined,
        description: uploadForm.description.trim() || null,
        folderId: uploadForm.folderId || null,
        tagIds: uploadForm.tagIds
      });

      setShowUploadModal(false);
      resetUploadForm();
      setSuccessMessage('Arquivo enviado para a biblioteca.');
      await loadItems();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível enviar o arquivo.');
      }
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  const handleCreateFolder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canAdmin) {
      return;
    }

    setIsSubmittingFolder(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.createLibraryFolder(session.token, projectId, {
        name: folderForm.name.trim(),
        parentId: folderForm.parentId || null
      });

      setShowFolderModal(false);
      setFolderForm({ name: '', parentId: '' });
      setSuccessMessage('Pasta criada com sucesso.');
      await loadBaseData();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível criar a pasta.');
      }
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleCreateTag = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canAdmin) {
      return;
    }

    setIsSubmittingTag(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.createLibraryTag(session.token, projectId, {
        name: tagForm.name.trim(),
        color: tagForm.color
      });

      setShowTagModal(false);
      setTagForm({ name: '', color: '#005EB8' });
      setSuccessMessage('Etiqueta criada com sucesso.');
      await loadBaseData();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível criar a etiqueta.');
      }
    } finally {
      setIsSubmittingTag(false);
    }
  };

  const handleArchiveItem = async (item: LibraryItemSummary) => {
    if (!session?.token || !projectId || !canAdmin) {
      return;
    }

    if (!window.confirm(`Arquivar "${item.title}"?`)) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.archiveLibraryItem(session.token, projectId, item.id);
      setSuccessMessage('Item arquivado.');
      await loadItems();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível arquivar o item.');
      }
    }
  };

  const handleDeleteItem = async (item: LibraryItemSummary) => {
    if (!session?.token || !projectId || !canAdmin) {
      return;
    }

    if (!window.confirm(`Excluir "${item.title}" da biblioteca?`)) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.deleteLibraryItem(session.token, projectId, item.id);
      setSuccessMessage('Item excluído da biblioteca.');
      await loadItems();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível excluir o item.');
      }
    }
  };

  const openEditModal = (item: LibraryItemSummary) => {
    setEditingItem(item);
    setEditItemForm({
      title: item.title,
      description: item.description ?? '',
      folderId: item.folderId ?? '',
      documentType: item.documentType ?? 'OTHER',
      tagIds: item.tags.map((tag) => tag.id)
    });
  };

  const handleUpdateItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canWrite || !editingItem) {
      return;
    }

    setIsSavingItem(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.updateLibraryItem(session.token, projectId, editingItem.id, {
        title: editItemForm.title.trim(),
        description: editItemForm.description.trim() ? editItemForm.description.trim() : null,
        folderId: editItemForm.folderId || null,
        documentType: editingItem.type === 'DOCUMENT' ? (editItemForm.documentType || 'OTHER') : undefined,
        tagIds: editItemForm.tagIds
      });

      setEditingItem(null);
      setSuccessMessage('Metadados atualizados.');
      await loadItems();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível atualizar o item.');
      }
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleExport = async (item: LibraryItemSummary, format: 'markdown' | 'docx') => {
    if (!session?.token || !projectId) {
      return;
    }

    setErrorMessage(null);

    try {
      const exported = await api.exportLibraryItem(session.token, projectId, item.id, format);
      buildDownload(exported.blob, exported.fileName);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível exportar o documento.');
      }
    }
  };

  const renderTagSelector = (
    selectedTagIds: string[],
    onToggle: (tagId: string) => void
  ) => {
    if (tags.length === 0) {
      return <p className="text-xs text-[#64748b]">Nenhuma etiqueta criada.</p>;
    }

    return (
      <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[#d9e2ef] bg-[#f8fbff] p-2">
        {tags.map((tag) => (
          <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-xs text-[#334155]">
            <input
              type="checkbox"
              checked={selectedTagIds.includes(tag.id)}
              onChange={() => onToggle(tag.id)}
            />
            <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
            {tag.name}
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca"
        description="Arquivos, atas e documentos vivos do projeto em um só lugar."
        actions={
          <>
            <Button variant="subtle" onClick={() => void handleRefresh()} disabled={isLoadingBase || isLoadingItems}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            {canWrite ? (
              <Button variant="subtle" onClick={() => setShowDocumentModal(true)}>
                <BookOpenText className="mr-2 h-4 w-4" />
                Novo documento
              </Button>
            ) : null}
            {canWrite ? (
              <Button variant="subtle" onClick={() => setShowUploadModal(true)}>
                <FileUp className="mr-2 h-4 w-4" />
                Enviar arquivo
              </Button>
            ) : null}
            {canAdmin ? (
              <Button variant="subtle" onClick={() => setShowFolderModal(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Nova pasta
              </Button>
            ) : null}
            {canAdmin ? (
              <Button variant="subtle" onClick={() => setShowTagModal(true)}>
                <Tag className="mr-2 h-4 w-4" />
                Nova etiqueta
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-xl border border-app bg-white p-4">
          <h3 className="text-sm font-semibold text-[#111827]">Pastas</h3>

          <button
            type="button"
            onClick={() => setFolderFilter('all')}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm',
              folderFilter === 'all' ? 'bg-[#eaf3ff] text-brand' : 'text-[#334155] hover:bg-[#f5f8fc]'
            )}
          >
            <span>Todos os itens</span>
            <span className="text-xs text-[#64748b]">{items.length}</span>
          </button>

          {folders.length === 0 ? (
            <p className="text-xs text-[#64748b]">Sem pastas cadastradas.</p>
          ) : (
            <div className="space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setFolderFilter(folder.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
                    folderFilter === folder.id ? 'bg-[#eaf3ff] text-brand' : 'text-[#334155] hover:bg-[#f5f8fc]'
                  )}
                >
                  <Folder className="h-4 w-4" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="space-y-4">
          <div className="space-y-3 rounded-xl border border-app bg-white p-4">
            <FilterPills value={mainFilter} items={MAIN_FILTERS} onChange={setMainFilter} />

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
              <Input
                placeholder="Buscar por título ou conteúdo"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              <select
                value={originFilter}
                onChange={(event) => setOriginFilter(event.target.value as 'ALL' | LibraryItemOrigin)}
                className="h-10 rounded-[10px] border border-app px-3 text-sm"
              >
                <option value="ALL">Origem: todas</option>
                <option value="MANUAL">Manual</option>
                <option value="AI">IA</option>
                <option value="MEETING">Reunião</option>
                <option value="UPLOAD">Upload</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'ALL' | LibraryItemStatus)}
                className="h-10 rounded-[10px] border border-app px-3 text-sm"
              >
                <option value="ALL">Status: todos</option>
                <option value="DRAFT">Rascunho</option>
                <option value="PUBLISHED">Publicado</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>

              <select
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                className="h-10 rounded-[10px] border border-app px-3 text-sm"
              >
                <option value="all">Etiqueta: todas</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingBase || isLoadingItems ? <LoadingSkeleton lines={6} /> : null}

          {!isLoadingBase && !isLoadingItems && errorMessage && items.length === 0 ? (
            <ErrorState message={errorMessage} />
          ) : null}

          {!isLoadingItems && !errorMessage && items.length === 0 ? (
            <EmptyState
              title="Nenhum item na biblioteca."
              description="Envie arquivos ou crie documentos para organizar o conhecimento deste projeto."
              icon={BookOpenText}
              action={
                canWrite ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="subtle" onClick={() => setShowDocumentModal(true)}>
                      Criar documento
                    </Button>
                    <Button onClick={() => setShowUploadModal(true)}>Enviar arquivo</Button>
                  </div>
                ) : undefined
              }
            />
          ) : null}

          {!isLoadingItems && items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => {
                const documentRoute = `/projects/${projectId}/library/documents/${item.id}` as Route;

                return (
                  <article
                    key={item.id}
                    className={cn(
                      'rounded-xl border border-app bg-white p-4',
                      highlightedItemId === item.id && 'border-brand ring-2 ring-brand/10'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          {item.type === 'DOCUMENT' ? (
                            <FileText className="h-4 w-4 text-[#005eb8]" />
                          ) : (
                            <FileUp className="h-4 w-4 text-[#0f766e]" />
                          )}
                          <p className="truncate text-sm font-semibold text-[#111827]">{item.title}</p>
                        </div>

                        {item.description ? <p className="text-sm text-[#475569]">{item.description}</p> : null}

                        <div className="flex flex-wrap gap-2">
                          <StatusBadge label={TYPE_LABEL[item.type]} tone={item.type === 'DOCUMENT' ? 'info' : 'neutral'} />
                          <StatusBadge label={ORIGIN_LABEL[item.origin]} tone="neutral" />
                          <StatusBadge
                            label={STATUS_LABEL[item.status]}
                            tone={item.status === 'ARCHIVED' ? 'warning' : item.status === 'PUBLISHED' ? 'success' : 'neutral'}
                          />
                          {item.documentType ? <StatusBadge label={DOCUMENT_TYPE_LABEL[item.documentType]} tone="neutral" /> : null}
                        </div>

                        <div className="text-xs text-[#64748b]">
                          {item.folder ? `Pasta: ${item.folder.name}` : 'Sem pasta'} • {ORIGIN_LABEL[item.origin]} • {TYPE_LABEL[item.type]}
                        </div>

                        <div className="text-xs text-[#64748b]">
                          Atualizado {getRelativeTime(item.updatedAt)} ({formatDateTime(item.updatedAt)}) por {item.updatedBy?.name ?? item.createdBy.name}
                        </div>

                        {item.meeting ? (
                          <p className="text-xs text-[#475569]">Vínculo com reunião: {item.meeting.title}</p>
                        ) : null}

                        {item.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center gap-1 rounded-full border border-[#d9e2ef] bg-[#f8fbff] px-2 py-0.5 text-[11px] text-[#334155]"
                              >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {item.type === 'FILE' && item.fileName ? (
                          <p className="text-xs text-[#64748b]">
                            {item.fileName}
                            {item.sizeBytes ? ` • ${formatBytes(item.sizeBytes)}` : ''}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.type === 'DOCUMENT' ? (
                          <>
                            <Button asChild size="sm" variant="subtle">
                              <Link href={documentRoute}>Abrir</Link>
                            </Button>
                            <Button asChild size="sm" variant="subtle">
                              <Link href={documentRoute}>Editar</Link>
                            </Button>
                            <Button size="sm" variant="subtle" onClick={() => void handleExport(item, 'markdown')}>
                              <Download className="mr-1 h-3.5 w-3.5" />
                              Markdown
                            </Button>
                            <Button size="sm" variant="subtle" onClick={() => void handleExport(item, 'docx')}>
                              <Download className="mr-1 h-3.5 w-3.5" />
                              DOCX
                            </Button>
                          </>
                        ) : (
                          <>
                            {item.fileUrl ? (
                              <Button asChild size="sm" variant="subtle">
                                <a href={item.fileUrl} target="_blank" rel="noreferrer">
                                  Abrir/Baixar
                                </a>
                              </Button>
                            ) : null}
                            {canWrite ? (
                              <Button size="sm" variant="subtle" onClick={() => openEditModal(item)}>
                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                Editar
                              </Button>
                            ) : null}
                          </>
                        )}

                        {canAdmin && item.status !== 'ARCHIVED' ? (
                          <Button size="sm" variant="subtle" onClick={() => void handleArchiveItem(item)}>
                            <Archive className="mr-1 h-3.5 w-3.5" />
                            Arquivar
                          </Button>
                        ) : null}

                        {canAdmin ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="border border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => void handleDeleteItem(item)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        ) : null}

                        {item.type === 'DOCUMENT' && canWrite ? (
                          <Button size="sm" variant="subtle" onClick={() => openEditModal(item)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Metadados
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      {!canWrite ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#7c5800]">
          Seu perfil está em leitura. Você pode visualizar os itens publicados da biblioteca.
        </div>
      ) : null}

      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p>
      ) : null}

      {errorMessage && items.length > 0 ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <AppModal
        open={showDocumentModal}
        onClose={() => {
          if (!isSubmittingDocument) {
            setShowDocumentModal(false);
          }
        }}
        title="Novo documento"
        description="Crie um documento editável dentro da biblioteca do projeto."
      >
        <form className="space-y-3" onSubmit={handleCreateDocument}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Título</label>
            <Input
              value={documentForm.title}
              onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))}
              minLength={2}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Descrição</label>
            <Textarea
              value={documentForm.description}
              onChange={(event) => setDocumentForm((current) => ({ ...current, description: event.target.value }))}
              rows={2}
              placeholder="Descrição opcional"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#334155]">Tipo do documento</label>
              <select
                value={documentForm.documentType}
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    documentType: event.target.value as LibraryDocumentType
                  }))
                }
                className="h-10 w-full rounded-[10px] border border-app px-3 text-sm"
              >
                {Object.entries(DOCUMENT_TYPE_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#334155]">Pasta</label>
              <select
                value={documentForm.folderId}
                onChange={(event) => setDocumentForm((current) => ({ ...current, folderId: event.target.value }))}
                className="h-10 w-full rounded-[10px] border border-app px-3 text-sm"
              >
                <option value="">Sem pasta</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Etiquetas</label>
            {renderTagSelector(documentForm.tagIds, (tagId) =>
              setDocumentForm((current) => ({
                ...current,
                tagIds: toggleTag(current.tagIds, tagId)
              }))
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Conteúdo inicial (opcional)</label>
            <Textarea
              value={documentForm.contentMarkdown}
              onChange={(event) => setDocumentForm((current) => ({ ...current, contentMarkdown: event.target.value }))}
              rows={8}
              placeholder="# Introdução"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="subtle"
              onClick={() => setShowDocumentModal(false)}
              disabled={isSubmittingDocument}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmittingDocument || documentForm.title.trim().length < 2}>
              {isSubmittingDocument ? 'Criando...' : 'Criar documento'}
            </Button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={showUploadModal}
        onClose={() => {
          if (!isSubmittingUpload) {
            setShowUploadModal(false);
          }
        }}
        title="Enviar arquivo"
        description="Envie anexos e materiais para a biblioteca do projeto."
      >
        <form className="space-y-3" onSubmit={handleUploadFile}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Arquivo</label>
            <Input
              type="file"
              onChange={(event) =>
                setUploadForm((current) => ({
                  ...current,
                  file: event.target.files?.[0] ?? null
                }))
              }
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#334155]">Título (opcional)</label>
              <Input
                value={uploadForm.title}
                onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#334155]">Pasta</label>
              <select
                value={uploadForm.folderId}
                onChange={(event) => setUploadForm((current) => ({ ...current, folderId: event.target.value }))}
                className="h-10 w-full rounded-[10px] border border-app px-3 text-sm"
              >
                <option value="">Sem pasta</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Descrição</label>
            <Textarea
              value={uploadForm.description}
              onChange={(event) => setUploadForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              placeholder="Descrição curta do arquivo"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Etiquetas</label>
            {renderTagSelector(uploadForm.tagIds, (tagId) =>
              setUploadForm((current) => ({
                ...current,
                tagIds: toggleTag(current.tagIds, tagId)
              }))
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="subtle"
              onClick={() => setShowUploadModal(false)}
              disabled={isSubmittingUpload}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmittingUpload || !uploadForm.file}>
              {isSubmittingUpload ? 'Enviando...' : 'Enviar arquivo'}
            </Button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={showFolderModal}
        onClose={() => {
          if (!isSubmittingFolder) {
            setShowFolderModal(false);
          }
        }}
        title="Nova pasta"
        description="Organize os itens da biblioteca em pastas."
      >
        <form className="space-y-3" onSubmit={handleCreateFolder}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Nome da pasta</label>
            <Input
              value={folderForm.name}
              onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Pasta pai (opcional)</label>
            <select
              value={folderForm.parentId}
              onChange={(event) => setFolderForm((current) => ({ ...current, parentId: event.target.value }))}
              className="h-10 w-full rounded-[10px] border border-app px-3 text-sm"
            >
              <option value="">Raiz</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="subtle"
              onClick={() => setShowFolderModal(false)}
              disabled={isSubmittingFolder}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmittingFolder || folderForm.name.trim().length < 1}>
              {isSubmittingFolder ? 'Criando...' : 'Criar pasta'}
            </Button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={showTagModal}
        onClose={() => {
          if (!isSubmittingTag) {
            setShowTagModal(false);
          }
        }}
        title="Nova etiqueta"
        description="Use etiquetas para classificar materiais da biblioteca."
      >
        <form className="space-y-3" onSubmit={handleCreateTag}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Nome da etiqueta</label>
            <Input
              value={tagForm.name}
              onChange={(event) => setTagForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Cor</label>
            <div className="flex items-center gap-3 rounded-[10px] border border-app px-3 py-2">
              <input
                type="color"
                value={tagForm.color}
                onChange={(event) => setTagForm((current) => ({ ...current, color: event.target.value }))}
                className="h-8 w-10 rounded border border-app"
              />
              <Input
                value={tagForm.color}
                onChange={(event) => setTagForm((current) => ({ ...current, color: event.target.value }))}
                className="h-8"
                pattern="^#([A-Fa-f0-9]{6})$"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="subtle"
              onClick={() => setShowTagModal(false)}
              disabled={isSubmittingTag}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmittingTag || tagForm.name.trim().length < 1}>
              {isSubmittingTag ? 'Criando...' : 'Criar etiqueta'}
            </Button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={Boolean(editingItem)}
        onClose={() => {
          if (!isSavingItem) {
            setEditingItem(null);
          }
        }}
        title={editingItem?.type === 'DOCUMENT' ? 'Editar documento' : 'Editar arquivo'}
        description="Atualize metadados, pasta e etiquetas."
      >
        <form className="space-y-3" onSubmit={handleUpdateItem}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Título</label>
            <Input
              value={editItemForm.title}
              onChange={(event) => setEditItemForm((current) => ({ ...current, title: event.target.value }))}
              minLength={2}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Descrição</label>
            <Textarea
              value={editItemForm.description}
              onChange={(event) => setEditItemForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#334155]">Pasta</label>
              <select
                value={editItemForm.folderId}
                onChange={(event) => setEditItemForm((current) => ({ ...current, folderId: event.target.value }))}
                className="h-10 w-full rounded-[10px] border border-app px-3 text-sm"
              >
                <option value="">Sem pasta</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            {editingItem?.type === 'DOCUMENT' ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#334155]">Tipo do documento</label>
                <select
                  value={editItemForm.documentType || 'OTHER'}
                  onChange={(event) =>
                    setEditItemForm((current) => ({
                      ...current,
                      documentType: event.target.value as LibraryDocumentType
                    }))
                  }
                  className="h-10 w-full rounded-[10px] border border-app px-3 text-sm"
                >
                  {Object.entries(DOCUMENT_TYPE_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Etiquetas</label>
            {renderTagSelector(editItemForm.tagIds, (tagId) =>
              setEditItemForm((current) => ({
                ...current,
                tagIds: toggleTag(current.tagIds, tagId)
              }))
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setEditingItem(null)} disabled={isSavingItem}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSavingItem || editItemForm.title.trim().length < 2}>
              {isSavingItem ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
