export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export type NotificationType =
  | 'CARD_CREATED'
  | 'CARD_ASSIGNED'
  | 'CARD_DUE_DATE_SET'
  | 'CARD_DUE_SOON'
  | 'CARD_OVERDUE'
  | 'CARD_COMMENTED'
  | 'CARD_MOVED'
  | 'MEETING_CREATED'
  | 'MEETING_TRANSCRIPTION_READY'
  | 'MEETING_NOTES_READY'
  | 'FILE_UPLOADED'
  | 'PROJECT_MEMBER_ADDED'
  | 'SYSTEM';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'BOTH';

export type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  channel: NotificationChannel;
  targetHref: string | null;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  readAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  projectId: string | null;
};

export type SessionResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    phone: string | null;
  };
  activeOrganization: {
    id: string;
    name: string;
    slug: string;
    email: string;
    memberId: string;
    role: MemberRole;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    email: string;
    memberId: string;
    role: MemberRole;
  }>;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: {
    members: number;
    meetings: number;
    files: number;
    reports: number;
    columns: number;
    cards: number;
  };
};

export type ProjectMemberSummary = {
  id: string;
  role: MemberRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export type ProjectDetail = ProjectSummary & {
  members: ProjectMemberSummary[];
  meetings: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  board: {
    id: string;
    name: string;
    createdAt: string;
    columns: Array<{
      id: string;
      title: string;
      position: number;
      cards: number;
    }>;
  } | null;
  files: Array<{
    id: string;
    name: string;
    description: string | null;
    filePath: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
    uploadedBy: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  reports: Array<{
    id: string;
    meetingId: string;
    meetingTitle: string;
    summary: string;
    createdAt: string;
  }>;
};

export type BoardCard = {
  id: string;
  boardColumnId: string;
  projectId: string;
  meetingId: string | null;
  position: number;
  sourceType: 'MANUAL' | 'AI';
  title: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  assignees: Array<{
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  checklists: Array<{
    id: string;
    title: string;
    position: number;
    createdAt: string;
    updatedAt: string;
    items: Array<{
      id: string;
      content: string;
      isCompleted: boolean;
      position: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  attachments: Array<{
    id: string;
    projectFileId: string | null;
    name: string;
    filePath: string;
    fileUrl: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
    uploadedBy: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  links: Array<{
    id: string;
    title: string;
    url: string;
    createdAt: string;
    updatedAt: string;
  }>;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  activities: Array<{
    id: string;
    type:
      | 'CARD_CREATED'
      | 'CARD_UPDATED'
      | 'CARD_MOVED'
      | 'CARD_DELETED'
      | 'ASSIGNEE_ADDED'
      | 'ASSIGNEE_REMOVED'
      | 'DUE_DATE_UPDATED'
      | 'PRIORITY_UPDATED'
      | 'CHECKLIST_CREATED'
      | 'CHECKLIST_UPDATED'
      | 'CHECKLIST_REMOVED'
      | 'CHECKLIST_ITEM_CREATED'
      | 'CHECKLIST_ITEM_UPDATED'
      | 'CHECKLIST_ITEM_TOGGLED'
      | 'CHECKLIST_ITEM_REMOVED'
      | 'COMMENT_ADDED'
      | 'LINK_ADDED'
      | 'LINK_UPDATED'
      | 'LINK_REMOVED'
      | 'ATTACHMENT_ADDED'
      | 'ATTACHMENT_REMOVED'
      | 'LABEL_CREATED'
      | 'LABEL_UPDATED'
      | 'LABEL_REMOVED';
    metadataJson: unknown;
    createdAt: string;
    actor: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }>;
};

export type BoardColumn = {
  id: string;
  title: string;
  position: number;
  cards: BoardCard[];
};

export type BoardResponse = {
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  board: {
    id: string;
    name: string;
    createdAt: string;
  };
  members: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
    role: MemberRole;
  }>;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  columns: BoardColumn[];
};

export type MeetingStatus =
  | 'PENDING'
  | 'UPLOADED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'PROCESSING_AI'
  | 'COMPLETED'
  | 'FAILED';

export type MeetingTask = {
  title: string;
  description: string | null;
  assignees: string[];
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

export type MeetingObservation = {
  id: string;
  timestampSeconds: number;
  type: 'NOTE' | 'TASK' | 'QUESTION' | 'IMPORTANT' | 'DECISION';
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export type MeetingSummary = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MeetingStatus;
  audioUrl: string | null;
  durationSeconds: number | null;
  hasTranscript: boolean;
  hasAnalysis: boolean;
  observationsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MeetingDetail = MeetingSummary & {
  project: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  transcript: {
    id: string;
    fullText: string;
    language: string | null;
    createdAt: string;
  } | null;
  analysis: {
    summary: string;
    topics: string[];
    decisions: string[];
    tasks: MeetingTask[];
    pendingItems: string[];
    notes: string[];
    report: string | null;
    reportMeta: unknown;
    createdAt: string;
  } | null;
  observations: MeetingObservation[];
  generatedCards: Array<{
    id: string;
    title: string;
    description: string | null;
    sourceType: 'MANUAL' | 'AI';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
    column: {
      id: string;
      title: string;
    };
    assignees: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    }>;
  }>;
};

export type ProjectMeeting = MeetingDetail;

export type ProjectFileRecord = {
  id: string;
  name: string;
  description: string | null;
  filePath: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export type LibraryItemType = 'DOCUMENT' | 'FILE';
export type LibraryItemOrigin = 'MANUAL' | 'AI' | 'MEETING' | 'UPLOAD';
export type LibraryItemStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LibraryDocumentType =
  | 'MEETING_MINUTES'
  | 'SCOPE'
  | 'REQUIREMENTS'
  | 'PLANNING'
  | 'PROPOSAL'
  | 'TECHNICAL'
  | 'MANUAL'
  | 'DECISION_RECORD'
  | 'ACTION_PLAN'
  | 'OTHER';

export type LibraryFolder = {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryTag = {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export type LibraryItemSummary = {
  id: string;
  projectId: string;
  folderId: string | null;
  meetingId: string | null;
  title: string;
  description: string | null;
  type: LibraryItemType;
  origin: LibraryItemOrigin;
  status: LibraryItemStatus;
  documentType: LibraryDocumentType | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  folder: {
    id: string;
    name: string;
    parentId: string | null;
  } | null;
  meeting: {
    id: string;
    title: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  updatedBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type LibraryItemDetail = LibraryItemSummary & {
  contentMarkdown: string | null;
  contentText: string | null;
  contentJson: unknown | null;
  versions: Array<{
    id: string;
    createdByUserId: string;
    createdAt: string;
    contentMarkdown: string | null;
    contentText: string | null;
    contentJson: unknown | null;
  }>;
};

export type ProjectReportsResponse = {
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  period: {
    days: number;
    from: string;
    to: string;
    bucketSizeDays: number;
    meetingsInPeriod: number;
    totalMeetingsInProject: number;
  };
  overview: {
    totalMeetings: number;
    meetingsInPeriod: number;
    decisionsInPeriod: number;
    topicsMentionsInPeriod: number;
    pendingMentionsInPeriod: number;
    openTasksFromMeetings: number;
  };
  recurringTopics: Array<{
    topic: string;
    count: number;
    lastSeenAt: string;
  }>;
  recentDecisions: Array<{
    meetingId: string;
    meetingTitle: string;
    decision: string;
    createdAt: string;
  }>;
  openTasksFromMeetings: Array<{
    cardId: string;
    title: string;
    description: string | null;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
    dueDate: string | null;
    columnTitle: string;
    meeting: {
      id: string;
      title: string;
    };
    assignees: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    }>;
  }>;
  pendingHighlights: Array<{
    item: string;
    count: number;
    lastSeenAt: string;
  }>;
  periodSummary: Array<{
    label: string;
    start: string;
    end: string;
    meetings: number;
    decisions: number;
    topics: number;
    actionItems: number;
    pendingItems: number;
  }>;
};

export type ProjectLink = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  createdByMemberId: string | null;
};

export type OrganizationOverview = {
  id: string;
  name: string;
  slug: string;
  email: string;
  members: Array<{
    memberId: string;
    role: MemberRole;
    createdAt: string;
    user: {
      id: string;
      name: string;
      fullName: string;
      email: string;
      avatarUrl: string | null;
    };
  }>;
};

export type OrganizationMemberSummary = OrganizationOverview['members'][number];

export type OrganizationDashboardResponse = {
  organization: {
    id: string;
    name: string;
    slug: string;
    email: string;
  };
  period: {
    days: number;
    from: string;
    to: string;
  };
  metrics: {
    projects: number;
    recentMeetings: number;
    openCards: number;
    recentDecisions: number;
    recentPendingItems: number;
  };
  recentDecisions: Array<{
    meetingId: string;
    meetingTitle: string;
    project: {
      id: string;
      name: string;
    };
    decision: string;
    createdAt: string;
  }>;
  recentPendingItems: Array<{
    meetingId: string;
    meetingTitle: string;
    project: {
      id: string;
      name: string;
    };
    item: string;
    createdAt: string;
  }>;
  teamRecentActivity: Array<{
    type: 'MEETING_CREATED' | 'OBSERVATION_ADDED' | 'CARD_CREATED' | 'FILE_UPLOADED' | 'MEMBER_ADDED';
    occurredAt: string;
    title: string;
    description: string;
    actor: {
      id: string;
      name: string;
      email: string;
    } | null;
    project: {
      id: string;
      name: string;
    } | null;
  }>;
};

export type AiSearchScope = 'ORGANIZATION' | 'PROJECT';
export type AiSearchThreadStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';
export type AiSearchSourceType =
  | 'PROJECT'
  | 'MEETING'
  | 'TRANSCRIPT'
  | 'MEETING_NOTE'
  | 'DECISION'
  | 'TASK'
  | 'CARD'
  | 'CARD_COMMENT'
  | 'FILE'
  | 'LIBRARY_ITEM';

export type AiSearchAnswerJson = {
  answer: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedFollowUps: string[];
};

export type AiSearchMessageSource = {
  id: string;
  sourceType: AiSearchSourceType;
  sourceId: string;
  title: string;
  href: string;
  excerpt: string | null;
  createdAt: string;
};

export type AiSearchMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  answerJson: AiSearchAnswerJson | null;
  createdAt: string;
  sources: AiSearchMessageSource[];
};

export type AiSearchThreadSummary = {
  id: string;
  title: string;
  scope: AiSearchScope;
  status: AiSearchThreadStatus;
  project: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  lastMessagePreview: string | null;
};

export type AiSearchThreadDetail = {
  id: string;
  title: string;
  scope: AiSearchScope;
  status: AiSearchThreadStatus;
  project: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  messages: AiSearchMessage[];
};

export type AiSearchAskResponse = {
  threadId: string;
  reused: boolean;
  message: AiSearchMessage;
};
