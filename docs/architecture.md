# Arquitetura - CAIS Meeting AI

## Visão Geral da Solução

O CAIS Meeting AI é um monorepo fullstack com separação clara entre interface, API e persistência.

Componentes principais:
- `frontend` (Next.js): experiência web institucional e operacional.
- `backend` (Express): API REST com regras de negócio e integrações IA.
- `MySQL` (Prisma): persistência de reuniões, transcrições, notas e tags.
- armazenamento local de arquivos de áudio no MVP.

## Frontend

Stack:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui + Radix UI

Responsabilidades:
- landing institucional do produto.
- dashboard com indicadores e atividade recente.
- listagem, criação e detalhe de reuniões.
- gravação de áudio no navegador (MediaRecorder).
- upload de áudio e acionamento de transcrição/notas via API.

Organização principal:
- `frontend/src/app`: rotas e páginas.
- `frontend/src/components`: UI e blocos de domínio.
- `frontend/src/modules/meetings`: camada de consumo REST do domínio.
- `frontend/src/hooks`: estado de tela e carregamento.
- `frontend/src/lib`: utilitários e API client.

## Backend

Stack:
- Node.js + Express
- TypeScript
- Prisma ORM

Responsabilidades:
- expor endpoints REST de reuniões.
- validar entrada e tratar erros globalmente.
- receber uploads com Multer.
- orquestrar pipeline de chunking (`ffmpeg`) + Groq + DeepSeek.
- persistir dados no MySQL e atualizar status de processamento.

Organização principal:
- `backend/src/config`: ambiente e Prisma client.
- `backend/src/controllers`: camada HTTP.
- `backend/src/services`: regras de negócio + integrações IA.
- `backend/src/routes`: roteamento REST.
- `backend/src/middlewares`: not-found e error handler.
- `backend/src/utils`: upload/storage, helpers e erros.

## Banco de Dados

Tecnologia:
- MySQL 8
- Prisma ORM

Modelos centrais:
- `Meeting`
- `Transcript`
- `Note`
- `MeetingTag`

Padrões adotados:
- `MeetingStatus` como enum para governar o pipeline.
- campos JSON em `Note` para flexibilidade de evolução das saídas de IA.
- relações 1:1 para `Meeting -> Transcript` e `Meeting -> Note`.
- relação 1:N para `Meeting -> MeetingTag`.

## Serviços Externos

### Groq API
- usada para speech-to-text no backend.
- áudio longo é dividido em chunks antes do envio para respeitar o limite por requisição.
- tentativa inicial com `response_format=verbose_json`.
- fallback automático sem `verbose_json` quando necessário.
- retorno consolidado: texto, idioma, duração e payload bruto.

### DeepSeek API
- usada para análise textual da transcrição.
- resposta em JSON estruturado, validada por schema no backend.
- validação adicional via `zod` antes de persistir.
- saída esperada (normalizada): `summary`, `topics`, `decisions`, `actionItems`, `pendingItems`, `comments`.
