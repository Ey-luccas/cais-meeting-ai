import { z } from 'zod';

import { env } from '../config/env';
import type { GeneratedNotesPayload } from '../types';
import { AppError } from '../utils';

const generatedNotesSchema = z.object({
  summary: z.string().min(1),
  topics: z.array(z.string()),
  decisions: z.array(z.string()),
  actionItems: z.array(
    z.object({
      item: z.string().min(1),
      owner: z.string().nullable().optional(),
      deadline: z.string().nullable().optional(),
      status: z.string().nullable().optional()
    })
  ),
  pendingItems: z.array(z.string()),
  comments: z.array(z.string())
});

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number | null;
    type?: string;
  };
};

export class DeepSeekService {
  async generateMeetingNotes(fullText: string): Promise<GeneratedNotesPayload> {
    const transcript = fullText.trim();
    if (!transcript) {
      throw new AppError(400, 'Não é possível gerar notas com transcrição vazia.');
    }

    if (!env.DEEPSEEK_API_KEY) {
      throw new AppError(500, 'DEEPSEEK_API_KEY não configurada.');
    }

    const messages: DeepSeekMessage[] = [
      {
        role: 'system',
        content:
          'Você é um analista sênior de reuniões corporativas B2B. Retorne somente JSON válido, sem markdown.'
      },
      {
        role: 'user',
        content: this.buildPrompt(transcript)
      }
    ];

    const rawText = await this.requestCompletion(messages);
    const parsed = this.parseGeneratedJson(rawText);
    const normalized = this.normalizePayload(parsed);

    const validated = generatedNotesSchema.safeParse(normalized);
    if (!validated.success) {
      throw new AppError(502, 'DeepSeek retornou JSON fora do formato esperado.', validated.error.flatten());
    }

    return validated.data;
  }

  private async requestCompletion(messages: DeepSeekMessage[]): Promise<string> {
    const baseUrl = env.DEEPSEEK_BASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL,
        temperature: 0.2,
        messages
      })
    });

    const responseText = await response.text();
    let payload: DeepSeekResponse | null = null;

    try {
      payload = JSON.parse(responseText) as DeepSeekResponse;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorMessage =
        payload?.error?.message ?? `DeepSeek API retornou HTTP ${response.status}.`;

      if (response.status === 429) {
        throw new AppError(429, 'Limite de uso da DeepSeek API atingido. Tente novamente em alguns minutos.', {
          cause: errorMessage
        });
      }

      throw new AppError(502, 'Falha ao processar análise com DeepSeek.', {
        statusCode: response.status,
        cause: errorMessage
      });
    }

    const content = payload?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new AppError(502, 'DeepSeek retornou resposta vazia.');
    }

    return content;
  }

  private buildPrompt(transcript: string): string {
    return [
      'Analise a transcrição da reunião e gere:',
      '- resumo executivo',
      '- principais tópicos discutidos',
      '- decisões tomadas',
      '- tarefas identificadas',
      '- pendências',
      '- observações importantes',
      'Diretrizes:',
      '- não invente informações, nomes, datas ou decisões',
      '- se faltar contexto, use arrays vazios',
      '- linguagem profissional, objetiva e clara em português do Brasil',
      '- sem markdown e sem texto extra fora do JSON',
      'Retorne exatamente JSON estruturado no formato:',
      '{',
      '  "summary": "string",',
      '  "topics": ["string"],',
      '  "decisions": ["string"],',
      '  "tasks": ["string" | { "item": "string", "owner": "string|null", "deadline": "string|null", "status": "string|null" }],',
      '  "pending_items": ["string"],',
      '  "notes": ["string"]',
      '}',
      'Transcrição completa da reunião:',
      transcript
    ].join('\n');
  }

  private parseGeneratedJson(raw: string): unknown {
    const cleanText = raw.replace(/```json|```/gi, '').trim();

    try {
      return JSON.parse(cleanText);
    } catch {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AppError(502, 'DeepSeek não retornou JSON válido.', {
          rawPreview: this.rawPreview(raw)
        });
      }

      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        throw new AppError(502, 'Falha ao interpretar JSON retornado pelo DeepSeek.', {
          rawPreview: this.rawPreview(raw)
        });
      }
    }
  }

  private normalizePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const candidate = payload as Record<string, unknown>;
    const toStringArray = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
      }

      if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
      }

      return [];
    };

    const normalizedSummary = (() => {
      const summary = candidate.summary;
      if (typeof summary === 'string') {
        return summary.trim();
      }

      if (Array.isArray(summary)) {
        return summary
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0)
          .join(' ');
      }

      return '';
    })();

    const normalizedActionItems = (() => {
      const input = candidate.actionItems ?? candidate.tasks;
      if (!Array.isArray(input)) {
        return [];
      }

      return input
        .map((item) => {
          if (typeof item === 'string' && item.trim().length > 0) {
            return { item: item.trim(), owner: null, deadline: null, status: null };
          }

          if (!item || typeof item !== 'object') {
            return null;
          }

          const obj = item as Record<string, unknown>;
          const normalizedItem = typeof obj.item === 'string' ? obj.item.trim() : '';
          if (!normalizedItem) {
            return null;
          }

          return {
            item: normalizedItem,
            owner: typeof obj.owner === 'string' ? obj.owner.trim() : null,
            deadline: typeof obj.deadline === 'string' ? obj.deadline.trim() : null,
            status: typeof obj.status === 'string' ? obj.status.trim() : null
          };
        })
        .filter((item): item is { item: string; owner: string | null; deadline: string | null; status: string | null } =>
          item !== null
        );
    })();

    return {
      summary: normalizedSummary,
      topics: toStringArray(candidate.topics),
      decisions: toStringArray(candidate.decisions),
      actionItems: normalizedActionItems,
      pendingItems: toStringArray(candidate.pendingItems ?? candidate.pending_items),
      comments: toStringArray(candidate.comments ?? candidate.notes)
    };
  }

  private rawPreview(raw: string): string {
    if (raw.length <= 1000) {
      return raw;
    }

    return `${raw.slice(0, 1000)}...`;
  }
}

export const deepseekService = new DeepSeekService();
