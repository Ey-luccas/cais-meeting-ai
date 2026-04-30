# Arquitetura - CAIS Meeting AI

## 1) Visão Geral

O CAIS Meeting AI é uma plataforma SaaS de execução colaborativa baseada em reuniões com IA.

Arquitetura em monorepo com separação por camadas:
- `frontend/` (Next.js + TypeScript): experiência web do produto.
- `backend/` (Express + TypeScript): API REST, regras de negócio e orquestração de IA.
- `MySQL` + `Prisma`: persistência relacional multi-tenant.
- `uploads/` local (MVP): áudio e anexos.

## 2) Multi-tenancy por Organização

Isolamento de dados por organização (`Organization`).

Princípios:
- cada requisição autenticada carrega contexto `req.auth` (`userId`, `organizationId`, `memberId`, `role`);
- acesso a projetos/reuniões/board sempre validado pelo `organizationId` ativo;
- autorização combinada por papel organizacional e, quando aplicável, papel no projeto.

Modelos de tenancy:
- `Organization` (tenant)
- `OrganizationMember` (papel dentro da organização)
- `Project` (escopo operacional dentro da organização)
- `ProjectMember` (papel por projeto)

## 3) Módulos de Backend

Estrutura base em `backend/src/modules`:
- `auth`: registro, login, sessão e contexto autenticado.
- `organizations`: organização ativa e gestão de colaboradores.
- `projects`: CRUD de projetos, membros por projeto e board inicial.
- `meetings`: ciclo da reunião (criação, upload, observações, processamento IA).
- `board`: Kanban estilo Trello (cards, checklist, comentários, anexos, links, labels, assignees).
- `files`: arquivos do projeto.
- `reports`: visão consolidada de reuniões e execução.

Camadas transversais:
- `middlewares/`: autenticação, autorização e tratamento de erro.
- `services/transcription/`: pipeline de transcrição com chunking.
- `services/ai/`: análise DeepSeek e geração automática de cards.
- `shared/`: segurança, upload, storage, logger, erros.

## 4) Fronteiras de Responsabilidade

Frontend:
- navegação por contexto (organização e projeto);
- consumo da API com sessão persistente;
- páginas principais: Dashboard, Team, Projects, Meetings, Board, Files, Reports.

Backend:
- validação de payload e parâmetros;
- aplicação de regras de permissão;
- persistência relacional;
- orquestração de processamento de reunião (transcrição + análise + geração de cards).

Banco:
- consistência transacional em operações críticas (ex.: criação de projeto + board default, geração de cards de IA);
- uso de enums para estados e papéis.

## 5) Reuniões com IA (Arquitetura de Processamento)

Pipeline:
1. reunião criada e áudio enviado;
2. transcrição roteada por `TranscriptionRouterService` (`GROQ` ou `LOCAL_FALLBACK`);
3. para Groq: chunking com FFmpeg + transcrição por chunk + merge com marcadores de tempo;
4. análise com DeepSeek e saída JSON estruturada;
5. persistência em `Transcript` e `MeetingNote`;
6. criação automática de cards (origem `AI`) a partir de `actionItems`.

Estados de `MeetingStatus`:
- `PENDING` → `UPLOADED` → `TRANSCRIBING` → `TRANSCRIBED` → `PROCESSING_AI` → `COMPLETED`
- em falha: `FAILED`

## 6) Board Kanban (Essencial Trello)

Cada projeto possui um board único com colunas padrão:
- A Fazer
- Em Andamento
- Em Revisão
- Concluído

Recursos do card:
- título, descrição, prioridade, prazo;
- múltiplos responsáveis;
- checklist e itens;
- comentários;
- anexos e links;
- etiquetas;
- origem (`MANUAL` ou `AI`).

## 7) Padrões de Qualidade e Evolução

Padrões adotados:
- validação de entrada com `zod`;
- erros padronizados (`AppError`);
- autenticação central por JWT (cookie HTTP-only e bearer);
- design modular para escalar domínios.

Pronto para evolução:
- fila assíncrona para processamento pesado;
- fallback local de transcrição em produção;
- trilha de auditoria por organização/projeto;
- integrações externas de produtividade.
