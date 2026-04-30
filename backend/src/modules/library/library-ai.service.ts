import { env } from '../../config/env';
import { AppError } from '../../shared/app-error';

type GenerateMeetingMinutesInput = {
  projectName: string;
  meetingTitle: string;
  meetingDateIso: string;
  participants: string[];
  transcriptText?: string;
  summary?: string;
  topics?: string[];
  decisions?: string[];
  tasks?: string[];
  pendingItems?: string[];
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

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

export class LibraryAiService {
  async generateMeetingMinutes(input: GenerateMeetingMinutesInput): Promise<string> {
    if (!env.DEEPSEEK_API_KEY) {
      throw new AppError(500, 'DEEPSEEK_API_KEY não configurada.');
    }

    const transcript = normalize(input.transcriptText ?? '');
    const hasStructuredNotes = Boolean(
      normalize(input.summary ?? '') ||
      (input.topics ?? []).length > 0 ||
      (input.decisions ?? []).length > 0 ||
      (input.tasks ?? []).length > 0 ||
      (input.pendingItems ?? []).length > 0
    );

    if (!transcript && !hasStructuredNotes) {
      throw new AppError(409, 'A reunião ainda não possui transcrição ou notas suficientes para gerar ata.');
    }

    let payload: DeepseekChatCompletionsResponse | null = null;
    let rawText = '';

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
                'Você é um assistente de documentação do Cais Teams. Retorne apenas markdown válido, sem comentários extras fora do conteúdo.'
            },
            {
              role: 'user',
              content: this.buildPrompt(input)
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
        throw new AppError(502, 'Falha ao gerar ata com DeepSeek.', {
          statusCode: response.status,
          message: payload?.error?.message ?? rawText.slice(0, 1000)
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, 'Falha ao chamar a API do DeepSeek para gerar ata.', {
        cause: toErrorMessage(error)
      });
    }

    const content = payload?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!content) {
      throw new AppError(502, 'DeepSeek retornou resposta vazia para geração de ata.', {
        model: env.DEEPSEEK_MODEL
      });
    }

    return content.replace(/```markdown|```md|```/gi, '').trim();
  }

  private buildPrompt(input: GenerateMeetingMinutesInput): string {
    const notesLines = [
      input.summary ? `Resumo IA: ${input.summary}` : null,
      (input.topics ?? []).length > 0 ? `Tópicos IA: ${(input.topics ?? []).join(' | ')}` : null,
      (input.decisions ?? []).length > 0 ? `Decisões IA: ${(input.decisions ?? []).join(' | ')}` : null,
      (input.tasks ?? []).length > 0 ? `Tarefas IA: ${(input.tasks ?? []).join(' | ')}` : null,
      (input.pendingItems ?? []).length > 0 ? `Pendências IA: ${(input.pendingItems ?? []).join(' | ')}` : null
    ].filter(Boolean);

    return [
      'Você é um assistente de documentação do Cais Teams.',
      'Gere uma ata profissional em português do Brasil com base exclusivamente na transcrição e nas notas da reunião.',
      '',
      'Estrutura obrigatória:',
      '',
      '# Ata da reunião',
      '',
      '## Identificação',
      '- Projeto:',
      '- Reunião:',
      '- Data:',
      '- Participantes mencionados:',
      '',
      '## Resumo executivo',
      '',
      '## Principais tópicos discutidos',
      '',
      '## Decisões tomadas',
      '',
      '## Tarefas e responsáveis',
      '',
      '## Pendências',
      '',
      '## Próximos passos',
      '',
      '## Observações importantes',
      '',
      'Regras:',
      '- Não invente informações.',
      '- Se algo não foi informado, escreva “Não informado”.',
      '- Use linguagem profissional.',
      '- Seja objetivo.',
      '- Retorne apenas Markdown.',
      '',
      'Contexto da reunião:',
      `Projeto: ${input.projectName}`,
      `Reunião: ${input.meetingTitle}`,
      `Data: ${new Date(input.meetingDateIso).toLocaleString('pt-BR')}`,
      `Participantes mencionados: ${input.participants.length > 0 ? input.participants.join(', ') : 'Não informado'}`,
      '',
      notesLines.length > 0 ? 'Notas já extraídas por IA:' : 'Notas já extraídas por IA: Não informado',
      ...(notesLines.length > 0 ? notesLines : []),
      '',
      'Transcrição:',
      normalize(input.transcriptText ?? '') || 'Não informado'
    ].join('\n');
  }
}

export const libraryAiService = new LibraryAiService();
