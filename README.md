# CAIS Meeting AI

Plataforma SaaS para gestão de projetos e reuniões com IA, com foco em execução operacional: transcrição automática, análise estruturada, geração de tarefas e acompanhamento em board Kanban colaborativo.

## Visão do Produto

O **CAIS Meeting AI** centraliza trabalho de times em um único ambiente:
- contexto organizacional multi-tenant
- colaboração por papéis
- projetos com reuniões, arquivos, relatórios e board
- IA aplicada ao ciclo completo pós-reunião

Objetivo principal: transformar reuniões em decisões rastreáveis e trabalho executável.

## Arquitetura Multi-tenant

Cada sessão autenticada opera dentro de uma organização ativa.

- **Organization**: tenant principal (workspace)
- **User**: identidade global
- **OrganizationMember**: vínculo usuário-organização com papel
- **Project**: unidade de execução dentro da organização
- **ProjectMember**: controle de acesso por projeto

### Papéis e Permissões

Papéis suportados:
- `OWNER`
- `ADMIN`
- `MEMBER`
- `VIEWER`

Regras gerais:
- `OWNER` e `ADMIN`: governança da organização e gestão de equipe
- `MEMBER`: operação de projetos, reuniões e board
- `VIEWER`: leitura

## Domínios do Produto

### Organização e Colaboradores
- gestão de dados da organização
- listagem, adição, troca de papel e remoção de membros
- base para fluxo de convite (evolução futura)

### Projetos
Cada organização pode ter vários projetos.
Cada projeto concentra:
- membros
- reuniões
- board Kanban
- arquivos
- relatórios consolidados

Ao criar projeto, o board padrão é provisionado com colunas:
- `A Fazer`
- `Em Andamento`
- `Em Revisão`
- `Concluído`

### Reuniões com IA
Cada reunião pertence a um projeto e suporta:
- criação manual
- upload de áudio
- observações manuais com timestamp
- pipeline de transcrição e análise

Saída da IA:
- resumo
- tópicos
- decisões
- tarefas
- pendências
- comentários
- relatório

### Board Kanban Inteligente + Manual
Board no estilo Trello com:
- cards manuais e gerados por IA
- movimentação entre colunas
- múltiplos responsáveis
- checklist
- comentários
- anexos
- links
- etiquetas
- prioridade
- data limite

## IA no CAIS

### Transcrição (Groq)
- provider principal: **Groq**
- pipeline robusto para áudios longos com **FFmpeg**
- split em chunks para respeitar limites de upload
- transcrição por chunk + merge em ordem
- estrutura pronta para fallback local futuro

### Análise (DeepSeek)
- provider de análise: **DeepSeek** (API compatível com OpenAI)
- geração de JSON estruturado com contexto executivo
- parse robusto + tratamento de falhas de API/parse
- persistência de análise em `MeetingNote`

## Schema Principal (Prisma + MySQL)

Principais entidades:
- `Organization`, `User`, `OrganizationMember`
- `Project`, `ProjectMember`
- `Meeting`, `Transcript`, `MeetingNote`, `MeetingObservation`
- `ProjectFile`
- `Board`, `BoardColumn`, `Card`
- `CardAssignee`, `CardChecklist`, `CardChecklistItem`
- `CardComment`, `CardAttachment`, `CardLink`
- `CardLabel`, `CardLabelRelation`

Enums principais:
- `OrganizationRole`, `ProjectRole`
- `MeetingStatus`, `ObservationType`
- `CardSourceType`, `CardPriority`

## Fluxo Completo da Reunião

1. Usuário cria reunião no projeto.
2. Áudio é enviado (`upload`) ou informado no momento da criação.
3. Sistema define status e prepara processamento.
4. Áudio é dividido em chunks (quando necessário).
5. Cada chunk é transcrito via Groq.
6. Transcrições são mescladas em texto final.
7. DeepSeek analisa transcrição + observações manuais.
8. Resultado estruturado é salvo em `MeetingNote`.
9. `actionItems` podem gerar cards automáticos no board.
10. Reunião finaliza com status `COMPLETED` (ou `FAILED` em erro).

## Criação Automática de Cards

A partir dos `actionItems` da análise:
- cards são criados automaticamente na coluna **A Fazer**
- `sourceType = AI`
- vínculo com `meetingId`
- prioridade e prazo inferidos quando disponíveis
- tentativa de correspondência de responsáveis com membros do projeto
- deduplicação básica de itens óbvios da mesma reunião

## Páginas Principais (Frontend)

- `/login`
- `/register`
- `/dashboard`
- `/team`
- `/projects`
- `/projects/[id]`
- `/projects/[id]/meetings`
- `/projects/[id]/meetings/new`
- `/projects/[id]/meetings/[meetingId]`
- `/projects/[id]/board`
- `/projects/[id]/files`
- `/projects/[id]/reports`

## Endpoints Principais (Backend)

Base: `http://localhost:4000/api/v1` (padrão; depende de `PORT`)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Organization
- `GET /organization`
- `PATCH /organization`

### Team
- `GET /organization/members`
- `POST /organization/members`
- `PATCH /organization/members/:id`
- `DELETE /organization/members/:id`

### Projects
- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `DELETE /projects/:id`
- `GET /projects/:id/members`
- `POST /projects/:id/members`
- `PATCH /projects/:id/members/:memberId`
- `DELETE /projects/:id/members/:memberId`
- `POST /projects/:id/files`
- `GET /projects/:id/files`
- `DELETE /projects/:id/files/:fileId`
- `GET /projects/:id/reports`

### Meetings
- `POST /projects/:id/meetings`
- `GET /projects/:id/meetings`
- `GET /meetings/:meetingId`
- `DELETE /meetings/:meetingId`
- `POST /meetings/:meetingId/upload`
- `POST /meetings/:meetingId/observations`
- `POST /meetings/:meetingId/process`

### Board
- `GET /projects/:id/board`
- `POST /projects/:id/board/cards`
- `PATCH /board/cards/:id`
- `DELETE /board/cards/:id`
- `POST /board/cards/:id/checklists`
- `POST /board/checklist-items/:id/toggle`
- `POST /board/cards/:id/comments`
- `POST /board/cards/:id/attachments`
- `POST /board/cards/:id/links`
- `POST /board/cards/:id/assignees`
- `POST /board/cards/:id/labels`

## Stack Técnica

### Frontend
- Next.js + TypeScript
- Tailwind CSS
- shadcn/ui + Radix UI

### Backend
- Node.js + Express + TypeScript
- arquitetura modular (`modules`, `services`, `middlewares`)

### Dados
- MySQL
- Prisma ORM

## Setup Rápido

Pré-requisitos:
- Node.js 20+
- npm 10+
- Docker + Docker Compose

Instalação:

```bash
npm install
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up -d
npm run prisma:migrate:dev --workspace backend
npm run prisma:generate --workspace backend
npm run dev
```

## Variáveis de Ambiente (Backend)

- `DATABASE_URL`
- `JWT_SECRET`
- `AUTH_COOKIE_NAME`
- `GROQ_API_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `TRANSCRIPTION_ENGINE` (`GROQ` | `LOCAL_FALLBACK`)

## Roadmap Futuro

- convite formal de colaboradores por e-mail
- múltiplas organizações ativas por usuário com troca rápida de contexto
- fallback local de transcrição em produção
- processamento assíncrono com fila (jobs/workers)
- webhooks e integrações externas (Slack, PM tools)
- trilha de auditoria por ação
- analytics avançado de produtividade por projeto/período
- templates de relatório e playbooks por tipo de reunião

---

CAIS Meeting AI foi desenhado para unir contexto, decisão e execução em uma única plataforma operacional com IA.
