import { AiSearchSourceType } from '@prisma/client';
import { z } from 'zod';

import { env } from '../../config/env';
import { AppError } from '../../shared/app-error';
import type { AiSearchContextSource } from './ai-search-retrieval.service';

const insufficientDataMessage = 'Não encontrei informações suficientes para responder com segurança.';

const deepseekResponseSchema = z.object({
  answer: z.string().trim().min(1),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  sources: z
    .array(
      z.object({
        sourceType: z.string().trim().optional(),
        sourceId: z.string().trim().optional(),
        title: z.string().trim().optional(),
        href: z.string().trim().optional(),
        excerpt: z.string().trim().optional()
      })
    )
    .default([]),
  suggestedFollowUps: z.array(z.string().trim()).default([])
});

type DeepseekChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type AiSearchAnswerSource = {
  sourceType: AiSearchSourceType;
  sourceId: string;
  title: string;
  href: string;
  excerpt: string;
};

export type AiSearchAnswerPayload = {
  answer: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  sources: AiSearchAnswerSource[];
  suggestedFollowUps: string[];
};

const parseJsonObject = (content: string): unknown => {
  const cleaned = content.replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new AppError(502, 'DeepSeek não retornou JSON válido para pesquisa IA.');
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      throw new AppError(502, 'Falha ao interpretar JSON retornado pelo DeepSeek na pesquisa IA.');
    }
  }
};

const normalize = (value: string): string => value.trim().toLowerCase();

const toSourceKey = (input: {
  sourceType?: string;
  sourceId?: string;
  href?: string;
  title?: string;
}): string => {
  const sourceType = normalize(input.sourceType ?? '');
  const sourceId = normalize(input.sourceId ?? '');
  const href = normalize(input.href ?? '');
  const title = normalize(input.title ?? '');

  return `${sourceType}::${sourceId}::${href}::${title}`;
};

const mapSourceType = (value: string | undefined): AiSearchSourceType | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (
    normalized === 'PROJECT' ||
    normalized === 'MEETING' ||
    normalized === 'TRANSCRIPT' ||
    normalized === 'MEETING_NOTE' ||
    normalized === 'DECISION' ||
    normalized === 'TASK' ||
    normalized === 'CARD' ||
    normalized === 'CARD_COMMENT' ||
    normalized === 'FILE' ||
    normalized === 'LIBRARY_ITEM'
  ) {
    return normalized;
  }

  return null;
};

export class AiSearchAnswerService {
  async generateAnswer(input: {
    question: string;
    contextSources: AiSearchContextSource[];
    contextText: string;
  }): Promise<AiSearchAnswerPayload> {
    if (input.contextSources.length === 0) {
      return {
        answer: insufficientDataMessage,
        confidence: 'LOW',
        sources: [],
        suggestedFollowUps: []
      };
    }

    if (!env.DEEPSEEK_API_KEY) {
      throw new AppError(500, 'DEEPSEEK_API_KEY não configurada para Pesquisa IA Central.');
    }

    const systemPrompt = [
      'Você é a IA de pesquisa do Cais Teams.',
      'Responda à pergunta do usuário usando exclusivamente as fontes fornecidas.',
      'Regras obrigatórias:',
      '- Não invente informações.',
      '- Se não houver dados suficientes, diga claramente que não encontrou informação suficiente.',
      '- Cite as fontes usadas no campo sources.',
      '- A resposta deve ser objetiva, profissional e em português do Brasil.',
      '- Quando houver decisões, tarefas ou pendências, organize em tópicos.',
      '- Não mencione informações que não estejam nas fontes.',
      'Retorne SOMENTE JSON válido no formato:',
      '{',
      '  "answer": "",',
      '  "confidence": "LOW | MEDIUM | HIGH",',
      '  "sources": [',
      '    {',
      '      "sourceType": "",',
      '      "sourceId": "",',
      '      "title": "",',
      '      "href": "",',
      '      "excerpt": ""',
      '    }',
      '  ],',
      '  "suggestedFollowUps": []',
      '}'
    ].join('\n');

    const userPrompt = [
      `Pergunta do usuário: ${input.question}`,
      '',
      'Fontes disponíveis:',
      input.contextText
    ].join('\n');

    let payload: DeepseekChatCompletionsResponse | null = null;
    let raw = '';

    try {
      const response = await fetch(`${env.DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          temperature: 0.1,
          max_tokens: 900,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ]
        })
      });

      raw = await response.text();

      try {
        payload = JSON.parse(raw) as DeepseekChatCompletionsResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new AppError(502, 'Falha ao consultar DeepSeek na Pesquisa IA Central.', {
          statusCode: response.status,
          message: payload?.error?.message ?? raw.slice(0, 800)
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, 'Falha de comunicação com DeepSeek na Pesquisa IA Central.');
    }

    const content = payload?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!content) {
      throw new AppError(502, 'DeepSeek retornou resposta vazia na Pesquisa IA Central.');
    }

    const parsed = deepseekResponseSchema.parse(parseJsonObject(content));

    const mappedSources = this.resolveSources(parsed.sources, input.contextSources);

    return {
      answer: parsed.answer,
      confidence: parsed.confidence,
      sources: mappedSources,
      suggestedFollowUps: parsed.suggestedFollowUps
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 4)
    };
  }

  private resolveSources(
    parsedSources: Array<{
      sourceType?: string;
      sourceId?: string;
      title?: string;
      href?: string;
      excerpt?: string;
    }>,
    contextSources: AiSearchContextSource[]
  ): AiSearchAnswerSource[] {
    const result: AiSearchAnswerSource[] = [];

    const sourcesByExactKey = new Map<string, AiSearchContextSource>();
    const sourcesByHref = new Map<string, AiSearchContextSource>();
    const sourcesByTypeAndId = new Map<string, AiSearchContextSource>();

    for (const source of contextSources) {
      sourcesByExactKey.set(
        toSourceKey({
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          href: source.href,
          title: source.title
        }),
        source
      );

      sourcesByHref.set(normalize(source.href), source);
      sourcesByTypeAndId.set(`${source.sourceType}:${source.sourceId}`, source);
    }

    for (const source of parsedSources) {
      const normalizedType = mapSourceType(source.sourceType);
      const normalizedSourceId = source.sourceId?.trim() ?? '';
      const normalizedHref = source.href?.trim() ?? '';

      const byExact = sourcesByExactKey.get(
        toSourceKey({
          sourceType: normalizedType ?? source.sourceType,
          sourceId: normalizedSourceId,
          href: normalizedHref,
          title: source.title
        })
      );

      const byTypeAndId = normalizedType
        ? sourcesByTypeAndId.get(`${normalizedType}:${normalizedSourceId}`)
        : undefined;
      const byHref = normalizedHref ? sourcesByHref.get(normalize(normalizedHref)) : undefined;

      const matched = byExact ?? byTypeAndId ?? byHref;

      if (!matched) {
        continue;
      }

      result.push({
        sourceType: matched.sourceType,
        sourceId: matched.sourceId,
        title: matched.title,
        href: matched.href,
        excerpt: source.excerpt?.trim() || matched.excerpt
      });
    }

    if (result.length === 0) {
      return contextSources.slice(0, 4).map((source) => ({
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        title: source.title,
        href: source.href,
        excerpt: source.excerpt
      }));
    }

    const unique = new Map<string, AiSearchAnswerSource>();

    for (const source of result) {
      unique.set(`${source.sourceType}:${source.sourceId}:${source.href}`, source);
    }

    return [...unique.values()];
  }

  insufficientDataMessage(): string {
    return insufficientDataMessage;
  }
}

export const aiSearchAnswerService = new AiSearchAnswerService();
