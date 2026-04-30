'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarDays,
  CheckSquare2,
  ExternalLink,
  GripVertical,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

import { useConfigureAppShell } from '@/components/layout/app-shell-config';
import { CardDetailDrawer } from '@/components/board/card-detail-drawer';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { cn } from '@/lib/utils';
import type { BoardCard, BoardResponse } from '@/types/domain';

const PRIORITY_OPTIONS: Array<{ value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; label: string }> = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' }
];

const WRITER_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);

const roleLabel: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
  VIEWER: 'Visualizador'
};

const sourceLabel: Record<'MANUAL' | 'AI', string> = {
  MANUAL: 'Manual',
  AI: 'IA'
};

const priorityLabel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

const priorityBadgeVariant: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string> = {
  LOW: 'border-[#d5deec] bg-[#f5f8ff] text-[#3f4a5f]',
  MEDIUM: 'border-[#ffe0a8] bg-[#fff6e8] text-[#7a5600]',
  HIGH: 'border-[#ffd5ce] bg-[#fff1ee] text-[#912018]',
  URGENT: 'border-[#ffc7bf] bg-[#ffe7e2] text-[#7b0f08]'
};

const toLocalDateTimeInput = (isoDate: string | null): string => {
  if (!isoDate) {
    return '';
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const fromLocalDateTimeInput = (value: string): string | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const findCardById = (board: BoardResponse | null, cardId: string | null): BoardCard | null => {
  if (!board || !cardId) {
    return null;
  }

  for (const column of board.columns) {
    const card = column.cards.find((entry) => entry.id === cardId);

    if (card) {
      return card;
    }
  }

  return null;
};

const formatDateLabel = (value: string | null): string => {
  if (!value) {
    return 'Sem prazo';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Sem prazo';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  });
};

const formatFileSize = (sizeBytes: number | null): string => {
  if (!sizeBytes || sizeBytes <= 0) {
    return 'Tamanho não informado';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
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

const formatChecklistProgress = (card: BoardCard): string | null => {
  const totalItems = card.checklists.reduce((total, checklist) => total + checklist.items.length, 0);

  if (totalItems === 0) {
    return null;
  }

  const completedItems = card.checklists.reduce(
    (total, checklist) => total + checklist.items.filter((item) => item.isCompleted).length,
    0
  );

  return `${completedItems}/${totalItems}`;
};

const formatChecklistSummary = (items: ChecklistItemType[]): string => {
  const completed = items.filter((item) => item.isCompleted).length;
  return `${completed} de ${items.length} concluídos`;
};

const getDueDateState = (
  dueDate: string | null
): { label: string; className: string } | null => {
  if (!dueDate) {
    return null;
  }

  const parsedDate = new Date(dueDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffHours = (parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) {
    return { label: 'Vencido', className: 'text-[#9f1239]' };
  }

  if (diffHours <= 48) {
    return { label: 'Próximo do prazo', className: 'text-[#92400e]' };
  }

  return { label: 'Dentro do prazo', className: 'text-[#166534]' };
};

const activityTypeLabel: Record<BoardCard['activities'][number]['type'], string> = {
  CARD_CREATED: 'Cartão criado',
  CARD_UPDATED: 'Cartão atualizado',
  CARD_MOVED: 'Cartão movido de coluna',
  CARD_DELETED: 'Cartão excluído',
  ASSIGNEE_ADDED: 'Responsável adicionado',
  ASSIGNEE_REMOVED: 'Responsável removido',
  DUE_DATE_UPDATED: 'Prazo alterado',
  PRIORITY_UPDATED: 'Prioridade alterada',
  CHECKLIST_CREATED: 'Checklist criado',
  CHECKLIST_UPDATED: 'Checklist atualizado',
  CHECKLIST_REMOVED: 'Checklist removido',
  CHECKLIST_ITEM_CREATED: 'Item de checklist criado',
  CHECKLIST_ITEM_UPDATED: 'Item de checklist atualizado',
  CHECKLIST_ITEM_TOGGLED: 'Item de checklist marcado/desmarcado',
  CHECKLIST_ITEM_REMOVED: 'Item de checklist removido',
  COMMENT_ADDED: 'Comentário adicionado',
  LINK_ADDED: 'Link adicionado',
  LINK_UPDATED: 'Link atualizado',
  LINK_REMOVED: 'Link removido',
  ATTACHMENT_ADDED: 'Anexo adicionado',
  ATTACHMENT_REMOVED: 'Anexo removido',
  LABEL_CREATED: 'Etiqueta criada',
  LABEL_UPDATED: 'Etiqueta atualizada',
  LABEL_REMOVED: 'Etiqueta removida'
};

const formatActivityMessage = (
  activity: BoardCard['activities'][number],
  columnsById: Map<string, string>
): string => {
  const actorName = activity.actor.name;
  const metadata =
    typeof activity.metadataJson === 'object' && activity.metadataJson !== null
      ? (activity.metadataJson as Record<string, unknown>)
      : {};

  const fromColumn =
    (typeof metadata.fromColumnTitle === 'string' ? metadata.fromColumnTitle : undefined) ??
    (typeof metadata.fromColumnId === 'string' ? columnsById.get(metadata.fromColumnId) : undefined) ??
    'coluna anterior';
  const toColumn =
    (typeof metadata.toColumnTitle === 'string' ? metadata.toColumnTitle : undefined) ??
    (typeof metadata.toColumnId === 'string' ? columnsById.get(metadata.toColumnId) : undefined) ??
    'nova coluna';

  switch (activity.type) {
    case 'CARD_CREATED':
      return `${actorName} criou este cartão.`;
    case 'CARD_MOVED':
      return `${actorName} moveu de ${fromColumn} para ${toColumn}.`;
    case 'CARD_UPDATED':
      return `${actorName} atualizou este cartão.`;
    case 'CARD_DELETED':
      return `${actorName} excluiu este cartão.`;
    case 'ASSIGNEE_ADDED':
      return `${actorName} adicionou responsáveis.`;
    case 'ASSIGNEE_REMOVED':
      return `${actorName} removeu responsáveis.`;
    case 'DUE_DATE_UPDATED':
      return `${actorName} alterou o prazo.`;
    case 'PRIORITY_UPDATED':
      return `${actorName} alterou a prioridade.`;
    case 'CHECKLIST_CREATED':
      return `${actorName} adicionou um checklist.`;
    case 'CHECKLIST_UPDATED':
      return `${actorName} atualizou um checklist.`;
    case 'CHECKLIST_REMOVED':
      return `${actorName} removeu um checklist.`;
    case 'CHECKLIST_ITEM_CREATED':
      return `${actorName} adicionou um item de checklist.`;
    case 'CHECKLIST_ITEM_UPDATED':
      return `${actorName} atualizou um item de checklist.`;
    case 'CHECKLIST_ITEM_TOGGLED':
      return `${actorName} marcou ou desmarcou um item de checklist.`;
    case 'CHECKLIST_ITEM_REMOVED':
      return `${actorName} removeu um item de checklist.`;
    case 'COMMENT_ADDED':
      return `${actorName} adicionou um comentário.`;
    case 'LINK_ADDED':
      return `${actorName} adicionou um link.`;
    case 'LINK_UPDATED':
      return `${actorName} atualizou um link.`;
    case 'LINK_REMOVED':
      return `${actorName} removeu um link.`;
    case 'ATTACHMENT_ADDED':
      return `${actorName} adicionou um anexo.`;
    case 'ATTACHMENT_REMOVED':
      return `${actorName} removeu um anexo.`;
    case 'LABEL_CREATED':
      return `${actorName} criou uma etiqueta.`;
    case 'LABEL_UPDATED':
      return `${actorName} atualizou uma etiqueta.`;
    case 'LABEL_REMOVED':
      return `${actorName} removeu uma etiqueta.`;
    default:
      return `${actorName} registrou: ${activityTypeLabel[activity.type]}.`;
  }
};

const COLUMN_MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);
const CARD_DRAG_PREFIX = 'card';
const COLUMN_DRAG_PREFIX = 'column';
const CHECKLIST_ITEM_DRAG_PREFIX = 'checklist-item';

type BoardColumnType = BoardResponse['columns'][number];
type ChecklistType = BoardCard['checklists'][number];
type ChecklistItemType = ChecklistType['items'][number];

type DragRecord = {
  type: 'card' | 'column' | 'checklist-item';
  id: string;
  columnId?: string;
  checklistId?: string;
};

const createDragId = (prefix: string, id: string): string => `${prefix}:${id}`;

const parseDragId = (value: unknown): { prefix: string; id: string } | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const separatorIndex = value.indexOf(':');

  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return null;
  }

  return {
    prefix: value.slice(0, separatorIndex),
    id: value.slice(separatorIndex + 1)
  };
};

const cloneBoardColumns = (columns: BoardColumnType[]): BoardColumnType[] =>
  columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) => ({
      ...card
    }))
  }));

const findCardLocation = (
  columns: BoardColumnType[],
  cardId: string
): { columnIndex: number; cardIndex: number; card: BoardCard } | null => {
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const cardIndex = columns[columnIndex].cards.findIndex((card) => card.id === cardId);

    if (cardIndex !== -1) {
      return {
        columnIndex,
        cardIndex,
        card: columns[columnIndex].cards[cardIndex]
      };
    }
  }

  return null;
};

const findColumnIndex = (columns: BoardColumnType[], columnId: string): number =>
  columns.findIndex((column) => column.id === columnId);

const reorderCardsPreview = (input: {
  columns: BoardColumnType[];
  activeCardId: string;
  overType: 'card' | 'column';
  overId: string;
  overColumnId: string;
}): BoardColumnType[] => {
  const columns = cloneBoardColumns(input.columns);
  const sourceLocation = findCardLocation(columns, input.activeCardId);

  if (!sourceLocation) {
    return input.columns;
  }

  let destinationColumnId = input.overColumnId;
  let destinationIndex = 0;

  if (input.overType === 'card') {
    const overLocation = findCardLocation(columns, input.overId);

    if (!overLocation) {
      return input.columns;
    }

    destinationColumnId = overLocation.card.boardColumnId;
    destinationIndex = overLocation.cardIndex;

    if (
      sourceLocation.columnIndex === overLocation.columnIndex &&
      sourceLocation.cardIndex < overLocation.cardIndex
    ) {
      destinationIndex -= 1;
    }
  } else {
    const destinationColumnIndex = findColumnIndex(columns, destinationColumnId);

    if (destinationColumnIndex === -1) {
      return input.columns;
    }

    destinationIndex = columns[destinationColumnIndex].cards.length;
  }

  if (
    sourceLocation.card.boardColumnId === destinationColumnId &&
    sourceLocation.cardIndex === destinationIndex
  ) {
    return input.columns;
  }

  const sourceColumnCards = columns[sourceLocation.columnIndex].cards;
  const [removed] = sourceColumnCards.splice(sourceLocation.cardIndex, 1);

  if (!removed) {
    return input.columns;
  }

  const destinationColumnIndex = findColumnIndex(columns, destinationColumnId);

  if (destinationColumnIndex === -1) {
    return input.columns;
  }

  const destinationCards = columns[destinationColumnIndex].cards;
  const normalizedDestinationIndex = Math.max(0, Math.min(destinationIndex, destinationCards.length));
  const movedCard: BoardCard = {
    ...removed,
    boardColumnId: destinationColumnId
  };

  destinationCards.splice(normalizedDestinationIndex, 0, movedCard);

  return columns.map((column) => ({
    ...column,
    cards: column.cards.map((card, index) => ({
      ...card,
      boardColumnId: column.id,
      position: index + 1
    }))
  }));
};

type SortableRenderProps = {
  setNodeRef: (element: HTMLElement | null) => void;
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  style: React.CSSProperties;
  isDragging: boolean;
};

const SortableCard = ({
  card,
  columnId,
  disabled,
  children
}: {
  card: BoardCard;
  columnId: string;
  disabled: boolean;
  children: (props: SortableRenderProps) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: createDragId(CARD_DRAG_PREFIX, card.id),
    data: {
      type: 'card',
      id: card.id,
      columnId
    } satisfies DragRecord,
    disabled
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.82 : 1
  };

  return children({
    setNodeRef,
    attributes,
    listeners,
    style,
    isDragging
  });
};

const SortableColumn = ({
  column,
  disabled,
  children
}: {
  column: BoardColumnType;
  disabled: boolean;
  children: (props: SortableRenderProps) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: createDragId(COLUMN_DRAG_PREFIX, column.id),
    data: {
      type: 'column',
      id: column.id
    } satisfies DragRecord,
    disabled
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.84 : 1
  };

  return children({
    setNodeRef,
    attributes,
    listeners,
    style,
    isDragging
  });
};

const SortableChecklistItem = ({
  checklistId,
  item,
  disabled,
  children
}: {
  checklistId: string;
  item: ChecklistItemType;
  disabled: boolean;
  children: (props: SortableRenderProps) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: createDragId(CHECKLIST_ITEM_DRAG_PREFIX, item.id),
    data: {
      type: 'checklist-item',
      id: item.id,
      checklistId
    } satisfies DragRecord,
    disabled
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1
  };

  return children({
    setNodeRef,
    attributes,
    listeners,
    style,
    isDragging
  });
};

export default function ProjectBoardPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  const session = useAppSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [showCreateColumnModal, setShowCreateColumnModal] = useState(false);

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [newCardColumnId, setNewCardColumnId] = useState('');
  const [newCardPriority, setNewCardPriority] = useState<'' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('');
  const [newCardDueDate, setNewCardDueDate] = useState('');
  const [newCardAssigneeIds, setNewCardAssigneeIds] = useState<string[]>([]);
  const [newCardError, setNewCardError] = useState<string | null>(null);

  const [newColumnTitle, setNewColumnTitle] = useState('');

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColumnId, setEditColumnId] = useState('');
  const [editPriority, setEditPriority] = useState<'' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editSourceType, setEditSourceType] = useState<'MANUAL' | 'AI'>('MANUAL');
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editLabelIds, setEditLabelIds] = useState<string[]>([]);

  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistItemByChecklistId, setNewChecklistItemByChecklistId] = useState<Record<string, string>>({});

  const [newComment, setNewComment] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#1565C0');
  const [activeBoardDrag, setActiveBoardDrag] = useState<DragRecord | null>(null);
  const [boardOverColumnId, setBoardOverColumnId] = useState<string | null>(null);
  const [activeChecklistDrag, setActiveChecklistDrag] = useState<DragRecord | null>(null);
  const boardDragSnapshotRef = useRef<BoardColumnType[] | null>(null);
  const boardSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );
  const checklistSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4
      }
    })
  );

  useConfigureAppShell({
    title: 'Quadro',
    searchValue: searchTerm,
    searchPlaceholder: 'Buscar cartões no quadro',
    onSearchChange: setSearchTerm,
    project: projectId ? { id: projectId, name: board?.project.name ?? 'Projeto', color: board?.project.color ?? undefined } : undefined
  });

  const selectedCard = useMemo(() => findCardById(board, selectedCardId), [board, selectedCardId]);

  const canWrite = useMemo(() => {
    if (!session) {
      return false;
    }

    if (WRITER_ROLES.has(session.activeOrganization.role)) {
      return true;
    }

    const projectRole = board?.members.find((member) => member.user.id === session.user.id)?.role;
    return Boolean(projectRole && WRITER_ROLES.has(projectRole));
  }, [board?.members, session]);

  const canManageColumns = useMemo(() => {
    if (!session) {
      return false;
    }

    if (COLUMN_MANAGER_ROLES.has(session.activeOrganization.role)) {
      return true;
    }

    const projectRole = board?.members.find((member) => member.user.id === session.user.id)?.role;
    return Boolean(projectRole && COLUMN_MANAGER_ROLES.has(projectRole));
  }, [board?.members, session]);

  const isFilteringBoard = searchTerm.trim().length > 0;
  const canDragCards = canWrite && !isMutating && !isFilteringBoard;
  const canDragColumns = canManageColumns && !isMutating && !isFilteringBoard;

  const cardsCount = useMemo(() => {
    if (!board) {
      return 0;
    }

    return board.columns.reduce((total, column) => total + column.cards.length, 0);
  }, [board]);

  const cardCountLabel = `${cardsCount} ${cardsCount === 1 ? 'cartão' : 'cartões'}`;

  const selectedAssignees = useMemo(
    () =>
      (board?.members ?? []).filter((member) => {
        return editAssigneeIds.includes(member.user.id);
      }),
    [board?.members, editAssigneeIds]
  );

  const availableAssignees = useMemo(
    () =>
      (board?.members ?? []).filter((member) => {
        return !editAssigneeIds.includes(member.user.id);
      }),
    [board?.members, editAssigneeIds]
  );

  const editDueDateState = useMemo(
    () => getDueDateState(fromLocalDateTimeInput(editDueDate)),
    [editDueDate]
  );

  const columnsById = useMemo(
    () => new Map((board?.columns ?? []).map((column) => [column.id, column.title])),
    [board?.columns]
  );

  const filteredColumns = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!board) {
      return [];
    }

    if (!query) {
      return board.columns;
    }

    return board.columns
      .map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          return (
            card.title.toLowerCase().includes(query) ||
            (card.description ?? '').toLowerCase().includes(query)
          );
        })
      }))
      .filter((column) => column.cards.length > 0);
  }, [board, searchTerm]);

  const activeDraggedCard = useMemo(() => {
    if (!board || activeBoardDrag?.type !== 'card') {
      return null;
    }

    return findCardById(board, activeBoardDrag.id);
  }, [activeBoardDrag, board]);

  const activeDraggedColumn = useMemo(() => {
    if (!board || activeBoardDrag?.type !== 'column') {
      return null;
    }

    return board.columns.find((column) => column.id === activeBoardDrag.id) ?? null;
  }, [activeBoardDrag, board]);

  const loadBoard = useCallback(async () => {
    if (!session?.token || !projectId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await api.getBoard(session.token, projectId);
      setBoard(payload);

      if (selectedCardId) {
        const stillExists = findCardById(payload, selectedCardId);

        if (!stillExists) {
          setSelectedCardId(null);
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Não foi possível carregar o quadro do projeto.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedCardId, session?.token]);

  useEffect(() => {
    if (projectId) {
      void loadBoard();
    }
  }, [loadBoard, projectId]);

  useEffect(() => {
    if (board?.columns.length && !newCardColumnId) {
      setNewCardColumnId(board.columns[0].id);
    }
  }, [board?.columns, newCardColumnId]);

  useEffect(() => {
    if (!selectedCard) {
      setEditTitle('');
      setEditDescription('');
      setEditColumnId('');
      setEditPriority('');
      setEditDueDate('');
      setEditSourceType('MANUAL');
      setEditAssigneeIds([]);
      setEditLabelIds([]);
      return;
    }

    setEditTitle(selectedCard.title);
    setEditDescription(selectedCard.description ?? '');
    setEditColumnId(selectedCard.boardColumnId);
    setEditPriority(selectedCard.priority ?? '');
    setEditDueDate(toLocalDateTimeInput(selectedCard.dueDate));
    setEditSourceType(selectedCard.sourceType);
    setEditAssigneeIds(selectedCard.assignees.map((entry) => entry.user.id));
    setEditLabelIds(selectedCard.labels.map((entry) => entry.id));
  }, [selectedCard]);

  const resetCreateCardForm = useCallback(() => {
    setNewCardTitle('');
    setNewCardDescription('');
    setNewCardPriority('');
    setNewCardDueDate('');
    setNewCardAssigneeIds([]);
    setNewCardError(null);
  }, []);

  const runMutation = useCallback(
    async (handler: () => Promise<void>, successText: string) => {
      setIsMutating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        await handler();
        await loadBoard();
        setSuccessMessage(successText);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Não foi possível concluir a operação no quadro.');
        }
      } finally {
        setIsMutating(false);
      }
    },
    [loadBoard]
  );

  const runOptimisticMutation = useCallback(
    async (handler: () => Promise<void>, options: { successText: string; rollback: () => void }) => {
      setIsMutating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        await handler();
        await loadBoard();
        setSuccessMessage(options.successText);
      } catch (error) {
        options.rollback();

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Não foi possível concluir a operação no quadro.');
        }
      } finally {
        setIsMutating(false);
      }
    },
    [loadBoard]
  );

  const applyColumnsToBoard = useCallback((nextColumns: BoardColumnType[]) => {
    setBoard((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        columns: nextColumns
      };
    });
  }, []);

  const restoreBoardColumns = useCallback(
    (columns: BoardColumnType[]) => {
      applyColumnsToBoard(cloneBoardColumns(columns));
    },
    [applyColumnsToBoard]
  );

  const handleBoardDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!board) {
        return;
      }

      const activeDragId = parseDragId(event.active.id);

      if (!activeDragId || (activeDragId.prefix !== CARD_DRAG_PREFIX && activeDragId.prefix !== COLUMN_DRAG_PREFIX)) {
        return;
      }

      if (activeDragId.prefix === CARD_DRAG_PREFIX && !canDragCards) {
        return;
      }

      if (activeDragId.prefix === COLUMN_DRAG_PREFIX && !canDragColumns) {
        return;
      }

      boardDragSnapshotRef.current = cloneBoardColumns(board.columns);

      if (activeDragId.prefix === CARD_DRAG_PREFIX) {
        const location = findCardLocation(board.columns, activeDragId.id);
        setBoardOverColumnId(location?.card.boardColumnId ?? null);
      } else {
        setBoardOverColumnId(null);
      }

      setActiveBoardDrag({
        type: activeDragId.prefix === CARD_DRAG_PREFIX ? 'card' : 'column',
        id: activeDragId.id
      });
    },
    [board, canDragCards, canDragColumns]
  );

  const handleBoardDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!canDragCards || !board) {
        return;
      }

      const activeDragId = parseDragId(event.active.id);
      const overDragId = parseDragId(event.over?.id);

      if (!activeDragId || activeDragId.prefix !== CARD_DRAG_PREFIX || !overDragId) {
        return;
      }

      if (overDragId.prefix !== CARD_DRAG_PREFIX && overDragId.prefix !== COLUMN_DRAG_PREFIX) {
        return;
      }

      const overColumnId =
        overDragId.prefix === COLUMN_DRAG_PREFIX
          ? overDragId.id
          : findCardLocation(board.columns, overDragId.id)?.card.boardColumnId ?? null;

      if (!overColumnId) {
        return;
      }

      setBoardOverColumnId(overColumnId);

      setBoard((current) => {
        if (!current) {
          return current;
        }

        const nextColumns = reorderCardsPreview({
          columns: current.columns,
          activeCardId: activeDragId.id,
          overType: overDragId.prefix === CARD_DRAG_PREFIX ? 'card' : 'column',
          overId: overDragId.id,
          overColumnId
        });

        if (nextColumns === current.columns) {
          return current;
        }

        return {
          ...current,
          columns: nextColumns
        };
      });
    },
    [board, canDragCards]
  );

  const handleBoardDragCancel = useCallback(() => {
    if (boardDragSnapshotRef.current) {
      restoreBoardColumns(boardDragSnapshotRef.current);
    }

    boardDragSnapshotRef.current = null;
    setActiveBoardDrag(null);
    setBoardOverColumnId(null);
  }, [restoreBoardColumns]);

  const handleBoardDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const snapshotColumns = boardDragSnapshotRef.current;
      boardDragSnapshotRef.current = null;

      const activeDragId = parseDragId(event.active.id);
      const overDragId = parseDragId(event.over?.id);

      setActiveBoardDrag(null);
      setBoardOverColumnId(null);

      if (!snapshotColumns || !activeDragId) {
        return;
      }

      if (!board || !session?.token || !projectId || !overDragId) {
        restoreBoardColumns(snapshotColumns);
        return;
      }

      if (activeDragId.prefix === COLUMN_DRAG_PREFIX) {
        if (!canDragColumns || overDragId.prefix !== COLUMN_DRAG_PREFIX) {
          restoreBoardColumns(snapshotColumns);
          return;
        }

        const fromIndex = findColumnIndex(snapshotColumns, activeDragId.id);
        const toIndex = findColumnIndex(snapshotColumns, overDragId.id);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          restoreBoardColumns(snapshotColumns);
          return;
        }

        const nextColumns = arrayMove(cloneBoardColumns(snapshotColumns), fromIndex, toIndex).map((column, index) => ({
          ...column,
          position: index + 1
        }));

        applyColumnsToBoard(nextColumns);

        await runOptimisticMutation(
          async () => {
            await api.reorderColumns(
              session.token,
              projectId,
              nextColumns.map((column) => column.id)
            );
          },
          {
            successText: 'Ordem das colunas atualizada.',
            rollback: () => restoreBoardColumns(snapshotColumns)
          }
        );

        return;
      }

      if (!canDragCards || activeDragId.prefix !== CARD_DRAG_PREFIX) {
        restoreBoardColumns(snapshotColumns);
        return;
      }

      const sourceLocation = findCardLocation(snapshotColumns, activeDragId.id);
      const destinationLocation = findCardLocation(board.columns, activeDragId.id);

      if (!sourceLocation || !destinationLocation) {
        restoreBoardColumns(snapshotColumns);
        return;
      }

      const sourceColumnId = sourceLocation.card.boardColumnId;
      const destinationColumnId = destinationLocation.card.boardColumnId;
      const didMove =
        sourceColumnId !== destinationColumnId || sourceLocation.cardIndex !== destinationLocation.cardIndex;

      if (!didMove) {
        restoreBoardColumns(snapshotColumns);
        return;
      }

      const sourceColumn = board.columns.find((column) => column.id === sourceColumnId);
      const destinationColumn = board.columns.find((column) => column.id === destinationColumnId);

      if (!sourceColumn || !destinationColumn) {
        restoreBoardColumns(snapshotColumns);
        return;
      }

      const sourceOrderedCardIds = sourceColumn.cards.map((card) => card.id);
      const destinationOrderedCardIds = destinationColumn.cards.map((card) => card.id);
      const sourceColumnTitle =
        snapshotColumns.find((column) => column.id === sourceColumnId)?.title ?? 'coluna anterior';
      const destinationColumnTitle =
        snapshotColumns.find((column) => column.id === destinationColumnId)?.title ?? 'nova coluna';
      const successText =
        sourceColumnId === destinationColumnId
          ? 'Ordem dos cartões atualizada.'
          : `Cartão movido de ${sourceColumnTitle} para ${destinationColumnTitle}.`;

      await runOptimisticMutation(
        async () => {
          await api.reorderCards(session.token, projectId, {
            cardId: activeDragId.id,
            sourceColumnId,
            destinationColumnId,
            sourceOrderedCardIds,
            destinationOrderedCardIds
          });
        },
        {
          successText,
          rollback: () => restoreBoardColumns(snapshotColumns)
        }
      );
    },
    [
      applyColumnsToBoard,
      board,
      canDragCards,
      canDragColumns,
      projectId,
      restoreBoardColumns,
      runOptimisticMutation,
      session?.token
    ]
  );

  const handleChecklistDragStart = useCallback((event: DragStartEvent) => {
    const activeDragId = parseDragId(event.active.id);

    if (!activeDragId || activeDragId.prefix !== CHECKLIST_ITEM_DRAG_PREFIX) {
      return;
    }

    const data = event.active.data.current as DragRecord | undefined;

    if (!data?.checklistId) {
      return;
    }

    setActiveChecklistDrag({
      type: 'checklist-item',
      id: activeDragId.id,
      checklistId: data.checklistId
    });
  }, []);

  const handleChecklistDragEnd = useCallback(
    async (event: DragEndEvent, checklist: ChecklistType) => {
      const activeDragId = parseDragId(event.active.id);
      const overDragId = parseDragId(event.over?.id);

      setActiveChecklistDrag(null);

      if (
        !canWrite ||
        isMutating ||
        !session?.token ||
        !projectId ||
        !selectedCardId ||
        !board ||
        !activeDragId ||
        activeDragId.prefix !== CHECKLIST_ITEM_DRAG_PREFIX ||
        !overDragId ||
        overDragId.prefix !== CHECKLIST_ITEM_DRAG_PREFIX
      ) {
        return;
      }

      if (activeDragId.id === overDragId.id) {
        return;
      }

      const activeIndex = checklist.items.findIndex((item) => item.id === activeDragId.id);
      const overIndex = checklist.items.findIndex((item) => item.id === overDragId.id);

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return;
      }

      const previousColumns = cloneBoardColumns(board.columns);
      const reorderedItems = arrayMove(checklist.items, activeIndex, overIndex).map((item, index) => ({
        ...item,
        position: index + 1
      }));

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          columns: current.columns.map((column) => ({
            ...column,
            cards: column.cards.map((card) => {
              if (card.id !== selectedCardId) {
                return card;
              }

              return {
                ...card,
                checklists: card.checklists.map((entry) =>
                  entry.id === checklist.id
                    ? {
                        ...entry,
                        items: reorderedItems
                      }
                    : entry
                )
              };
            })
          }))
        };
      });

      await runOptimisticMutation(
        async () => {
          await api.reorderChecklistItems(
            session.token,
            projectId,
            checklist.id,
            reorderedItems.map((item) => item.id)
          );
        },
        {
          successText: 'Ordem dos itens de checklist atualizada.',
          rollback: () => restoreBoardColumns(previousColumns)
        }
      );
    },
    [
      board,
      canWrite,
      isMutating,
      projectId,
      restoreBoardColumns,
      runOptimisticMutation,
      selectedCardId,
      session?.token
    ]
  );

  const handleCreateCard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canWrite || !newCardColumnId) {
      return;
    }

    const trimmedTitle = newCardTitle.trim();

    if (!trimmedTitle) {
      setNewCardError('Informe o título do cartão.');
      return;
    }

    await runMutation(async () => {
      await api.createCard(session.token, projectId, {
        boardColumnId: newCardColumnId,
        title: trimmedTitle,
        description: newCardDescription || undefined,
        sourceType: 'MANUAL',
        priority: newCardPriority || null,
        dueDate: fromLocalDateTimeInput(newCardDueDate),
        assigneeUserIds: newCardAssigneeIds
      });

      resetCreateCardForm();
      setShowCreateCardModal(false);
    }, 'Cartão criado no quadro.');
  };

  const handleCreateColumn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    await runMutation(async () => {
      await api.createColumn(session.token, projectId, { title: newColumnTitle });
      setNewColumnTitle('');
      setShowCreateColumnModal(false);
    }, 'Coluna criada no quadro.');
  };

  const handleRenameColumn = async (columnId: string, currentTitle: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    const title = window.prompt('Novo título da coluna', currentTitle)?.trim();

    if (!title || title === currentTitle) {
      return;
    }

    await runMutation(async () => {
      await api.updateColumn(session.token, projectId, columnId, { title });
    }, 'Coluna atualizada com sucesso.');
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!session?.token || !projectId || !canManageColumns) {
      return;
    }

    if (!window.confirm('Deseja remover esta coluna? Os cartões serão movidos para a próxima coluna.')) {
      return;
    }

    await runMutation(async () => {
      await api.deleteColumn(session.token, projectId, columnId);
    }, 'Coluna removida com sucesso.');
  };

  const handleMoveColumn = async (columnId: string, direction: 'left' | 'right') => {
    if (!session?.token || !projectId || !canManageColumns || !board) {
      return;
    }

    const orderedColumnIds = [...board.columns]
      .sort((a, b) => a.position - b.position)
      .map((column) => column.id);

    const currentIndex = orderedColumnIds.indexOf(columnId);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= orderedColumnIds.length) {
      return;
    }

    [orderedColumnIds[currentIndex], orderedColumnIds[targetIndex]] = [
      orderedColumnIds[targetIndex],
      orderedColumnIds[currentIndex]
    ];

    await runMutation(async () => {
      await api.reorderColumns(session.token, projectId, orderedColumnIds);
    }, 'Ordenação das colunas atualizada.');
  };

  const handleSaveCard = async () => {
    if (!session?.token || !projectId || !selectedCard || !canWrite) {
      return;
    }

    await runMutation(async () => {
      await api.updateCard(session.token, projectId, selectedCard.id, {
        boardColumnId: editColumnId,
        title: editTitle,
        description: editDescription || null,
        sourceType: editSourceType,
        priority: editPriority || null,
        dueDate: fromLocalDateTimeInput(editDueDate),
        assigneeUserIds: editAssigneeIds,
        labelIds: editLabelIds
      });
    }, 'Cartão atualizado com sucesso.');
  };

  const handleDeleteCard = async () => {
    if (!session?.token || !projectId || !selectedCard || !canWrite) {
      return;
    }

    if (!window.confirm('Deseja excluir este cartão?')) {
      return;
    }

    await runMutation(async () => {
      await api.deleteCard(session.token, projectId, selectedCard.id);
      setSelectedCardId(null);
    }, 'Cartão excluído do quadro.');
  };

  const handleAddChecklist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !selectedCard || !canWrite) {
      return;
    }

    await runMutation(async () => {
      await api.addChecklist(session.token, projectId, selectedCard.id, newChecklistTitle);
      setNewChecklistTitle('');
    }, 'Checklist adicionado ao cartão.');
  };

  const handleAddChecklistItem = async (checklistId: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    const content = newChecklistItemByChecklistId[checklistId]?.trim();

    if (!content) {
      return;
    }

    await runMutation(async () => {
      await api.addChecklistItem(session.token, projectId, checklistId, content);
      setNewChecklistItemByChecklistId((current) => ({
        ...current,
        [checklistId]: ''
      }));
    }, 'Item adicionado ao checklist.');
  };

  const handleToggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    await runMutation(async () => {
      await api.updateChecklistItem(session.token, projectId, itemId, { isCompleted: !isCompleted });
    }, 'Item do checklist atualizado.');
  };

  const handleRenameChecklist = async (checklistId: string, currentTitle: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    const title = window.prompt('Novo título do checklist', currentTitle)?.trim();

    if (!title || title === currentTitle) {
      return;
    }

    await runMutation(async () => {
      await api.updateChecklist(session.token, projectId, checklistId, title);
    }, 'Checklist atualizado com sucesso.');
  };

  const handleRemoveChecklist = async (checklistId: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    if (!window.confirm('Deseja remover este checklist?')) {
      return;
    }

    await runMutation(async () => {
      await api.removeChecklist(session.token, projectId, checklistId);
    }, 'Checklist removido com sucesso.');
  };

  const handleEditChecklistItem = async (itemId: string, currentContent: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    const content = window.prompt('Editar item do checklist', currentContent)?.trim();

    if (!content || content === currentContent) {
      return;
    }

    await runMutation(async () => {
      await api.updateChecklistItem(session.token, projectId, itemId, { content });
    }, 'Item do checklist atualizado com sucesso.');
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    if (!window.confirm('Deseja remover este item do checklist?')) {
      return;
    }

    await runMutation(async () => {
      await api.removeChecklistItem(session.token, projectId, itemId);
    }, 'Item removido do checklist.');
  };

  const handleAddComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !selectedCard || !canWrite) {
      return;
    }

    await runMutation(async () => {
      await api.addComment(session.token, projectId, selectedCard.id, newComment);
      setNewComment('');
    }, 'Comentário registrado no cartão.');
  };

  const handleAddLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !selectedCard || !canWrite) {
      return;
    }

    const linkTitle = newLinkTitle.trim();
    const linkUrl = newLinkUrl.trim();

    if (!linkTitle) {
      setErrorMessage('Informe o título do link.');
      return;
    }

    try {
      new URL(linkUrl);
    } catch {
      setErrorMessage('Informe uma URL válida para o link.');
      return;
    }

    await runMutation(async () => {
      await api.addLink(session.token, projectId, selectedCard.id, {
        title: linkTitle,
        url: linkUrl
      });
      setNewLinkTitle('');
      setNewLinkUrl('');
    }, 'Link adicionado ao cartão.');
  };

  const handleEditLink = async (linkId: string, currentTitle: string, currentUrl: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    const title = window.prompt('Título do link', currentTitle)?.trim();

    if (!title) {
      return;
    }

    const url = window.prompt('URL do link', currentUrl)?.trim();

    if (!url) {
      return;
    }

    await runMutation(async () => {
      await api.updateLink(session.token, projectId, linkId, { title, url });
    }, 'Link atualizado com sucesso.');
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    if (!window.confirm('Deseja remover este link?')) {
      return;
    }

    await runMutation(async () => {
      await api.removeLink(session.token, projectId, linkId);
    }, 'Link removido do cartão.');
  };

  const handleUploadAttachment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !selectedCard || !attachmentFile || !canWrite) {
      return;
    }

    await runMutation(async () => {
      await api.addAttachment(session.token, projectId, selectedCard.id, attachmentFile);
      setAttachmentFile(null);
    }, 'Anexo enviado para o cartão.');
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    if (!window.confirm('Deseja remover este anexo?')) {
      return;
    }

    await runMutation(async () => {
      await api.removeAttachment(session.token, projectId, attachmentId);
    }, 'Anexo removido com sucesso.');
  };

  const handleCreateLabel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    await runMutation(async () => {
      await api.createLabel(session.token, projectId, {
        name: newLabelName,
        color: newLabelColor
      });
      setNewLabelName('');
      setNewLabelColor('#1565C0');
    }, 'Etiqueta criada para o projeto.');
  };

  const handleUpdateLabel = async (labelId: string, currentName: string, currentColor: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    const name = window.prompt('Nome da etiqueta', currentName)?.trim();

    if (!name) {
      return;
    }

    const color = window.prompt('Cor da etiqueta (hex)', currentColor)?.trim() ?? currentColor;

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      setErrorMessage('Cor inválida. Use o formato #RRGGBB.');
      return;
    }

    await runMutation(async () => {
      await api.updateLabel(session.token, projectId, labelId, { name, color });
    }, 'Etiqueta atualizada com sucesso.');
  };

  const handleRemoveLabel = async (labelId: string) => {
    if (!session?.token || !projectId || !canWrite) {
      return;
    }

    if (!window.confirm('Deseja remover esta etiqueta do projeto?')) {
      return;
    }

    await runMutation(async () => {
      await api.removeLabel(session.token, projectId, labelId);
    }, 'Etiqueta removida com sucesso.');
  };

  return (
    <>
        <main className="flex min-h-[calc(100vh-176px)] min-w-0 flex-1 flex-col bg-[#f7f9fd]">
          <div className="border-b border-[#e2e8f2] bg-[#f9fbff] px-4 py-5 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="break-words text-[30px] font-semibold leading-tight text-[#191c21]">Quadro</h2>
                  <span className="rounded-[10px] border border-[#d4dceb] bg-white px-3 py-1 text-sm font-semibold text-[#3e4b61]">
                    {cardCountLabel}
                  </span>
                </div>
                <p className="text-sm text-[#64748b]">
                  Organize tarefas, responsáveis, prazos e entregas do projeto.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadBoard()}
                  disabled={isLoading || isMutating}
                  className="rounded-[10px] border border-[#d5deec] bg-white px-3.5 py-2 text-sm font-semibold text-[#425168] transition-colors hover:bg-[#f2f6fc] disabled:opacity-60"
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateColumnModal(true);
                  }}
                  disabled={!canWrite || isMutating}
                  title={!canWrite ? 'Seu perfil não possui permissão para criar colunas.' : undefined}
                  className="rounded-[10px] border border-[#d5deec] bg-white px-3.5 py-2 text-sm font-semibold text-[#425168] transition-colors hover:bg-[#f2f6fc] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Nova coluna
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetCreateCardForm();
                    setShowCreateCardModal(true);
                  }}
                  disabled={!canWrite || isMutating || !board?.columns.length}
                  title={!canWrite ? 'Seu perfil não possui permissão para criar cartões.' : undefined}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#ffba24] px-4 py-2 text-sm font-semibold text-[#6d4d00] transition-colors hover:bg-[#f4b118] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Novo cartão
                </button>
              </div>
            </div>
          </div>

          <div className="scrollbar-none min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-8 md:px-8">
            {isLoading && !board ? (
              <div className="rounded-[12px] border border-[#dfe5ef] bg-white px-4 py-3 text-sm text-[#424752]">
                Carregando quadro...
              </div>
            ) : null}

            {board && filteredColumns.length > 0 ? (
              <DndContext
                sensors={boardSensors}
                collisionDetection={closestCorners}
                onDragStart={handleBoardDragStart}
                onDragOver={handleBoardDragOver}
                onDragCancel={handleBoardDragCancel}
                onDragEnd={(event) => {
                  void handleBoardDragEnd(event);
                }}
              >
                <SortableContext
                  items={filteredColumns.map((column) => createDragId(COLUMN_DRAG_PREFIX, column.id))}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex h-full min-w-max items-start gap-5 pb-2">
                    {filteredColumns.map((column) => (
                      <SortableColumn key={column.id} column={column} disabled={!canDragColumns}>
                        {({ setNodeRef, attributes, listeners, style, isDragging }) => (
                          <section
                            ref={setNodeRef}
                            style={style}
                            className={cn(
                              'flex h-full w-[300px] shrink-0 flex-col rounded-[14px] border border-[#dde4f1] bg-[#f5f8fe] p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors',
                              isDragging ? 'border-[#adc1e6] bg-[#edf3ff]' : '',
                              activeBoardDrag?.type === 'card' && boardOverColumnId === column.id
                                ? 'border-[#1565C0]/45 bg-[#eef5ff]'
                                : ''
                            )}
                          >
                            <header className="mb-3 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-[#1f2937]">{column.title}</h3>
                                <p className="text-xs text-[#64748b]">
                                  {column.cards.length} {column.cards.length === 1 ? 'cartão' : 'cartões'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {canDragColumns ? (
                                  <button
                                    type="button"
                                    {...attributes}
                                    {...listeners}
                                    className="cursor-grab rounded-[8px] p-1 text-[#64748b] transition-colors hover:bg-white active:cursor-grabbing"
                                    title="Arrastar coluna"
                                    aria-label="Arrastar coluna"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                ) : null}
                                {(canWrite || canManageColumns) ? (
                                  <details className="group relative">
                                    <summary className="flex cursor-pointer list-none items-center rounded-[8px] p-1 text-[#64748b] transition-colors hover:bg-white">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </summary>
                                    <div className="absolute right-0 top-8 z-20 w-52 rounded-[10px] border border-[#d9e2f1] bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                                      <button
                                        type="button"
                                        onClick={() => void handleRenameColumn(column.id, column.title)}
                                        disabled={!canWrite || isMutating}
                                        className="w-full rounded-[8px] px-3 py-2 text-left text-sm text-[#334155] transition-colors hover:bg-[#f1f5fb] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Renomear coluna
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleMoveColumn(column.id, 'left')}
                                        disabled={!canManageColumns || isMutating}
                                        className="w-full rounded-[8px] px-3 py-2 text-left text-sm text-[#334155] transition-colors hover:bg-[#f1f5fb] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Mover para esquerda
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleMoveColumn(column.id, 'right')}
                                        disabled={!canManageColumns || isMutating}
                                        className="w-full rounded-[8px] px-3 py-2 text-left text-sm text-[#334155] transition-colors hover:bg-[#f1f5fb] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Mover para direita
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteColumn(column.id)}
                                        disabled={!canManageColumns || isMutating}
                                        className="w-full rounded-[8px] px-3 py-2 text-left text-sm text-[#b42318] transition-colors hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Excluir coluna
                                      </button>
                                    </div>
                                  </details>
                                ) : null}
                              </div>
                            </header>

                            <div
                              className={cn(
                                'scrollbar-none min-h-0 flex-1 space-y-3 overflow-y-auto',
                                activeBoardDrag?.type === 'card' && boardOverColumnId === column.id
                                  ? 'rounded-[10px] bg-[#edf4ff]/90 p-1'
                                  : ''
                              )}
                            >
                              <SortableContext
                                items={column.cards.map((card) => createDragId(CARD_DRAG_PREFIX, card.id))}
                                strategy={verticalListSortingStrategy}
                              >
                                {column.cards.map((card) => {
                                  const checklistProgress = formatChecklistProgress(card);
                                  const dueDateState = getDueDateState(card.dueDate);

                                  return (
                                    <SortableCard
                                      key={card.id}
                                      card={card}
                                      columnId={column.id}
                                      disabled={!canDragCards}
                                    >
                                      {({
                                        setNodeRef: setCardNodeRef,
                                        attributes: cardAttributes,
                                        listeners: cardListeners,
                                        style: cardStyle,
                                        isDragging: isDraggingCard
                                      }) => (
                                        <button
                                          ref={setCardNodeRef}
                                          type="button"
                                          {...cardAttributes}
                                          {...cardListeners}
                                          style={cardStyle}
                                          onClick={() => setSelectedCardId(card.id)}
                                          className={cn(
                                            'w-full rounded-[12px] border border-[#dbe3f0] bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-[#9eb4dc] hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]',
                                            selectedCardId === card.id ? 'border-[#2c6ecb] shadow-[0_4px_16px_rgba(44,110,203,0.16)]' : '',
                                            isDraggingCard ? 'shadow-[0_12px_26px_rgba(15,23,42,0.2)]' : '',
                                            canDragCards ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                          )}
                                        >
                                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            {card.priority ? (
                                              <span
                                                className={cn(
                                                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]',
                                                  priorityBadgeVariant[card.priority]
                                                )}
                                              >
                                                {priorityLabel[card.priority]}
                                              </span>
                                            ) : null}
                                            {card.sourceType === 'AI' ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-[#c5d8fc] bg-[#ebf2ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4f9f]">
                                                <Sparkles className="h-3 w-3" />
                                                IA
                                              </span>
                                            ) : null}
                                            {card.meetingId ? (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-[#d4dceb] bg-[#f6f8fc] px-2 py-0.5 text-[10px] font-semibold text-[#425168]">
                                                <Link2 className="h-3 w-3" />
                                                Reunião
                                              </span>
                                            ) : null}
                                          </div>

                                          <h4 className="text-sm font-semibold leading-snug text-[#0f172a]">{card.title}</h4>
                                          {card.description ? (
                                            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#475569]">{card.description}</p>
                                          ) : null}

                                          {card.labels.length > 0 ? (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                              {card.labels.slice(0, 3).map((label) => (
                                                <span
                                                  key={label.id}
                                                  className="inline-flex items-center gap-1 rounded-full border border-[#d6deeb] px-2 py-0.5 text-[10px] font-medium text-[#334155]"
                                                >
                                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                                                  {label.name}
                                                </span>
                                              ))}
                                            </div>
                                          ) : null}

                                          <div className="mt-3 flex items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5b6476]">
                                              <span
                                                className={cn(
                                                  'inline-flex items-center gap-1 rounded-full border border-[#d8e0ee] bg-[#f8fafc] px-2 py-0.5',
                                                  dueDateState?.className
                                                )}
                                              >
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                {formatDateLabel(card.dueDate)}
                                              </span>
                                              {checklistProgress ? (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-[#d8e0ee] bg-[#f8fafc] px-2 py-0.5">
                                                  <CheckSquare2 className="h-3.5 w-3.5" />
                                                  {checklistProgress}
                                                </span>
                                              ) : null}
                                              <span className="inline-flex items-center gap-1 rounded-full border border-[#d8e0ee] bg-[#f8fafc] px-2 py-0.5">
                                                <MessageSquare className="h-3.5 w-3.5" />
                                                {card.comments.length}
                                              </span>
                                              <span className="inline-flex items-center gap-1 rounded-full border border-[#d8e0ee] bg-[#f8fafc] px-2 py-0.5">
                                                <Paperclip className="h-3.5 w-3.5" />
                                                {card.attachments.length}
                                              </span>
                                            </div>

                                            {card.assignees.length > 0 ? (
                                              <div className="flex -space-x-2">
                                                {card.assignees.slice(0, 3).map((assignee) => (
                                                  <div
                                                    key={assignee.id}
                                                    className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white bg-[#e8edf7] text-[10px] font-semibold text-[#1e293b]"
                                                    title={assignee.user.name}
                                                  >
                                                    {getInitials(assignee.user.name)}
                                                  </div>
                                                ))}
                                                {card.assignees.length > 3 ? (
                                                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-[#e8edf7] text-[10px] font-semibold text-[#475569]">
                                                    +{card.assignees.length - 3}
                                                  </div>
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>
                                        </button>
                                      )}
                                    </SortableCard>
                                  );
                                })}
                              </SortableContext>

                              {column.cards.length === 0 ? (
                                <div className="rounded-[10px] border border-dashed border-[#c8d2e4] bg-white px-4 py-5 text-center">
                                  <p className="text-sm font-semibold text-[#334155]">Nenhum cartão nesta coluna.</p>
                                  <p className="mt-1 text-xs text-[#64748b]">
                                    Adicione um cartão manualmente ou gere tarefas a partir de uma reunião.
                                  </p>
                                </div>
                              ) : null}

                              {canWrite ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewCardColumnId(column.id);
                                    resetCreateCardForm();
                                    setShowCreateCardModal(true);
                                  }}
                                  className="w-full rounded-[10px] border border-dashed border-[#c8d2e4] bg-white py-2 text-sm font-medium text-[#334155] transition-colors hover:bg-[#f1f6ff]"
                                >
                                  + Adicionar cartão
                                </button>
                              ) : (
                                <p className="rounded-[10px] border border-dashed border-[#dbe3f0] bg-white px-3 py-2 text-center text-xs text-[#64748b]">
                                  Seu perfil é somente leitura neste quadro.
                                </p>
                              )}
                            </div>
                          </section>
                        )}
                      </SortableColumn>
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay dropAnimation={null}>
                  {activeDraggedCard ? (
                    <div className="w-[300px] rounded-[12px] border border-[#afc3e7] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.24)]">
                      <p className="text-sm font-semibold text-[#0f172a]">{activeDraggedCard.title}</p>
                      {activeDraggedCard.description ? (
                        <p className="mt-1.5 line-clamp-2 text-xs text-[#475569]">{activeDraggedCard.description}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {activeDraggedColumn ? (
                    <div className="w-[300px] rounded-[14px] border border-[#afc3e7] bg-white px-3 py-2 shadow-[0_14px_30px_rgba(15,23,42,0.2)]">
                      <p className="text-sm font-semibold text-[#0f172a]">{activeDraggedColumn.title}</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : null}

            {board && filteredColumns.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#c8d2e4] bg-white px-4 py-8 text-center text-sm text-[#64748b]">
                Nenhum cartão encontrado para a busca atual.
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="mx-4 mb-3 rounded-lg border border-[#ffdad6] bg-[#ffdad6]/40 px-4 py-3 text-sm text-[#93000a] md:mx-8">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="mx-4 mb-3 rounded-lg border border-[#d6e3ff] bg-[#d6e3ff]/35 px-4 py-3 text-sm text-[#003a75] md:mx-8">
              {successMessage}
            </p>
          ) : null}
        </main>

      {showCreateCardModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-[14px] border border-[#d6deeb] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-[#e7eef7] px-6 py-4">
              <h3 className="text-lg font-semibold text-[#191c21]">Novo cartão</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateCardModal(false);
                  resetCreateCardForm();
                }}
                className="rounded-md p-1 text-[#727783] hover:bg-[#ecedf6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4 px-6 py-5" onSubmit={handleCreateCard}>
              {newCardError ? (
                <p className="rounded-[10px] border border-[#ffd5ce] bg-[#fff1ee] px-3 py-2 text-sm text-[#9b1c1c]">
                  {newCardError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                    Título *
                  </label>
                  <input
                    value={newCardTitle}
                    onChange={(event) => {
                      setNewCardTitle(event.target.value);
                      if (newCardError) {
                        setNewCardError(null);
                      }
                    }}
                    className="h-10 w-full rounded-[10px] border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                    placeholder="Ex.: Preparar pauta da revisão semanal"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                    Descrição
                  </label>
                  <textarea
                    value={newCardDescription}
                    onChange={(event) => setNewCardDescription(event.target.value)}
                    rows={4}
                    className="w-full rounded-[10px] border border-[#c2c6d4] bg-[#f9f9ff] px-3 py-2 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                    placeholder="Contexto, critérios e observações importantes."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                    Coluna
                  </label>
                  <select
                    value={newCardColumnId}
                    onChange={(event) => setNewCardColumnId(event.target.value)}
                    className="h-10 w-full rounded-[10px] border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                    required
                  >
                    {board?.columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                    Prioridade
                  </label>
                  <select
                    value={newCardPriority}
                    onChange={(event) =>
                      setNewCardPriority(event.target.value as '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')
                    }
                    className="h-10 w-full rounded-[10px] border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                  >
                    <option value="">Sem prioridade</option>
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                    Prazo
                  </label>
                  <input
                    type="datetime-local"
                    value={newCardDueDate}
                    onChange={(event) => setNewCardDueDate(event.target.value)}
                    className="h-10 w-full rounded-[10px] border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                  />
                </div>

                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">Responsáveis</p>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-[10px] border border-[#d8e0ee] bg-[#f9f9ff] p-2">
                    {board?.members.map((member) => {
                      const checked = newCardAssigneeIds.includes(member.user.id);

                      return (
                        <label
                          key={member.user.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-sm text-[#334155] hover:bg-white"
                        >
                          <span>
                            {member.user.name}
                            <span className="ml-1 text-xs text-[#64748b]">
                              ({roleLabel[member.role] ?? member.role})
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setNewCardAssigneeIds((current) =>
                                checked ? current.filter((id) => id !== member.user.id) : [...current, member.user.id]
                              )
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e7eef7] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCardModal(false);
                    resetCreateCardForm();
                  }}
                  className="rounded-[10px] border border-[#c2c6d4] px-4 py-2 text-sm font-semibold text-[#424752] transition-colors hover:bg-[#ecedf6]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canWrite || isMutating}
                  className="rounded-[10px] bg-[#005eb8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004f9b] disabled:opacity-60"
                >
                  Criar cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateColumnModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#c2c6d4] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E7EEF7] px-5 py-4">
              <h3 className="text-lg font-semibold text-[#191c21]">Nova coluna</h3>
              <button
                type="button"
                onClick={() => setShowCreateColumnModal(false)}
                className="rounded-md p-1 text-[#727783] hover:bg-[#ecedf6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4 px-5 py-4" onSubmit={handleCreateColumn}>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#424752]">
                  Título da coluna
                </label>
                <input
                  value={newColumnTitle}
                  onChange={(event) => setNewColumnTitle(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#c2c6d4] bg-[#f9f9ff] px-3 text-sm text-[#191c21] outline-none transition-all focus:border-[#005eb8] focus:ring-1 focus:ring-[#005eb8]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateColumnModal(false)}
                  className="rounded-lg border border-[#c2c6d4] px-4 py-2 text-sm font-semibold text-[#424752] transition-colors hover:bg-[#ecedf6]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canWrite || isMutating}
                  className="rounded-lg bg-[#005eb8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004f9b] disabled:opacity-60"
                >
                  Criar coluna
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedCard ? (
        <CardDetailDrawer
          title="Detalhes do cartão"
          description={`Cartão ${selectedCard.id.slice(0, 8)}`}
          open={Boolean(selectedCard)}
          onClose={() => setSelectedCardId(null)}
          bodyClassName="p-0"
        >
          <div className="grid min-h-0 overflow-hidden lg:grid-cols-[1.45fr_0.9fr]">
            <div className="scrollbar-none min-h-0 space-y-6 overflow-y-auto border-b border-[#e4e9f2] p-5 lg:border-b-0 lg:border-r">
              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#475569]">
                      Título
                    </label>
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                    />
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-[#d9e1ed] bg-[#f8faff] px-3 py-1 text-xs font-semibold text-[#334155]">
                    {sourceLabel[editSourceType]}
                  </span>
                </div>
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Descrição</h4>
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={5}
                  placeholder="Adicione detalhes para orientar a execução deste cartão."
                  className="w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 py-2 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                />
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[#111827]">Checklist</h4>
                  <span className="text-xs text-[#64748b]">
                    {selectedCard.checklists.reduce((acc, checklist) => acc + checklist.items.length, 0)} itens
                  </span>
                </div>
                <form className="flex gap-2" onSubmit={handleAddChecklist}>
                  <input
                    value={newChecklistTitle}
                    onChange={(event) => setNewChecklistTitle(event.target.value)}
                    placeholder="Título do checklist"
                    className="h-10 flex-1 rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!canWrite || isMutating}
                    title={!canWrite ? 'Seu perfil não pode editar cartões.' : undefined}
                    className="rounded-[10px] border border-[#d9e1ed] px-3 py-2 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Adicionar
                  </button>
                </form>

                <div className="space-y-3">
                  {selectedCard.checklists.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-[#d9e1ed] px-4 py-4 text-sm text-[#64748b]">
                      Nenhum checklist neste cartão.
                    </p>
                  ) : null}
                  {selectedCard.checklists.map((checklist) => (
                    <div key={checklist.id} className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{checklist.title}</p>
                          <p className="text-xs text-[#64748b]">{formatChecklistSummary(checklist.items)}</p>
                        </div>
                        {canWrite ? (
                          <details className="relative">
                            <summary className="flex cursor-pointer list-none items-center rounded-[8px] p-1 text-[#64748b] hover:bg-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </summary>
                            <div className="absolute right-0 top-8 z-20 w-44 rounded-[10px] border border-[#d9e2f1] bg-white p-1 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                              <button
                                type="button"
                                onClick={() => void handleRenameChecklist(checklist.id, checklist.title)}
                                className="w-full rounded-[8px] px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#f1f5fb]"
                              >
                                Renomear checklist
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRemoveChecklist(checklist.id)}
                                className="w-full rounded-[8px] px-3 py-2 text-left text-sm text-[#b42318] hover:bg-[#fff1ef]"
                              >
                                Remover checklist
                              </button>
                            </div>
                          </details>
                        ) : null}
                      </div>

                      <DndContext
                        sensors={checklistSensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleChecklistDragStart}
                        onDragEnd={(event) => {
                          void handleChecklistDragEnd(event, checklist);
                        }}
                        onDragCancel={() => setActiveChecklistDrag(null)}
                      >
                        <SortableContext
                          items={checklist.items.map((item) => createDragId(CHECKLIST_ITEM_DRAG_PREFIX, item.id))}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="mt-2 space-y-2">
                            {checklist.items.map((item) => (
                              <SortableChecklistItem
                                key={item.id}
                                checklistId={checklist.id}
                                item={item}
                                disabled={!canWrite || isMutating}
                              >
                                {({
                                  setNodeRef: setChecklistItemNodeRef,
                                  attributes: checklistItemAttributes,
                                  listeners: checklistItemListeners,
                                  style: checklistItemStyle,
                                  isDragging: isDraggingChecklistItem
                                }) => (
                                  <div
                                    ref={setChecklistItemNodeRef}
                                    style={checklistItemStyle}
                                    className={cn(
                                      'flex items-center gap-2 rounded-[8px] bg-white px-2 py-2 text-sm text-[#334155]',
                                      isDraggingChecklistItem ? 'shadow-[0_8px_18px_rgba(17,24,39,0.16)]' : ''
                                    )}
                                  >
                                    {canWrite ? (
                                      <button
                                        type="button"
                                        {...checklistItemAttributes}
                                        {...checklistItemListeners}
                                        className="cursor-grab rounded-[8px] p-1 text-[#64748b] transition-colors hover:bg-[#f1f5f9] active:cursor-grabbing"
                                        title="Reordenar item"
                                        aria-label="Reordenar item"
                                      >
                                        <GripVertical className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                    <input
                                      type="checkbox"
                                      checked={item.isCompleted}
                                      onChange={() => void handleToggleChecklistItem(item.id, item.isCompleted)}
                                      disabled={!canWrite || isMutating}
                                    />
                                    <span className={cn('flex-1', item.isCompleted ? 'line-through opacity-70' : '')}>
                                      {item.content}
                                    </span>
                                    {canWrite ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => void handleEditChecklistItem(item.id, item.content)}
                                          className="rounded-[8px] p-1 text-[#64748b] hover:bg-[#f1f5f9]"
                                          title="Editar item"
                                        >
                                          <PencilLine className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleRemoveChecklistItem(item.id)}
                                          className="rounded-[8px] p-1 text-[#b42318] hover:bg-[#ffebe9]"
                                          title="Remover item"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </SortableChecklistItem>
                            ))}
                          </div>
                        </SortableContext>

                        <DragOverlay dropAnimation={null}>
                          {activeChecklistDrag?.checklistId === checklist.id ? (
                            <div className="rounded-[8px] border border-[#c2c6d4] bg-white px-3 py-2 text-sm text-[#334155] shadow-[0_8px_18px_rgba(17,24,39,0.18)]">
                              {checklist.items.find((item) => item.id === activeChecklistDrag.id)?.content ?? 'Item'}
                            </div>
                          ) : null}
                        </DragOverlay>
                      </DndContext>

                      <div className="mt-2 flex gap-2">
                        <input
                          value={newChecklistItemByChecklistId[checklist.id] ?? ''}
                          onChange={(event) =>
                            setNewChecklistItemByChecklistId((current) => ({
                              ...current,
                              [checklist.id]: event.target.value
                            }))
                          }
                          placeholder="Adicionar item"
                          className="h-9 flex-1 rounded-[10px] border border-[#d9e1ed] bg-white px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAddChecklistItem(checklist.id)}
                          disabled={!canWrite || isMutating}
                          className="rounded-[10px] border border-[#d9e1ed] px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#f8faff] disabled:opacity-60"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Comentários</h4>
                <form className="space-y-2" onSubmit={handleAddComment}>
                  <textarea
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    rows={3}
                    placeholder="Escreva um comentário"
                    className="w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 py-2 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!canWrite || isMutating}
                    title={!canWrite ? 'Seu perfil não pode comentar.' : undefined}
                    className="rounded-[10px] border border-[#d9e1ed] px-3 py-2 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Comentar
                  </button>
                </form>
                <div className="space-y-2">
                  {selectedCard.comments.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-[#d9e1ed] px-4 py-4 text-sm text-[#64748b]">
                      Nenhum comentário neste cartão.
                    </p>
                  ) : null}
                  {selectedCard.comments.map((comment) => (
                    <div key={comment.id} className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7edf9] text-[11px] font-semibold text-[#334155]">
                          {getInitials(comment.author.name)}
                        </span>
                        <p className="text-sm font-medium text-[#111827]">{comment.author.name}</p>
                      </div>
                      <p className="mt-2 text-sm text-[#1f2937]">{comment.content}</p>
                      <p className="mt-1 text-[11px] text-[#64748b]">
                        {new Date(comment.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Anexos e links</h4>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#475569]">Links</p>
                  <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleAddLink}>
                    <input
                      value={newLinkTitle}
                      onChange={(event) => setNewLinkTitle(event.target.value)}
                      placeholder="Título"
                      className="h-10 rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                      required
                    />
                    <input
                      value={newLinkUrl}
                      onChange={(event) => setNewLinkUrl(event.target.value)}
                      placeholder="https://..."
                      className="h-10 rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                      required
                    />
                    <button
                      type="submit"
                      disabled={!canWrite || isMutating}
                      className="rounded-[10px] border border-[#d9e1ed] px-3 py-2 text-sm font-semibold text-[#334155] hover:bg-[#f8faff] disabled:opacity-60"
                    >
                      Adicionar link
                    </button>
                  </form>

                  <div className="space-y-2">
                    {selectedCard.links.length === 0 ? (
                      <p className="rounded-[10px] border border-dashed border-[#d9e1ed] px-3 py-3 text-sm text-[#64748b]">
                        Nenhum link adicionado.
                      </p>
                    ) : null}
                    {selectedCard.links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#0f172a]">{link.title}</p>
                          <p className="truncate text-xs text-[#64748b]">{link.url}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-[8px] border border-[#d5deec] px-2 py-1 text-xs font-semibold text-[#1d4f9f] hover:bg-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir
                          </a>
                          {canWrite ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleEditLink(link.id, link.title, link.url)}
                                className="rounded-[8px] p-1 text-[#64748b] hover:bg-white"
                                title="Editar link"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRemoveLink(link.id)}
                                className="rounded-[8px] p-1 text-[#b42318] hover:bg-[#ffebe9]"
                                title="Remover link"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#475569]">Anexos</p>
                  <form className="flex flex-wrap items-center gap-2" onSubmit={handleUploadAttachment}>
                    <input
                      type="file"
                      onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                      className="min-w-[220px] flex-1 rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 py-2 text-sm text-[#111827]"
                    />
                    <button
                      type="submit"
                      disabled={!canWrite || !attachmentFile || isMutating}
                      className="rounded-[10px] border border-[#d9e1ed] px-3 py-2 text-sm font-semibold text-[#334155] hover:bg-[#f8faff] disabled:opacity-60"
                    >
                      Adicionar anexo
                    </button>
                  </form>

                  <div className="space-y-2">
                    {selectedCard.attachments.length === 0 ? (
                      <p className="rounded-[10px] border border-dashed border-[#d9e1ed] px-3 py-3 text-sm text-[#64748b]">
                        Nenhum anexo enviado.
                      </p>
                    ) : null}
                    {selectedCard.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#0f172a]">{attachment.name}</p>
                          <p className="truncate text-xs text-[#64748b]">
                            {(attachment.mimeType ?? 'Arquivo')} • {formatFileSize(attachment.sizeBytes)} •{' '}
                            {attachment.uploadedBy.name} • {new Date(attachment.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-[8px] border border-[#d5deec] px-2 py-1 text-xs font-semibold text-[#1d4f9f] hover:bg-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir
                          </a>
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() => void handleRemoveAttachment(attachment.id)}
                              className="rounded-[8px] p-1 text-[#b42318] hover:bg-[#ffebe9]"
                              title="Remover anexo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Atividade</h4>
                <ul className="space-y-2 text-sm text-[#334155]">
                  {selectedCard.activities.length === 0 ? (
                    <li className="rounded-[10px] border border-dashed border-[#d9e1ed] px-3 py-3 text-[#64748b]">
                      Nenhuma atividade registrada até o momento.
                    </li>
                  ) : null}
                  {selectedCard.activities.map((activity) => (
                    <li key={activity.id} className="rounded-[10px] border border-[#e4e9f2] bg-[#f8faff] px-3 py-2">
                      <p className="text-sm font-medium text-[#0f172a]">{formatActivityMessage(activity, columnsById)}</p>
                      <p className="mt-0.5 text-xs text-[#64748b]">
                        {new Date(activity.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="scrollbar-none min-h-0 space-y-4 overflow-y-auto bg-[#f8faff] p-5">
              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Coluna e origem</h4>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#475569]">
                      Coluna / status
                    </label>
                    <select
                      value={editColumnId}
                      onChange={(event) => setEditColumnId(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827]"
                    >
                      {board?.columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#475569]">
                      Origem
                    </label>
                    <select
                      value={editSourceType}
                      onChange={(event) => setEditSourceType(event.target.value as 'MANUAL' | 'AI')}
                      className="h-10 w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827]"
                    >
                      <option value="MANUAL">{sourceLabel.MANUAL}</option>
                      <option value="AI">{sourceLabel.AI}</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Prazo e prioridade</h4>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#475569]">
                      Prazo
                    </label>
                    <input
                      type="datetime-local"
                      value={editDueDate}
                      onChange={(event) => setEditDueDate(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                    />
                    {editDueDateState ? (
                      <p className={cn('mt-1 text-xs font-medium', editDueDateState.className)}>{editDueDateState.label}</p>
                    ) : (
                      <p className="mt-1 text-xs text-[#64748b]">Sem prazo definido.</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-[#475569]">
                      Prioridade
                    </label>
                    <select
                      value={editPriority}
                      onChange={(event) =>
                        setEditPriority(event.target.value as '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')
                      }
                      className="h-10 w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827]"
                    >
                      <option value="">Sem prioridade</option>
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {editPriority ? (
                      <span
                        className={cn(
                          'mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold',
                          priorityBadgeVariant[editPriority]
                        )}
                      >
                        {priorityLabel[editPriority]}
                      </span>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Responsáveis</h4>
                <div className="space-y-2">
                  {selectedAssignees.length === 0 ? (
                    <p className="rounded-[8px] border border-dashed border-[#d9e1ed] px-3 py-2 text-sm text-[#64748b]">
                      Nenhum responsável atribuído.
                    </p>
                  ) : null}
                  {selectedAssignees.map((member) => (
                    <div key={member.user.id} className="flex items-center justify-between rounded-[8px] bg-[#f8faff] px-2 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8edf7] text-[11px] font-semibold text-[#334155]">
                          {getInitials(member.user.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#1f2937]">{member.user.name}</p>
                          <p className="text-xs text-[#64748b]">{roleLabel[member.role] ?? member.role}</p>
                        </div>
                      </div>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEditAssigneeIds((current) => current.filter((id) => id !== member.user.id))
                          }
                          className="rounded-[8px] p-1 text-[#b42318] hover:bg-[#ffebe9]"
                          aria-label={`Remover ${member.user.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <select
                  value=""
                  onChange={(event) => {
                    const selectedUserId = event.target.value;
                    if (!selectedUserId) {
                      return;
                    }

                    setEditAssigneeIds((current) =>
                      current.includes(selectedUserId) ? current : [...current, selectedUserId]
                    );
                  }}
                  disabled={!canWrite || isMutating || availableAssignees.length === 0}
                  className="h-10 w-full rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827] disabled:opacity-60"
                >
                  <option value="">Adicionar responsável...</option>
                  {availableAssignees.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name} ({roleLabel[member.role] ?? member.role})
                    </option>
                  ))}
                </select>
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Etiquetas</h4>
                <div className="flex flex-wrap gap-1.5">
                  {board?.labels.map((label) => {
                    const isSelected = editLabelIds.includes(label.id);

                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() =>
                          setEditLabelIds((current) =>
                            isSelected ? current.filter((id) => id !== label.id) : [...current, label.id]
                          )
                        }
                        disabled={!canWrite || isMutating}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors',
                          isSelected
                            ? 'border-[#9eb7e3] bg-[#ebf2ff] text-[#1d4f9f]'
                            : 'border-[#d5deec] bg-[#f8fafc] text-[#334155]',
                          'disabled:cursor-not-allowed disabled:opacity-60'
                        )}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                        {label.name}
                      </button>
                    );
                  })}
                </div>

                <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={handleCreateLabel}>
                  <input
                    value={newLabelName}
                    onChange={(event) => setNewLabelName(event.target.value)}
                    placeholder="Nova etiqueta"
                    className="h-9 rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 text-sm text-[#111827] outline-none transition-all focus:border-[#1565C0]/45 focus:ring-2 focus:ring-[#1565C0]/20"
                    required
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(event) => setNewLabelColor(event.target.value)}
                      className="h-9 w-11 rounded-[8px] border border-[#d9e1ed] bg-white p-1"
                    />
                    <button
                      type="submit"
                      disabled={!canWrite || isMutating}
                      className="rounded-[10px] border border-[#d9e1ed] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#f8faff] disabled:opacity-60"
                    >
                      Criar
                    </button>
                  </div>
                </form>

                <div className="space-y-1.5">
                  {board?.labels.map((label) => (
                    <div key={label.id} className="flex items-center justify-between rounded-[8px] px-1 py-1">
                      <span className="inline-flex items-center gap-2 text-xs text-[#334155]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                        {label.name}
                      </span>
                      {canWrite ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleUpdateLabel(label.id, label.name, label.color)}
                            className="rounded-[8px] p-1 text-[#64748b] hover:bg-[#f1f5f9]"
                            title="Editar etiqueta"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveLabel(label.id)}
                            className="rounded-[8px] p-1 text-[#b42318] hover:bg-[#ffebe9]"
                            title="Remover etiqueta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Reunião vinculada</h4>
                {selectedCard.meetingId ? (
                  <Link
                    href={`/projects/${projectId}/meetings/${selectedCard.meetingId}`}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-[#d9e1ed] bg-[#fbfcff] px-3 py-2 text-sm font-medium text-[#1565C0] hover:bg-[#eef4ff]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir reunião
                  </Link>
                ) : (
                  <p className="rounded-[8px] border border-dashed border-[#d9e1ed] px-3 py-2 text-sm text-[#64748b]">
                    Sem reunião vinculada.
                  </p>
                )}
              </section>

              <section className="space-y-3 rounded-[12px] border border-[#e4e9f2] bg-white p-4">
                <h4 className="text-sm font-semibold text-[#111827]">Ações</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveCard()}
                    disabled={!canWrite || isMutating}
                    title={!canWrite ? 'Seu perfil não pode editar cartões.' : undefined}
                    className="rounded-[10px] bg-[#005eb8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004f9b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Salvar alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCard()}
                    disabled={!canWrite || isMutating}
                    title={!canWrite ? 'Seu perfil não pode excluir cartões.' : undefined}
                    className="rounded-[10px] border border-[#ffdad6] bg-[#fff1ef] px-4 py-2 text-sm font-semibold text-[#93000a] transition-colors hover:bg-[#ffe4df] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Excluir cartão
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCardId(null)}
                    className="rounded-[10px] border border-[#d9e1ed] px-4 py-2 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#f8faff]"
                  >
                    Fechar
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </CardDetailDrawer>
      ) : null}
    </>
  );
}
