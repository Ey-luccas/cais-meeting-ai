import type { CardPriority, OrganizationRole, Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLOSED_COLUMN_KEYWORDS = [
  'concluido',
  'concluida',
  'finalizado',
  'finalizada',
  'done',
  'completed',
  'encerrado',
  'encerrada'
] as const;

type PeriodBucket = {
  start: Date;
  end: Date;
  meetings: number;
  decisions: number;
  topics: number;
  actionItems: number;
  pendingItems: number;
};

type ProjectReportsResult = {
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
    priority: CardPriority | null;
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

type CounterEntry = {
  label: string;
  count: number;
  lastSeenAt: Date;
};

export class ReportsService {
  async getProjectReport(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    days: number;
  }): Promise<ProjectReportsResult> {
    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole
    });

    const now = new Date();
    const periodStart = new Date(now.getTime() - input.days * DAY_IN_MS);
    const bucketSizeDays = this.resolveBucketSizeDays(input.days);

    const [totalMeetings, meetingsInPeriod, aiCardsFromMeetings] = await Promise.all([
      prisma.meeting.count({
        where: {
          projectId: input.projectId
        }
      }),
      prisma.meeting.findMany({
        where: {
          projectId: input.projectId,
          createdAt: {
            gte: periodStart,
            lte: now
          }
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          note: {
            select: {
              createdAt: true,
              topicsJson: true,
              decisionsJson: true,
              actionItemsJson: true,
              pendingItemsJson: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.card.findMany({
        where: {
          projectId: input.projectId,
          sourceType: 'AI',
          meetingId: {
            not: null
          }
        },
        include: {
          boardColumn: {
            select: {
              title: true
            }
          },
          meeting: {
            select: {
              id: true,
              title: true
            }
          },
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true
                }
              }
            }
          }
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
      })
    ]);

    const topicCounter = new Map<string, CounterEntry>();
    const pendingCounter = new Map<string, CounterEntry>();
    const decisions: Array<{
      meetingId: string;
      meetingTitle: string;
      decision: string;
      createdAt: string;
    }> = [];

    const periodBuckets = this.createPeriodBuckets(periodStart, now, bucketSizeDays);

    let decisionsInPeriod = 0;
    let topicsMentionsInPeriod = 0;
    let pendingMentionsInPeriod = 0;

    for (const meeting of meetingsInPeriod) {
      const topics = this.parseStringArray(meeting.note?.topicsJson ?? null);
      const decisionItems = this.parseStringArray(meeting.note?.decisionsJson ?? null);
      const pendingItems = this.parseStringArray(meeting.note?.pendingItemsJson ?? null);
      const actionItems = this.parseActionItems(meeting.note?.actionItemsJson ?? null);
      const evidenceDate = meeting.note?.createdAt ?? meeting.createdAt;

      topicsMentionsInPeriod += topics.length;
      decisionsInPeriod += decisionItems.length;
      pendingMentionsInPeriod += pendingItems.length;

      topics.forEach((topic) => this.bumpCounter(topicCounter, topic, evidenceDate));
      pendingItems.forEach((item) => this.bumpCounter(pendingCounter, item, evidenceDate));

      decisionItems.forEach((decision) => {
        decisions.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          decision,
          createdAt: evidenceDate.toISOString()
        });
      });

      const bucket = this.findBucket(periodBuckets, meeting.createdAt);

      if (bucket) {
        bucket.meetings += 1;
        bucket.decisions += decisionItems.length;
        bucket.topics += topics.length;
        bucket.actionItems += actionItems.length;
        bucket.pendingItems += pendingItems.length;
      }
    }

    const openTasks = aiCardsFromMeetings
      .filter((card) => !this.isClosedColumn(card.boardColumn.title))
      .map((card) => ({
        cardId: card.id,
        title: card.title,
        description: card.description,
        priority: card.priority,
        dueDate: card.dueDate?.toISOString() ?? null,
        columnTitle: card.boardColumn.title,
        meeting: {
          id: card.meeting?.id ?? '',
          title: card.meeting?.title ?? 'Reunião'
        },
        assignees: card.assignees.map((assignee) => ({
          id: assignee.user.id,
          name: assignee.user.name,
          email: assignee.user.email,
          avatarUrl: assignee.user.avatarUrl
        }))
      }));

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color
      },
      period: {
        days: input.days,
        from: periodStart.toISOString(),
        to: now.toISOString(),
        bucketSizeDays,
        meetingsInPeriod: meetingsInPeriod.length,
        totalMeetingsInProject: totalMeetings
      },
      overview: {
        totalMeetings,
        meetingsInPeriod: meetingsInPeriod.length,
        decisionsInPeriod,
        topicsMentionsInPeriod,
        pendingMentionsInPeriod,
        openTasksFromMeetings: openTasks.length
      },
      recurringTopics: this.counterToList(topicCounter, 10).map((entry) => ({
        topic: entry.label,
        count: entry.count,
        lastSeenAt: entry.lastSeenAt.toISOString()
      })),
      recentDecisions: decisions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12),
      openTasksFromMeetings: openTasks.slice(0, 30),
      pendingHighlights: this.counterToList(pendingCounter, 10).map((entry) => ({
        item: entry.label,
        count: entry.count,
        lastSeenAt: entry.lastSeenAt.toISOString()
      })),
      periodSummary: periodBuckets.map((bucket) => ({
        label: this.formatBucketLabel(bucket.start, bucket.end, bucketSizeDays),
        start: bucket.start.toISOString(),
        end: bucket.end.toISOString(),
        meetings: bucket.meetings,
        decisions: bucket.decisions,
        topics: bucket.topics,
        actionItems: bucket.actionItems,
        pendingItems: bucket.pendingItems
      }))
    };
  }

  private async assertProjectAccess(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<{
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  }> {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        members: {
          where: {
            userId: input.userId
          },
          select: {
            id: true
          },
          take: 1
        }
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }

    if (input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN') {
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color
      };
    }

    if (!project.members[0]) {
      throw new AppError(403, 'Você não tem acesso a este projeto.');
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color
    };
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private bumpCounter(counter: Map<string, CounterEntry>, value: string, seenAt: Date): void {
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    const key = this.normalizeText(trimmed);

    if (!key) {
      return;
    }

    const existing = counter.get(key);

    if (existing) {
      existing.count += 1;

      if (seenAt > existing.lastSeenAt) {
        existing.lastSeenAt = seenAt;
      }

      return;
    }

    counter.set(key, {
      label: trimmed,
      count: 1,
      lastSeenAt: seenAt
    });
  }

  private counterToList(counter: Map<string, CounterEntry>, limit: number): CounterEntry[] {
    return [...counter.values()]
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
      })
      .slice(0, limit);
  }

  private parseStringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private parseActionItems(value: Prisma.JsonValue | null): Array<{ title: string }> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return null;
        }

        const objectEntry = entry as Record<string, unknown>;
        const title = typeof objectEntry.title === 'string' ? objectEntry.title.trim() : '';

        if (!title) {
          return null;
        }

        return { title };
      })
      .filter((entry): entry is { title: string } => Boolean(entry));
  }

  private resolveBucketSizeDays(days: number): number {
    if (days <= 14) {
      return 1;
    }

    if (days <= 90) {
      return 7;
    }

    return 30;
  }

  private createPeriodBuckets(start: Date, end: Date, bucketSizeDays: number): PeriodBucket[] {
    const buckets: PeriodBucket[] = [];
    let cursor = start.getTime();
    const endTime = end.getTime();
    const intervalMs = bucketSizeDays * DAY_IN_MS;

    while (cursor < endTime) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(Math.min(cursor + intervalMs, endTime));

      buckets.push({
        start: bucketStart,
        end: bucketEnd,
        meetings: 0,
        decisions: 0,
        topics: 0,
        actionItems: 0,
        pendingItems: 0
      });

      cursor += intervalMs;
    }

    if (buckets.length === 0) {
      buckets.push({
        start,
        end,
        meetings: 0,
        decisions: 0,
        topics: 0,
        actionItems: 0,
        pendingItems: 0
      });
    }

    return buckets;
  }

  private findBucket(buckets: PeriodBucket[], meetingDate: Date): PeriodBucket | null {
    const timestamp = meetingDate.getTime();

    for (const bucket of buckets) {
      if (timestamp >= bucket.start.getTime() && timestamp < bucket.end.getTime()) {
        return bucket;
      }
    }

    return buckets[buckets.length - 1] ?? null;
  }

  private formatBucketLabel(start: Date, end: Date, bucketSizeDays: number): string {
    const startLabel = start.toLocaleDateString('pt-BR');
    const endLabel = end.toLocaleDateString('pt-BR');

    if (bucketSizeDays === 1) {
      return startLabel;
    }

    return `${startLabel} - ${endLabel}`;
  }

  private isClosedColumn(columnTitle: string): boolean {
    const normalized = this.normalizeText(columnTitle);
    return CLOSED_COLUMN_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }
}

export const reportsService = new ReportsService();
