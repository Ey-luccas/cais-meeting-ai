import { z } from 'zod';

import { env } from '../../config/env';
import { AppError } from '../../shared/app-error';

const actionItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional().default(null),
  assignees: z.array(z.string()).default([]),
  dueDate: z.string().nullable().optional().default(null),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium')
});

const analysisSchema = z.object({
  summary: z.string().min(1),
  topics: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  actionItems: z.array(actionItemSchema).default([]),
  pendingItems: z.array(z.string()).default([]),
  comments: z.array(z.string()).default([]),
  report: z.string().min(1)
});

export type DeepseekMeetingAnalysisOutput = z.infer<typeof analysisSchema>;

export type MeetingObservationContext = {
  type: 'NOTE' | 'TASK' | 'QUESTION' | 'IMPORTANT' | 'DECISION';
  timestampSeconds: number;
  content: string;
  authorName: string;
};

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

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'unknown_error';
};

export class DeepseekMeetingAnalysisService {
  async analyzeMeeting(
    transcript: string,
    options?: {
      observations?: MeetingObservationContext[];
    }
  ): Promise<{
    output: DeepseekMeetingAnalysisOutput;
    model: string;
    raw: unknown;
  }> {
    if (!transcript.trim()) {
      throw new AppError(400, 'Não é possível analisar reunião com transcrição vazia.');
    }

    if (!env.DEEPSEEK_API_KEY) {
      throw new AppError(500, 'DEEPSEEK_API_KEY não configurada.');
    }

    let rawText = '';
    let payload: DeepseekChatCompletionsResponse | null = null;

    try {
      const response = await fetch(`${env.DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'Você é um analista executivo corporativo. Retorne apenas JSON válido sem markdown ou texto fora do JSON.'
            },
            {
              role: 'user',
              content: this.buildPrompt(transcript, options?.observations ?? [])
            }
          ]
        })
      });

      rawText = await response.text();

      try {
        payload = JSON.parse(rawText) as DeepseekChatCompletionsResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new AppError(502, 'Falha ao analisar reunião com DeepSeek.', {
          statusCode: response.status,
          message: payload?.error?.message ?? rawText.slice(0, 800)
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, 'Falha ao chamar API do DeepSeek para análise da reunião.', {
        cause: toErrorMessage(error)
      });
    }

    const content = payload?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!content) {
      throw new AppError(502, 'DeepSeek retornou resposta vazia para análise da reunião.', {
        model: env.DEEPSEEK_MODEL
      });
    }

    const parsedJson = this.parseJson(content);

    return {
      output: analysisSchema.parse(parsedJson),
      model: env.DEEPSEEK_MODEL,
      raw: parsedJson
    };
  }

  private parseJson(content: string): unknown {
    const cleaned = content.replace(/```json|```/gi, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);

      if (!match) {
        throw new AppError(502, 'DeepSeek não retornou JSON válido.', {
          preview: cleaned.slice(0, 1200)
        });
      }

      try {
        return JSON.parse(match[0]);
      } catch {
        throw new AppError(502, 'Falha ao interpretar JSON retornado pelo DeepSeek.', {
          preview: cleaned.slice(0, 1200)
        });
      }
    }
  }

  private formatObservationTimestamp(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private buildObservationSection(observations: MeetingObservationContext[]): string {
    if (observations.length === 0) {
      return 'Observações manuais: nenhuma observação adicional registrada.';
    }

    const normalized = observations
      .map((observation) => ({
        ...observation,
        content: observation.content.trim()
      }))
      .filter((observation) => observation.content.length > 0)
      .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
      .slice(0, 120);

    if (normalized.length === 0) {
      return 'Observações manuais: nenhuma observação adicional registrada.';
    }

    const lines = normalized.map((observation) => {
      const timestamp = this.formatObservationTimestamp(observation.timestampSeconds);
      return `- [${timestamp}] (${observation.type}) ${observation.authorName}: ${observation.content}`;
    });

    return ['Observações manuais (contexto adicional da reunião):', ...lines].join('\n');
  }

  private buildPrompt(transcript: string, observations: MeetingObservationContext[]): string {
    const observationsSection = this.buildObservationSection(observations);

    return [
      'Analise a transcrição e retorne APENAS JSON válido no formato exato abaixo:',
      '{',
      '  "summary": "string",',
      '  "topics": ["string"],',
      '  "decisions": ["string"],',
      '  "actionItems": [',
      '    {',
      '      "title": "string",',
      '      "description": "string|null",',
      '      "assignees": ["string"],',
      '      "dueDate": "string|null",',
      '      "priority": "low|medium|high|urgent"',
      '    }',
      '  ],',
      '  "pendingItems": ["string"],',
      '  "comments": ["string"],',
      '  "report": "string"',
      '}',
      'Regras obrigatórias:',
      '- Escreva em português do Brasil.',
      '- Não invente dados; use [] ou null quando faltar informação.',
      '- O campo "summary" deve ser objetivo e executivo.',
      '- O campo "topics" deve listar os macrotemas discutidos.',
      '- O campo "decisions" deve conter decisões concretas e acionáveis.',
      '- O campo "actionItems" deve trazer tarefas operacionais com responsáveis quando citados na reunião.',
      '- O campo "pendingItems" deve listar bloqueios, riscos e itens pendentes.',
      '- O campo "comments" deve trazer observações úteis para a equipe.',
      '- O campo "report" deve ser um relatório orientado à execução do projeto: contexto, direção, próximas ações e riscos.',
      '- Use as observações manuais como contexto adicional para enriquecer decisões, tarefas e pendências.',
      '- Não retorne markdown, texto fora do JSON ou comentários extras.',
      observationsSection,
      'Transcrição da reunião:',
      transcript
    ].join('\n');
  }
}

export const deepseekMeetingAnalysisService = new DeepseekMeetingAnalysisService();
