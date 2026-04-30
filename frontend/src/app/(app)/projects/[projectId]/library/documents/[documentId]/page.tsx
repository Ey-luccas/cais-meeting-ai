'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Archive, ArrowLeft, Download, Eye, EyeOff, Save, Trash2 } from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { formatDateTime } from '@/lib/format';
import type {
  LibraryDocumentType,
  LibraryItemDetail,
  LibraryItemStatus,
  LibraryTag,
  ProjectDetail
} from '@/types/domain';

const PROJECT_WRITER_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);
const PROJECT_ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

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

const ORIGIN_LABEL = {
  MANUAL: 'Manual',
  AI: 'IA',
  MEETING: 'Reunião',
  UPLOAD: 'Upload'
} as const;

type DocumentFormState = {
  title: string;
  description: string;
  contentMarkdown: string;
  documentType: LibraryDocumentType;
  status: Extract<LibraryItemStatus, 'DRAFT' | 'PUBLISHED'>;
  folderId: string;
  tagIds: string[];
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

export default function LibraryDocumentDetailPage() {
  const params = useParams<{ projectId: string; documentId: string }>();
  const projectId = params?.projectId;
  const documentId = params?.documentId;
  const router = useRouter();
  const session = useAppSession();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [documentItem, setDocumentItem] = useState<LibraryItemDetail | null>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);

  const [form, setForm] = useState<DocumentFormState>({
    title: '',
    description: '',
    contentMarkdown: '',
    documentType: 'OTHER',
    status: 'DRAFT',
    folderId: '',
    tagIds: []
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useConfigureAppShell({
    title: documentItem?.title ?? 'Documento',
    project: projectId ? { id: projectId, name: project?.name ?? 'Projeto', color: project?.color } : undefined
  });

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

  const loadData = useCallback(async () => {
    if (!session?.token || !projectId || !documentId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [projectPayload, itemPayload, folderPayload, tagPayload] = await Promise.all([
        api.getProject(session.token, projectId),
        api.getLibraryItem(session.token, projectId, documentId),
        api.listLibraryFolders(session.token, projectId),
        api.listLibraryTags(session.token, projectId)
      ]);

      if (itemPayload.type !== 'DOCUMENT') {
        setErrorMessage('Este item não é um documento editável.');
        setDocumentItem(null);
        return;
      }

      setProject(projectPayload);
      setDocumentItem(itemPayload);
      setFolders(folderPayload.folders.map((folder) => ({ id: folder.id, name: folder.name })));
      setTags(tagPayload.tags);
      setForm({
        title: itemPayload.title,
        description: itemPayload.description ?? '',
        contentMarkdown: itemPayload.contentMarkdown ?? '',
        documentType: itemPayload.documentType ?? 'OTHER',
        status: itemPayload.status === 'ARCHIVED' ? 'DRAFT' : itemPayload.status,
        folderId: itemPayload.folderId ?? '',
        tagIds: itemPayload.tags.map((tag) => tag.id)
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar o documento da biblioteca.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [documentId, projectId, session?.token]);

  useEffect(() => {
    if (!projectId || !documentId || !session?.token) {
      return;
    }

    void loadData();
  }, [documentId, loadData, projectId, session?.token]);

  const persistDocument = async (status?: Extract<LibraryItemStatus, 'DRAFT' | 'PUBLISHED'>) => {
    if (!session?.token || !projectId || !documentId || !canWrite) {
      return;
    }

    setErrorMessage(null);

    const payloadStatus = status ?? form.status;

    const updated = await api.updateLibraryItem(session.token, projectId, documentId, {
      title: form.title.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      folderId: form.folderId || null,
      documentType: form.documentType,
      status: payloadStatus,
      contentMarkdown: form.contentMarkdown,
      tagIds: form.tagIds
    });

    setDocumentItem(updated);
    setForm((current) => ({
      ...current,
      status: updated.status === 'ARCHIVED' ? 'DRAFT' : updated.status
    }));
  };

  const handleSave = async () => {
    if (!canWrite) {
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);

    try {
      await persistDocument();
      setSuccessMessage('Documento salvo com sucesso.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível salvar o documento.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!canWrite) {
      return;
    }

    setIsPublishing(true);
    setSuccessMessage(null);

    try {
      await persistDocument('PUBLISHED');
      setSuccessMessage('Documento publicado.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível publicar o documento.');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!session?.token || !projectId || !documentId || !canAdmin || !documentItem) {
      return;
    }

    if (!window.confirm(`Arquivar \"${documentItem.title}\"?`)) {
      return;
    }

    setIsArchiving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const archived = await api.archiveLibraryItem(session.token, projectId, documentId);
      setDocumentItem(archived);
      setSuccessMessage('Documento arquivado.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível arquivar o documento.');
      }
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.token || !projectId || !documentId || !canAdmin || !documentItem) {
      return;
    }

    if (!window.confirm(`Excluir \"${documentItem.title}\" da biblioteca?`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await api.deleteLibraryItem(session.token, projectId, documentId);
      router.push(`/projects/${projectId}/library` as Route);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível excluir o documento.');
      }
      setIsDeleting(false);
    }
  };

  const handleExport = async (format: 'markdown' | 'docx') => {
    if (!session?.token || !projectId || !documentId) {
      return;
    }

    setErrorMessage(null);

    try {
      const exported = await api.exportLibraryItem(session.token, projectId, documentId, format);
      buildDownload(exported.blob, exported.fileName);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível exportar o documento.');
      }
    }
  };

  if (isLoading) {
    return <LoadingSkeleton lines={8} />;
  }

  if (errorMessage && !documentItem) {
    return <ErrorState message={errorMessage} />;
  }

  if (!documentItem) {
    return <ErrorState message="Documento não encontrado." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={documentItem.title}
        description="Edite, publique e exporte o documento vivo da biblioteca do projeto."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="subtle">
              <Link href={`/projects/${projectId}/library` as Route}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para biblioteca
              </Link>
            </Button>

            <Button variant="subtle" onClick={() => void handleExport('markdown')}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Markdown
            </Button>

            <Button variant="subtle" onClick={() => void handleExport('docx')}>
              <Download className="mr-2 h-4 w-4" />
              Exportar DOCX
            </Button>

            {canWrite ? (
              <Button variant="subtle" onClick={() => setShowPreview((current) => !current)}>
                {showPreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showPreview ? 'Ocultar preview' : 'Mostrar preview'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="rounded-xl border border-app bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={STATUS_LABEL[documentItem.status]} tone={documentItem.status === 'PUBLISHED' ? 'success' : documentItem.status === 'ARCHIVED' ? 'warning' : 'neutral'} />
          <StatusBadge label={ORIGIN_LABEL[documentItem.origin]} tone="neutral" />
          <StatusBadge label={DOCUMENT_TYPE_LABEL[documentItem.documentType ?? 'OTHER']} tone="info" />
          {documentItem.meeting ? <StatusBadge label={`Reunião: ${documentItem.meeting.title}`} tone="neutral" /> : null}
        </div>

        <p className="mt-2 text-xs text-[#64748b]">
          Atualizado em {formatDateTime(documentItem.updatedAt)} por {documentItem.updatedBy?.name ?? documentItem.createdBy.name}
        </p>
      </div>

      <section className="rounded-xl border border-app bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Título</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              disabled={!canWrite}
              minLength={2}
              className="h-10 w-full rounded-[10px] border border-app px-3 text-sm disabled:bg-[#f8fafc]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Status</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as Extract<LibraryItemStatus, 'DRAFT' | 'PUBLISHED'>
                }))
              }
              disabled={!canWrite}
              className="h-10 w-full rounded-[10px] border border-app px-3 text-sm disabled:bg-[#f8fafc]"
            >
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#334155]">Tipo do documento</label>
            <select
              value={form.documentType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  documentType: event.target.value as LibraryDocumentType
                }))
              }
              disabled={!canWrite}
              className="h-10 w-full rounded-[10px] border border-app px-3 text-sm disabled:bg-[#f8fafc]"
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
              value={form.folderId}
              onChange={(event) => setForm((current) => ({ ...current, folderId: event.target.value }))}
              disabled={!canWrite}
              className="h-10 w-full rounded-[10px] border border-app px-3 text-sm disabled:bg-[#f8fafc]"
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

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-[#334155]">Descrição</label>
          <Textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            disabled={!canWrite}
            placeholder="Descrição do documento"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-[#334155]">Etiquetas</label>
          {tags.length === 0 ? (
            <p className="text-xs text-[#64748b]">Nenhuma etiqueta cadastrada.</p>
          ) : (
            <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[#d9e2ef] bg-[#f8fbff] p-2">
              {tags.map((tag) => (
                <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-xs text-[#334155]">
                  <input
                    type="checkbox"
                    checked={form.tagIds.includes(tag.id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        tagIds: toggleTag(current.tagIds, tag.id)
                      }))
                    }
                    disabled={!canWrite}
                  />
                  <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-app bg-white p-4">
        <label className="mb-2 block text-xs font-semibold text-[#334155]">Conteúdo (Markdown)</label>
        <Textarea
          value={form.contentMarkdown}
          onChange={(event) => setForm((current) => ({ ...current, contentMarkdown: event.target.value }))}
          rows={20}
          disabled={!canWrite}
          placeholder="# Documento"
          className="font-mono text-sm"
        />

        {showPreview ? (
          <div className="mt-4 rounded-xl border border-[#d9e2ef] bg-[#f8fbff] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748b]">Preview</p>
            <pre className="whitespace-pre-wrap text-sm text-[#0f172a]">{form.contentMarkdown || 'Sem conteúdo.'}</pre>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {canWrite ? (
          <Button onClick={() => void handleSave()} disabled={isSaving || form.title.trim().length < 2}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        ) : null}

        {canWrite ? (
          <Button variant="subtle" onClick={() => void handlePublish()} disabled={isPublishing || form.title.trim().length < 2}>
            {isPublishing ? 'Publicando...' : 'Publicar'}
          </Button>
        ) : null}

        {canAdmin ? (
          <Button variant="subtle" onClick={() => void handleArchive()} disabled={isArchiving}>
            <Archive className="mr-2 h-4 w-4" />
            {isArchiving ? 'Arquivando...' : 'Arquivar'}
          </Button>
        ) : null}

        {canAdmin ? (
          <Button
            variant="ghost"
            className="border border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        ) : null}
      </div>

      {!canWrite ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#7c5800]">
          Seu perfil está em leitura para este documento.
        </p>
      ) : null}

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p>
      ) : null}
    </div>
  );
}
