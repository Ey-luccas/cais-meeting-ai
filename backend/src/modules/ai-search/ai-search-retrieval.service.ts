import { AiSearchSourceType, Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';

export type AiSearchRetrievedChunk = {
  id: string;
  organizationId: string;
  projectId: string | null;
  sourceType: AiSearchSourceType;
  sourceId: string;
  title: string;
  content: string;
  summary: string | null;
  href: string;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  score: number;
};

export type AiSearchContextSource = {
  sourceType: AiSearchSourceType;
  sourceId: string;
  title: string;
  href: string;
  excerpt: string;
  date: string | null;
  score: number;
};

const SOURCE_PRIORITY_WEIGHT: Record<AiSearchSourceType, number> = {
  MEETING_NOTE: 120,
  DECISION: 105,
  TASK: 95,
  TRANSCRIPT: 80,
  CARD: 72,
  FILE: 62,
  LIBRARY_ITEM: 108,
  PROJECT: 52,
  MEETING: 88,
  CARD_COMMENT: 68
};

const SOURCE_LABEL: Record<AiSearchSourceType, string> = {
  PROJECT: 'Projeto',
  MEETING: 'Reunião',
  TRANSCRIPT: 'Transcrição',
  MEETING_NOTE: 'Nota de reunião',
  DECISION: 'Decisão',
  TASK: 'Tarefa',
  CARD: 'Card',
  CARD_COMMENT: 'Comentário',
  FILE: 'Arquivo',
  LIBRARY_ITEM: 'Documento'
};

type SearchInput = {
  organizationId: string;
  projectId?: string;
  query: string;
  maxCandidates?: number;
  maxSources?: number;
};

type ChunkRow = {
  id: string;
  organizationId: string;
  projectId: string | null;
  sourceType: AiSearchSourceType;
  sourceId: string;
  title: string;
  content: string;
  summary: string | null;
  href: string;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  relevance?: number | null;
};

const normalize = (value: string): string => value.trim().toLowerCase();

const tokenize = (value: string): string[] =>
  normalize(value)
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}-]+/gu, '').trim())
    .filter((token) => token.length >= 2);

const toExcerpt = (content: string, query: string): string => {
  const normalizedContent = content.replace(/\s+/g, ' ').trim();

  if (!normalizedContent) {
    return '';
  }

  const lowerContent = normalizedContent.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();

  if (!lowerQuery) {
    return normalizedContent.slice(0, 320);
  }

  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    return normalizedContent.slice(0, 320);
  }

  const start = Math.max(0, index - 150);
  const end = Math.min(normalizedContent.length, index + lowerQuery.length + 170);

  return normalizedContent.slice(start, end);
};

const recencyScore = (updatedAt: Date): number => {
  const now = Date.now();
  const diffDays = Math.max(0, (now - updatedAt.getTime()) / 86_400_000);

  if (diffDays <= 1) {
    return 25;
  }

  if (diffDays <= 7) {
    return 18;
  }

  if (diffDays <= 30) {
    return 10;
  }

  if (diffDays <= 90) {
    return 4;
  }

  return 0;
};

export class AiSearchRetrievalService {
  private computeScore(chunk: ChunkRow, query: string, terms: string[]): number {
    const title = chunk.title.toLowerCase();
    const content = chunk.content.toLowerCase();
    const fullQuery = query.toLowerCase();

    let score = SOURCE_PRIORITY_WEIGHT[chunk.sourceType] + recencyScore(chunk.updatedAt);

    if (title.includes(fullQuery)) {
      score += 65;
    }

    if (content.includes(fullQuery)) {
      score += 40;
    }

    for (const term of terms) {
      if (title.includes(term)) {
        score += 14;
      }

      if (content.includes(term)) {
        score += 7;
      }
    }

    if (chunk.relevance && Number.isFinite(chunk.relevance)) {
      score += chunk.relevance * 26;
    }

    return score;
  }

  private async findWithFullText(input: {
    organizationId: string;
    projectId?: string;
    query: string;
    maxCandidates: number;
  }): Promise<ChunkRow[]> {
    const projectFilter = input.projectId ? Prisma.sql`AND projectId = ${input.projectId}` : Prisma.empty;

    try {
      const rows = await prisma.$queryRaw<ChunkRow[]>(Prisma.sql`
        SELECT
          id,
          organizationId,
          projectId,
          sourceType,
          sourceId,
          title,
          content,
          summary,
          href,
          metadataJson,
          createdAt,
          updatedAt,
          MATCH(title, content) AGAINST(${input.query} IN NATURAL LANGUAGE MODE) AS relevance
        FROM AiSearchChunk
        WHERE organizationId = ${input.organizationId}
          ${projectFilter}
          AND MATCH(title, content) AGAINST(${input.query} IN NATURAL LANGUAGE MODE)
        ORDER BY relevance DESC, updatedAt DESC
        LIMIT ${input.maxCandidates}
      `);

      return rows;
    } catch {
      return [];
    }
  }

  private async findWithLike(input: {
    organizationId: string;
    projectId?: string;
    query: string;
    maxCandidates: number;
  }): Promise<ChunkRow[]> {
    const terms = tokenize(input.query);

    const orFilters: Prisma.AiSearchChunkWhereInput[] = [
      {
        title: {
          contains: input.query
        }
      },
      {
        content: {
          contains: input.query
        }
      }
    ];

    for (const term of terms.slice(0, 8)) {
      orFilters.push({ title: { contains: term } });
      orFilters.push({ content: { contains: term } });
    }

    return prisma.aiSearchChunk.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.projectId
          ? {
              projectId: input.projectId
            }
          : {}),
        OR: orFilters
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: Math.max(input.maxCandidates * 2, 30)
    });
  }

  async search(input: SearchInput): Promise<{
    candidates: AiSearchRetrievedChunk[];
    contextSources: AiSearchContextSource[];
    contextText: string;
  }> {
    const query = input.query.trim();

    if (!query) {
      return {
        candidates: [],
        contextSources: [],
        contextText: ''
      };
    }

    const maxCandidates = Math.min(50, Math.max(5, input.maxCandidates ?? 20));
    const maxSources = Math.min(12, Math.max(4, input.maxSources ?? 10));

    const [fullTextRows, likeRows] = await Promise.all([
      this.findWithFullText({
        organizationId: input.organizationId,
        projectId: input.projectId,
        query,
        maxCandidates
      }),
      this.findWithLike({
        organizationId: input.organizationId,
        projectId: input.projectId,
        query,
        maxCandidates
      })
    ]);

    const byId = new Map<string, ChunkRow>();

    for (const row of [...fullTextRows, ...likeRows]) {
      if (!byId.has(row.id)) {
        byId.set(row.id, row);
      }
    }

    const terms = tokenize(query);

    const scored = [...byId.values()]
      .map((row) => ({
        ...row,
        score: this.computeScore(row, query, terms)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates);

    const groupedBySource = new Map<string, AiSearchContextSource>();

    for (const chunk of scored) {
      const key = `${chunk.sourceType}:${chunk.sourceId}`;

      const excerpt = toExcerpt(chunk.summary?.trim() || chunk.content, query);
      const date = chunk.updatedAt.toISOString();

      const candidate: AiSearchContextSource = {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        title: chunk.title,
        href: chunk.href,
        excerpt,
        date,
        score: chunk.score
      };

      const existing = groupedBySource.get(key);

      if (!existing || candidate.score > existing.score) {
        groupedBySource.set(key, candidate);
      }
    }

    const contextSources = [...groupedBySource.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSources);

    const contextText = contextSources
      .map((source, index) => {
        const dateLine = source.date ? `Data: ${new Date(source.date).toISOString()}` : null;

        return [
          `[FONTE ${index + 1}]`,
          `Tipo: ${SOURCE_LABEL[source.sourceType]}`,
          `Título: ${source.title}`,
          `Link: ${source.href}`,
          dateLine,
          `Trecho: ${source.excerpt || 'Sem trecho disponível.'}`
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    return {
      candidates: scored,
      contextSources,
      contextText
    };
  }
}

export const aiSearchRetrievalService = new AiSearchRetrievalService();
