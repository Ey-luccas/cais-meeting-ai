import type {
  AiSearchAskResponse,
  AiSearchThreadDetail,
  AiSearchThreadSummary,
  BoardCard,
  BoardResponse,
  LibraryDocumentType,
  LibraryFolder,
  LibraryItemDetail,
  LibraryItemOrigin,
  LibraryItemStatus,
  LibraryItemSummary,
  LibraryItemType,
  LibraryTag,
  MeetingDetail,
  MeetingObservation,
  MeetingSummary,
  NotificationRecord,
  OrganizationDashboardResponse,
  OrganizationMemberSummary,
  OrganizationOverview,
  ProjectDetail,
  ProjectFileRecord,
  ProjectReportsResponse,
  ProjectLink,
  ProjectMemberSummary,
  ProjectSummary,
  SessionResponse
} from '@/types/domain';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(
  /\/+$/,
  ''
);

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | string;
  token?: string;
};

type ApiErrorPayload = {
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const request = async <T>(path: string, options?: RequestOptions): Promise<T> => {
  const headers = new Headers(options?.headers ?? {});

  if (options?.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  if (typeof options?.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }

    throw new ApiError(payload?.message ?? 'Falha na comunicação com a API.', response.status, payload?.details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const api = {
  registerOrganization: (input: {
    organizationName: string;
    organizationSlug: string;
    organizationEmail?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  }) =>
    request<SessionResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input)
    }),

  login: (input: { email: string; password: string; organizationSlug?: string }) =>
    request<SessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    }),

  getSession: (token?: string) =>
    request<SessionResponse>('/auth/session', {
      token
    }),

  updateProfile: async (
    token: string,
    payload: {
      phone?: string | null;
      avatar?: File;
      removeAvatar?: boolean;
    }
  ) => {
    const body = new FormData();

    if (payload.phone !== undefined) {
      body.append('phone', payload.phone ?? '');
    }

    if (payload.removeAvatar) {
      body.append('removeAvatar', 'true');
    }

    if (payload.avatar) {
      body.append('avatar', payload.avatar);
    }

    return request<SessionResponse>('/auth/profile', {
      method: 'PATCH',
      token,
      body
    });
  },

  logout: (token?: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      token
    }),

  getCurrentOrganization: (token: string) =>
    request<OrganizationOverview>('/organizations/current', {
      token
    }),

  getOrganizationDashboard: (token: string, days = 30) => {
    const query = new URLSearchParams();
    query.set('days', String(days));

    return request<OrganizationDashboardResponse>(
      `/organizations/current/dashboard?${query.toString()}`,
      { token }
    );
  },

  listOrganizationMembers: (token: string) =>
    request<{ members: OrganizationMemberSummary[] }>('/organizations/current/members', {
      token
    }),

  addOrganizationMember: (
    token: string,
    payload: {
      fullName: string;
      email: string;
      password?: string;
      role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    }
  ) =>
    request<OrganizationMemberSummary>('/organizations/current/members', {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  updateOrganizationMemberRole: (
    token: string,
    memberId: string,
    payload: {
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    }
  ) =>
    request<OrganizationMemberSummary>(`/organizations/current/members/${memberId}/role`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  removeOrganizationMember: (token: string, memberId: string) =>
    request<void>(`/organizations/current/members/${memberId}`, {
      method: 'DELETE',
      token
    }),

  listProjects: (token: string) =>
    request<{ projects: ProjectSummary[] }>('/projects', {
      token
    }),

  createProject: (
    token: string,
    payload: {
      name: string;
      description?: string;
      color?: string;
    }
  ) =>
    request<ProjectSummary>('/projects', {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  getProject: (token: string, projectId: string) =>
    request<ProjectDetail>(`/projects/${projectId}`, {
      token
    }),

  getProjectReports: (token: string, projectId: string, days = 30) => {
    const query = new URLSearchParams();
    query.set('days', String(days));

    return request<ProjectReportsResponse>(`/projects/${projectId}/reports?${query.toString()}`, {
      token
    });
  },

  updateProject: (
    token: string,
    projectId: string,
    payload: {
      name?: string;
      description?: string | null;
      color?: string | null;
    }
  ) =>
    request<ProjectDetail>(`/projects/${projectId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  deleteProject: (token: string, projectId: string) =>
    request<void>(`/projects/${projectId}`, {
      method: 'DELETE',
      token
    }),

  listProjectMembers: (token: string, projectId: string) =>
    request<{ members: ProjectMemberSummary[] }>(`/projects/${projectId}/members`, {
      token
    }),

  addProjectMember: (
    token: string,
    projectId: string,
    payload: {
      organizationMemberId: string;
      role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    }
  ) =>
    request<ProjectMemberSummary>(`/projects/${projectId}/members`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  updateProjectMemberRole: (
    token: string,
    projectId: string,
    memberId: string,
    payload: {
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    }
  ) =>
    request<ProjectMemberSummary>(`/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  removeProjectMember: (token: string, projectId: string, memberId: string) =>
    request<void>(`/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
      token
    }),

  getBoard: (token: string, projectId: string) =>
    request<BoardResponse>(`/projects/${projectId}/board`, {
      token
    }),

  createColumn: (token: string, projectId: string, payload: { title: string }) =>
    request<{ id: string; title: string; position: number }>(`/projects/${projectId}/board/columns`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  updateColumn: (token: string, projectId: string, columnId: string, payload: { title: string }) =>
    request<{ id: string; title: string; position: number }>(`/projects/${projectId}/board/columns/${columnId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  reorderColumns: (token: string, projectId: string, orderedColumnIds: string[]) =>
    request<void>(`/projects/${projectId}/board/columns/reorder`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ orderedColumnIds })
    }),

  deleteColumn: (token: string, projectId: string, columnId: string) =>
    request<void>(`/projects/${projectId}/board/columns/${columnId}`, {
      method: 'DELETE',
      token
    }),

  createCard: (
    token: string,
    projectId: string,
    payload: {
      boardColumnId: string;
      meetingId?: string;
      title: string;
      description?: string;
      sourceType?: 'MANUAL' | 'AI';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
      dueDate?: string | null;
      assigneeUserIds?: string[];
      labelIds?: string[];
    }
  ) =>
    request<BoardCard>(`/projects/${projectId}/board/cards`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  reorderCards: (
    token: string,
    projectId: string,
    payload: {
      cardId: string;
      sourceColumnId: string;
      destinationColumnId: string;
      sourceOrderedCardIds: string[];
      destinationOrderedCardIds: string[];
    }
  ) =>
    request<void>(`/projects/${projectId}/board/cards/reorder`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  updateCard: (
    token: string,
    projectId: string,
    cardId: string,
    payload: {
      boardColumnId?: string;
      meetingId?: string | null;
      title?: string;
      description?: string | null;
      sourceType?: 'MANUAL' | 'AI';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
      dueDate?: string | null;
      assigneeUserIds?: string[];
      labelIds?: string[];
    }
  ) =>
    request<BoardCard>(`/projects/${projectId}/board/cards/${cardId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  deleteCard: (token: string, projectId: string, cardId: string) =>
    request<void>(`/projects/${projectId}/board/cards/${cardId}`, {
      method: 'DELETE',
      token
    }),

  addChecklist: (token: string, projectId: string, cardId: string, title: string) =>
    request<BoardCard>(`/projects/${projectId}/board/cards/${cardId}/checklists`, {
      method: 'POST',
      token,
      body: JSON.stringify({ title })
    }),

  updateChecklist: (token: string, projectId: string, checklistId: string, title: string) =>
    request<BoardCard>(`/projects/${projectId}/board/checklists/${checklistId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ title })
    }),

  removeChecklist: (token: string, projectId: string, checklistId: string) =>
    request<BoardCard>(`/projects/${projectId}/board/checklists/${checklistId}`, {
      method: 'DELETE',
      token
    }),

  addChecklistItem: (token: string, projectId: string, checklistId: string, content: string) =>
    request<BoardCard>(`/projects/${projectId}/board/checklists/${checklistId}/items`, {
      method: 'POST',
      token,
      body: JSON.stringify({ content })
    }),

  reorderChecklistItems: (
    token: string,
    projectId: string,
    checklistId: string,
    orderedItemIds: string[]
  ) =>
    request<BoardCard>(`/projects/${projectId}/board/checklists/${checklistId}/items/reorder`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ orderedItemIds })
    }),

  updateChecklistItem: (
    token: string,
    projectId: string,
    itemId: string,
    payload: { isCompleted?: boolean; content?: string }
  ) =>
    request<BoardCard>(`/projects/${projectId}/board/checklist-items/${itemId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  removeChecklistItem: (token: string, projectId: string, itemId: string) =>
    request<BoardCard>(`/projects/${projectId}/board/checklist-items/${itemId}`, {
      method: 'DELETE',
      token
    }),

  addComment: (token: string, projectId: string, cardId: string, content: string) =>
    request<BoardCard>(`/projects/${projectId}/board/cards/${cardId}/comments`, {
      method: 'POST',
      token,
      body: JSON.stringify({ content })
    }),

  addLink: (
    token: string,
    projectId: string,
    cardId: string,
    payload: { title: string; url: string }
  ) =>
    request<BoardCard>(`/projects/${projectId}/board/cards/${cardId}/links`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  updateLink: (
    token: string,
    projectId: string,
    linkId: string,
    payload: { title: string; url: string }
  ) =>
    request<BoardCard>(`/projects/${projectId}/board/links/${linkId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  removeLink: (token: string, projectId: string, linkId: string) =>
    request<BoardCard>(`/projects/${projectId}/board/links/${linkId}`, {
      method: 'DELETE',
      token
    }),

  addAttachment: async (token: string, projectId: string, cardId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);

    return request<BoardCard>(`/projects/${projectId}/board/cards/${cardId}/attachments`, {
      method: 'POST',
      token,
      body
    });
  },

  removeAttachment: (token: string, projectId: string, attachmentId: string) =>
    request<BoardCard>(`/projects/${projectId}/board/attachments/${attachmentId}`, {
      method: 'DELETE',
      token
    }),

  createLabel: (
    token: string,
    projectId: string,
    payload: {
      name: string;
      color: string;
    }
  ) =>
    request<{ id: string; name: string; color: string }>(`/projects/${projectId}/board/labels`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  updateLabel: (
    token: string,
    projectId: string,
    labelId: string,
    payload: {
      name: string;
      color: string;
    }
  ) =>
    request<{ id: string; name: string; color: string }>(`/projects/${projectId}/board/labels/${labelId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  removeLabel: (token: string, projectId: string, labelId: string) =>
    request<void>(`/projects/${projectId}/board/labels/${labelId}`, {
      method: 'DELETE',
      token
    }),

  listMeetings: (token: string, projectId: string) =>
    request<{ meetings: MeetingSummary[] }>(`/projects/${projectId}/meetings`, {
      token
    }),

  getMeeting: (token: string, meetingId: string) =>
    request<MeetingDetail>(`/meetings/${meetingId}`, {
      token
    }),

  createMeeting: async (
    token: string,
    projectId: string,
    payload: {
      title: string;
      description?: string;
      audio?: File;
    }
  ) => {
    const body = new FormData();
    body.append('title', payload.title);

    if (payload.description) {
      body.append('description', payload.description);
    }

    if (payload.audio) {
      body.append('audio', payload.audio);
    }

    return request<MeetingDetail>(`/projects/${projectId}/meetings`, {
      method: 'POST',
      token,
      body
    });
  },

  deleteMeeting: (token: string, meetingId: string) =>
    request<void>(`/meetings/${meetingId}`, {
      method: 'DELETE',
      token
    }),

  uploadMeetingAudio: async (token: string, meetingId: string, audio: File) => {
    const body = new FormData();
    body.append('audio', audio);

    return request<MeetingDetail>(`/meetings/${meetingId}/upload`, {
      method: 'POST',
      token,
      body
    });
  },

  addMeetingObservation: (
    token: string,
    meetingId: string,
    payload: {
      timestampSeconds?: number;
      type?: 'NOTE' | 'TASK' | 'QUESTION' | 'IMPORTANT' | 'DECISION';
      content: string;
    }
  ) =>
    request<MeetingObservation>(`/meetings/${meetingId}/observations`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  processMeeting: (token: string, meetingId: string) =>
    request<MeetingDetail>(`/meetings/${meetingId}/process`, {
      method: 'POST',
      token
    }),

  listProjectFiles: (token: string, projectId: string) =>
    request<{ files: ProjectFileRecord[] }>(`/projects/${projectId}/files`, {
      token
    }),

  uploadProjectFile: async (
    token: string,
    projectId: string,
    file: File,
    description?: string | null
  ) => {
    const body = new FormData();
    body.append('file', file);
    if (description?.trim()) {
      body.append('description', description.trim());
    }

    return request<ProjectFileRecord>(`/projects/${projectId}/files`, {
      method: 'POST',
      token,
      body
    });
  },

  deleteProjectFile: (token: string, projectId: string, fileId: string) =>
    request<void>(`/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE',
      token
    }),

  listLibraryItems: (
    token: string,
    projectId: string,
    query?: {
      q?: string;
      type?: LibraryItemType;
      origin?: LibraryItemOrigin;
      status?: LibraryItemStatus;
      folderId?: string;
      tagId?: string;
    }
  ) => {
    const params = new URLSearchParams();

    if (query?.q) {
      params.set('q', query.q);
    }

    if (query?.type) {
      params.set('type', query.type);
    }

    if (query?.origin) {
      params.set('origin', query.origin);
    }

    if (query?.status) {
      params.set('status', query.status);
    }

    if (query?.folderId) {
      params.set('folderId', query.folderId);
    }

    if (query?.tagId) {
      params.set('tagId', query.tagId);
    }

    const suffix = params.toString() ? `?${params.toString()}` : '';

    return request<{ items: LibraryItemSummary[] }>(`/projects/${projectId}/library${suffix}`, {
      token
    });
  },

  listLibraryFolders: (token: string, projectId: string) =>
    request<{ folders: LibraryFolder[] }>(`/projects/${projectId}/library/folders`, {
      token
    }),

  createLibraryFolder: (
    token: string,
    projectId: string,
    payload: {
      name: string;
      parentId?: string | null;
    }
  ) =>
    request<LibraryFolder>(`/projects/${projectId}/library/folders`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  updateLibraryFolder: (
    token: string,
    projectId: string,
    folderId: string,
    payload: {
      name?: string;
      parentId?: string | null;
    }
  ) =>
    request<LibraryFolder>(`/projects/${projectId}/library/folders/${folderId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  deleteLibraryFolder: (token: string, projectId: string, folderId: string) =>
    request<void>(`/projects/${projectId}/library/folders/${folderId}`, {
      method: 'DELETE',
      token
    }),

  listLibraryTags: (token: string, projectId: string) =>
    request<{ tags: LibraryTag[] }>(`/projects/${projectId}/library/tags`, {
      token
    }),

  createLibraryTag: (
    token: string,
    projectId: string,
    payload: {
      name: string;
      color: string;
    }
  ) =>
    request<LibraryTag>(`/projects/${projectId}/library/tags`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  updateLibraryTag: (
    token: string,
    projectId: string,
    tagId: string,
    payload: {
      name?: string;
      color?: string;
    }
  ) =>
    request<LibraryTag>(`/projects/${projectId}/library/tags/${tagId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  deleteLibraryTag: (token: string, projectId: string, tagId: string) =>
    request<void>(`/projects/${projectId}/library/tags/${tagId}`, {
      method: 'DELETE',
      token
    }),

  createLibraryDocument: (
    token: string,
    projectId: string,
    payload: {
      title: string;
      description?: string | null;
      folderId?: string | null;
      tagIds?: string[];
      documentType?: LibraryDocumentType | null;
      contentMarkdown?: string | null;
    }
  ) =>
    request<LibraryItemDetail>(`/projects/${projectId}/library/documents`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  uploadLibraryFile: async (
    token: string,
    projectId: string,
    payload: {
      file: File;
      title?: string;
      description?: string | null;
      folderId?: string | null;
      tagIds?: string[];
    }
  ) => {
    const body = new FormData();
    body.append('file', payload.file);

    if (payload.title?.trim()) {
      body.append('title', payload.title.trim());
    }

    if (payload.description?.trim()) {
      body.append('description', payload.description.trim());
    }

    if (payload.folderId) {
      body.append('folderId', payload.folderId);
    }

    if (payload.tagIds && payload.tagIds.length > 0) {
      body.append('tagIds', JSON.stringify(payload.tagIds));
    }

    return request<LibraryItemDetail>(`/projects/${projectId}/library/files`, {
      method: 'POST',
      token,
      body
    });
  },

  getLibraryItem: (token: string, projectId: string, itemId: string) =>
    request<LibraryItemDetail>(`/projects/${projectId}/library/items/${itemId}`, {
      token
    }),

  updateLibraryItem: (
    token: string,
    projectId: string,
    itemId: string,
    payload: {
      title?: string;
      description?: string | null;
      folderId?: string | null;
      documentType?: LibraryDocumentType | null;
      status?: LibraryItemStatus;
      contentMarkdown?: string | null;
      contentJson?: unknown | null;
      tagIds?: string[];
    }
  ) =>
    request<LibraryItemDetail>(`/projects/${projectId}/library/items/${itemId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload)
    }),

  archiveLibraryItem: (token: string, projectId: string, itemId: string) =>
    request<LibraryItemDetail>(`/projects/${projectId}/library/items/${itemId}/archive`, {
      method: 'PATCH',
      token
    }),

  deleteLibraryItem: (token: string, projectId: string, itemId: string) =>
    request<void>(`/projects/${projectId}/library/items/${itemId}`, {
      method: 'DELETE',
      token
    }),

  attachTagToLibraryItem: (token: string, projectId: string, itemId: string, tagId: string) =>
    request<LibraryItemDetail>(`/projects/${projectId}/library/items/${itemId}/tags/${tagId}`, {
      method: 'POST',
      token
    }),

  detachTagFromLibraryItem: (token: string, projectId: string, itemId: string, tagId: string) =>
    request<LibraryItemDetail>(`/projects/${projectId}/library/items/${itemId}/tags/${tagId}`, {
      method: 'DELETE',
      token
    }),

  exportLibraryItem: async (
    token: string,
    projectId: string,
    itemId: string,
    format: 'markdown' | 'docx'
  ): Promise<{ blob: Blob; fileName: string; mimeType: string }> => {
    const response = await fetch(
      `${API_BASE_URL}/projects/${projectId}/library/items/${itemId}/export?format=${format}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      let payload: ApiErrorPayload | null = null;

      try {
        payload = (await response.json()) as ApiErrorPayload;
      } catch {
        payload = null;
      }

      throw new ApiError(payload?.message ?? 'Falha na exportação do documento.', response.status, payload?.details);
    }

    const contentDisposition = response.headers.get('content-disposition') ?? '';
    const fileNameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const defaultFileName = format === 'docx' ? 'documento.docx' : 'documento.md';

    return {
      blob: await response.blob(),
      fileName: fileNameMatch?.[1] ?? defaultFileName,
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream'
    };
  },

  generateMeetingMinutesLibrary: (
    token: string,
    projectId: string,
    meetingId: string,
    payload?: {
      forceNew?: boolean;
    }
  ) =>
    request<LibraryItemDetail>(`/projects/${projectId}/meetings/${meetingId}/library/generate-minutes`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload ?? {})
    }),

  listNotifications: (
    token: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
    }
  ) => {
    const query = new URLSearchParams();

    if (typeof options?.unreadOnly === 'boolean') {
      query.set('unreadOnly', String(options.unreadOnly));
    }

    if (typeof options?.limit === 'number') {
      query.set('limit', String(options.limit));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';

    return request<{ notifications: NotificationRecord[] }>(`/notifications${suffix}`, {
      token
    });
  },

  getUnreadNotificationsCount: (token: string) =>
    request<{ count: number }>('/notifications/unread-count', {
      token
    }),

  markNotificationAsRead: (token: string, notificationId: string) =>
    request<NotificationRecord>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
      token
    }),

  markAllNotificationsAsRead: (token: string) =>
    request<{ updatedCount: number }>('/notifications/read-all', {
      method: 'PATCH',
      token
    }),

  deleteNotification: (token: string, notificationId: string) =>
    request<void>(`/notifications/${notificationId}`, {
      method: 'DELETE',
      token
    }),

  listProjectLinks: (token: string, projectId: string) =>
    request<{ links: ProjectLink[] }>(`/projects/${projectId}/links`, {
      token
    }),

  createProjectLink: (
    token: string,
    projectId: string,
    payload: {
      title: string;
      url: string;
    }
  ) =>
    request<ProjectLink>(`/projects/${projectId}/links`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  createAiSearchThread: (
    token: string,
    payload: {
      scope: 'ORGANIZATION' | 'PROJECT';
      projectId?: string;
      title?: string;
    }
  ) =>
    request<AiSearchThreadSummary>('/ai-search/threads', {
      method: 'POST',
      token,
      body: JSON.stringify(payload)
    }),

  listAiSearchThreads: (
    token: string,
    options?: {
      projectId?: string;
      includeArchived?: boolean;
    }
  ) => {
    const query = new URLSearchParams();

    if (options?.projectId) {
      query.set('projectId', options.projectId);
    }

    if (typeof options?.includeArchived === 'boolean') {
      query.set('includeArchived', String(options.includeArchived));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';

    return request<{ threads: AiSearchThreadSummary[] }>(`/ai-search/threads${suffix}`, {
      token
    });
  },

  getAiSearchThread: (token: string, threadId: string) =>
    request<AiSearchThreadDetail>(`/ai-search/threads/${threadId}`, {
      token
    }),

  sendAiSearchMessage: (
    token: string,
    payload: {
      threadId: string;
      question: string;
      scope: 'ORGANIZATION' | 'PROJECT';
      projectId?: string | null;
    }
  ) =>
    request<AiSearchAskResponse>(`/ai-search/threads/${payload.threadId}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        question: payload.question,
        scope: payload.scope,
        projectId: payload.projectId ?? null
      })
    }),

  archiveAiSearchThread: (token: string, threadId: string) =>
    request<AiSearchThreadSummary>(`/ai-search/threads/${threadId}/archive`, {
      method: 'PATCH',
      token
    }),

  deleteAiSearchThread: (token: string, threadId: string) =>
    request<void>(`/ai-search/threads/${threadId}`, {
      method: 'DELETE',
      token
    }),

  reindexAiSearchOrganization: (token: string) =>
    request<{ projects: number; indexed: number }>('/ai-search/reindex', {
      method: 'POST',
      token
    }),

  reindexAiSearchProject: (token: string, projectId: string) =>
    request<{ indexed: number }>(`/projects/${projectId}/ai-search/reindex`, {
      method: 'POST',
      token
    }),

  getAiSearchSuggestions: (token: string, projectId?: string) => {
    const query = new URLSearchParams();

    if (projectId) {
      query.set('projectId', projectId);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';

    return request<{ suggestions: string[] }>(`/ai-search/suggestions${suffix}`, {
      token
    });
  }
};
