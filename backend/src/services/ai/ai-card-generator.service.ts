import { CardPriority, Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import type { DeepseekMeetingAnalysisOutput } from './deepseek-meeting-analysis.service';

const DEFAULT_BOARD_COLUMNS = ['A Fazer', 'Em Andamento', 'Em Revisão', 'Concluído'] as const;
const TODO_COLUMN_TITLE = 'A Fazer';

type ActionItem = DeepseekMeetingAnalysisOutput['actionItems'][number];

type ProjectMemberUser = {
  userId: string;
  name: string;
  email: string;
  normalizedName: string;
  normalizedFirstName: string;
  normalizedEmail: string;
};

export type AiCardGenerationResult = {
  createdCards: number;
  skippedDuplicates: number;
  assignedCards: number;
  cardsWithChecklist: number;
  cardsWithSuggestions: number;
};

type AssigneeResolution = {
  assignedUserIds: string[];
  unresolvedSuggestions: string[];
};

const normalizeText = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const compactWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const uniqueNonEmpty = (values: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values.map((entry) => compactWhitespace(entry)).filter(Boolean)) {
    const key = normalizeText(value);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value);
  }

  return output;
};

const toCardPriority = (value: string | null | undefined): CardPriority | null => {
  const normalized = value?.trim().toLowerCase() ?? '';

  if (normalized === 'low') {
    return 'LOW';
  }

  if (normalized === 'medium') {
    return 'MEDIUM';
  }

  if (normalized === 'high') {
    return 'HIGH';
  }

  if (normalized === 'urgent') {
    return 'URGENT';
  }

  return null;
};

const toDateOrNull = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const timestamp = Date.parse(trimmed);

  if (Number.isFinite(timestamp)) {
    return new Date(timestamp);
  }

  const ddmmyyyy = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/
  );

  if (!ddmmyyyy) {
    return null;
  }

  const day = Number.parseInt(ddmmyyyy[1], 10);
  const month = Number.parseInt(ddmmyyyy[2], 10);
  const yearRaw = Number.parseInt(ddmmyyyy[3], 10);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const hour = ddmmyyyy[4] ? Number.parseInt(ddmmyyyy[4], 10) : 9;
  const minute = ddmmyyyy[5] ? Number.parseInt(ddmmyyyy[5], 10) : 0;

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export class AiCardGeneratorService {
  async generateCardsFromMeetingAnalysis(input: {
    projectId: string;
    meetingId: string;
    createdByUserId: string;
    actionItems: DeepseekMeetingAnalysisOutput['actionItems'];
  }): Promise<AiCardGenerationResult> {
    if (input.actionItems.length === 0) {
      return {
        createdCards: 0,
        skippedDuplicates: 0,
        assignedCards: 0,
        cardsWithChecklist: 0,
        cardsWithSuggestions: 0
      };
    }

    return prisma.$transaction(async (tx) => {
      const todoColumnId = await this.resolveTodoColumnId(tx, input.projectId);
      const projectMembers = await this.loadProjectMembers(tx, input.projectId);
      const existingSignatures = await this.loadExistingMeetingCardSignatures(
        tx,
        input.projectId,
        input.meetingId
      );

      const titleSignatureSet = new Set(existingSignatures.titleSignatures);
      const fullSignatureSet = new Set(existingSignatures.fullSignatures);

      let createdCards = 0;
      let skippedDuplicates = 0;
      let assignedCards = 0;
      let cardsWithChecklist = 0;
      let cardsWithSuggestions = 0;
      const maxTodoPosition = await tx.card.aggregate({
        where: {
          boardColumnId: todoColumnId
        },
        _max: {
          position: true
        }
      });
      let nextCardPosition = (maxTodoPosition._max.position ?? 0) + 1;

      for (const actionItem of input.actionItems) {
        const prepared = this.prepareActionItem(actionItem);

        if (!prepared) {
          continue;
        }

        const titleSignature = normalizeText(prepared.title);
        const fullSignature = this.buildCardSignature(prepared.title, prepared.description);

        const hasDuplicate =
          titleSignatureSet.has(titleSignature) || fullSignatureSet.has(fullSignature);

        if (hasDuplicate) {
          skippedDuplicates += 1;
          continue;
        }

        const assigneeResolution = this.resolveAssignees(prepared.assignees, projectMembers);
        const checklistItems = this.buildChecklistSuggestions(prepared.description);
        const description = this.mergeDescriptionWithSuggestions(
          prepared.description,
          assigneeResolution.unresolvedSuggestions
        );

        const card = await tx.card.create({
          data: {
            boardColumnId: todoColumnId,
            projectId: input.projectId,
            meetingId: input.meetingId,
            position: nextCardPosition,
            title: prepared.title,
            description,
            sourceType: 'AI',
            priority: toCardPriority(prepared.priority),
            dueDate: toDateOrNull(prepared.dueDate),
            createdByUserId: input.createdByUserId,
            assignees: assigneeResolution.assignedUserIds.length
              ? {
                  createMany: {
                    data: assigneeResolution.assignedUserIds.map((userId) => ({ userId })),
                    skipDuplicates: true
                  }
                }
              : undefined,
            checklists: checklistItems.length
              ? {
                  create: [
                    {
                      title: 'Checklist sugerido (IA)',
                      position: 1,
                      items: {
                        create: checklistItems.map((content, index) => ({
                          content,
                          position: index + 1
                        }))
                      }
                    }
                  ]
                }
              : undefined
          },
          select: {
            id: true
          }
        });

        nextCardPosition += 1;

        if (!card.id) {
          throw new AppError(500, 'Falha ao criar card automático da reunião.');
        }

        createdCards += 1;
        titleSignatureSet.add(titleSignature);
        fullSignatureSet.add(fullSignature);

        if (assigneeResolution.assignedUserIds.length > 0) {
          assignedCards += 1;
        }

        if (checklistItems.length > 0) {
          cardsWithChecklist += 1;
        }

        if (assigneeResolution.unresolvedSuggestions.length > 0) {
          cardsWithSuggestions += 1;
        }
      }

      return {
        createdCards,
        skippedDuplicates,
        assignedCards,
        cardsWithChecklist,
        cardsWithSuggestions
      };
    });
  }

  private async resolveTodoColumnId(
    tx: Prisma.TransactionClient,
    projectId: string
  ): Promise<string> {
    const project = await tx.project.findUnique({
      where: {
        id: projectId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto da reunião não encontrado para geração de cards.');
    }

    let board = await tx.board.findUnique({
      where: {
        projectId
      },
      include: {
        columns: {
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!board) {
      board = await tx.board.create({
        data: {
          projectId,
          name: 'Board padrão'
        },
        include: {
          columns: true
        }
      });
    }

    if (!board) {
      throw new AppError(500, 'Falha ao garantir board do projeto para criação de cards IA.');
    }

    const boardId = board.id;

    if (board.columns.length === 0) {
      await tx.boardColumn.createMany({
        data: DEFAULT_BOARD_COLUMNS.map((title, index) => ({
          boardId,
          title,
          position: index + 1
        })),
        skipDuplicates: true
      });

      board = await tx.board.findUnique({
        where: {
          id: boardId
        },
        include: {
          columns: {
            orderBy: {
              position: 'asc'
            }
          }
        }
      });
    }

    if (!board || board.columns.length === 0) {
      throw new AppError(500, 'Board sem colunas disponíveis para criar cards automáticos.');
    }

    const todoColumn =
      board.columns.find((column) => normalizeText(column.title) === normalizeText(TODO_COLUMN_TITLE)) ??
      board.columns[0];

    return todoColumn.id;
  }

  private async loadProjectMembers(
    tx: Prisma.TransactionClient,
    projectId: string
  ): Promise<ProjectMemberUser[]> {
    const members = await tx.projectMember.findMany({
      where: {
        projectId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return members.map((member) => {
      const normalizedName = normalizeText(member.user.name);
      const firstToken = normalizedName.split(' ')[0] ?? '';

      return {
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        normalizedName,
        normalizedFirstName: firstToken,
        normalizedEmail: member.user.email.trim().toLowerCase()
      };
    });
  }

  private async loadExistingMeetingCardSignatures(
    tx: Prisma.TransactionClient,
    projectId: string,
    meetingId: string
  ): Promise<{
    titleSignatures: string[];
    fullSignatures: string[];
  }> {
    const cards = await tx.card.findMany({
      where: {
        projectId,
        meetingId,
        sourceType: 'AI'
      },
      select: {
        title: true,
        description: true
      }
    });

    return {
      titleSignatures: cards.map((card) => normalizeText(card.title)),
      fullSignatures: cards.map((card) => this.buildCardSignature(card.title, card.description))
    };
  }

  private prepareActionItem(actionItem: ActionItem): {
    title: string;
    description: string | null;
    assignees: string[];
    dueDate: string | null;
    priority: string | null;
  } | null {
    const title = compactWhitespace(actionItem.title ?? '');

    if (!title) {
      return null;
    }

    const description = actionItem.description ? compactWhitespace(actionItem.description) : null;

    return {
      title,
      description,
      assignees: uniqueNonEmpty(actionItem.assignees ?? []),
      dueDate: actionItem.dueDate ? compactWhitespace(actionItem.dueDate) : null,
      priority: actionItem.priority ?? null
    };
  }

  private buildCardSignature(title: string, description: string | null): string {
    return `${normalizeText(title)}|${normalizeText(description ?? '')}`;
  }

  private resolveAssignees(
    assignees: string[],
    projectMembers: ProjectMemberUser[]
  ): AssigneeResolution {
    if (assignees.length === 0 || projectMembers.length === 0) {
      return {
        assignedUserIds: [],
        unresolvedSuggestions: []
      };
    }

    const assigned = new Set<string>();
    const unresolved: string[] = [];

    for (const assignee of assignees) {
      const matched = this.matchAssignee(assignee, projectMembers);

      if (!matched) {
        unresolved.push(assignee);
        continue;
      }

      assigned.add(matched.userId);
    }

    return {
      assignedUserIds: [...assigned],
      unresolvedSuggestions: uniqueNonEmpty(unresolved)
    };
  }

  private matchAssignee(
    rawAssignee: string,
    projectMembers: ProjectMemberUser[]
  ): ProjectMemberUser | null {
    const assignee = compactWhitespace(rawAssignee);
    const normalized = normalizeText(assignee);

    if (!normalized) {
      return null;
    }

    const emailFromText = assignee.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();

    if (emailFromText) {
      const byEmail = projectMembers.filter((member) => member.normalizedEmail === emailFromText);

      if (byEmail.length === 1) {
        return byEmail[0];
      }
    }

    const byExactName = projectMembers.filter((member) => member.normalizedName === normalized);

    if (byExactName.length === 1) {
      return byExactName[0];
    }

    const firstName = normalized.split(' ')[0] ?? '';

    if (firstName && firstName.length >= 3) {
      const byFirstName = projectMembers.filter((member) => member.normalizedFirstName === firstName);

      if (byFirstName.length === 1) {
        return byFirstName[0];
      }
    }

    const byContains = projectMembers.filter((member) => member.normalizedName.includes(normalized));

    if (byContains.length === 1) {
      return byContains[0];
    }

    return null;
  }

  private buildChecklistSuggestions(description: string | null): string[] {
    if (!description) {
      return [];
    }

    const fromLines = uniqueNonEmpty(
      description
        .split(/\r?\n/)
        .map((line) => line.trim())
        .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((line) => line.length >= 6)
    );

    if (fromLines.length >= 2) {
      return fromLines.slice(0, 8);
    }

    if (description.length < 120) {
      return [];
    }

    const fromSentences = uniqueNonEmpty(
      description
        .split(/[.;]\s+/)
        .map((sentence) => sentence.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((sentence) => sentence.length >= 10)
    );

    if (fromSentences.length >= 2) {
      return fromSentences.slice(0, 6);
    }

    return [];
  }

  private mergeDescriptionWithSuggestions(
    description: string | null,
    unresolvedSuggestions: string[]
  ): string | null {
    if (unresolvedSuggestions.length === 0) {
      return description;
    }

    const suggestionsText = `Sugestões de responsáveis (IA): ${unresolvedSuggestions.join(', ')}`;

    if (!description) {
      return suggestionsText;
    }

    return `${description}\n\n${suggestionsText}`;
  }
}

export const aiCardGeneratorService = new AiCardGeneratorService();
