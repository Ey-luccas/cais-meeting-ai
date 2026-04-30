# Banco de Dados - CAIS Meeting AI

## 1) Stack e Objetivo

- Banco: **MySQL**
- ORM: **Prisma**
- Estratégia: modelo relacional orientado a multi-tenancy por organização.

Objetivo do schema: suportar colaboração, execução de projetos e ciclo completo de reunião com IA.

## 2) Entidades Principais

### Núcleo Multi-tenant
- `Organization`
- `User`
- `OrganizationMember`

### Projetos
- `Project`
- `ProjectMember`

### Reuniões e IA
- `Meeting`
- `Transcript`
- `MeetingNote`
- `MeetingObservation`

### Arquivos
- `ProjectFile`

### Board Kanban
- `Board`
- `BoardColumn`
- `Card`
- `CardAssignee`
- `CardChecklist`
- `CardChecklistItem`
- `CardComment`
- `CardAttachment`
- `CardLink`
- `CardLabel`
- `CardLabelRelation`

## 3) Enums

### `OrganizationRole`
- `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`

### `ProjectRole`
- `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`

### `MeetingStatus`
- `PENDING`
- `UPLOADED`
- `TRANSCRIBING`
- `TRANSCRIBED`
- `PROCESSING_AI`
- `COMPLETED`
- `FAILED`

### `ObservationType`
- `NOTE`, `TASK`, `QUESTION`, `IMPORTANT`, `DECISION`

### `CardSourceType`
- `MANUAL`, `AI`

### `CardPriority`
- `LOW`, `MEDIUM`, `HIGH`, `URGENT`

## 4) Relacionamentos-Chave

- `Organization 1:N Project`
- `Organization 1:N OrganizationMember`
- `User 1:N OrganizationMember`
- `Project 1:N ProjectMember`
- `Project 1:N Meeting`
- `Project 1:N ProjectFile`
- `Project 1:1 Board`
- `Board 1:N BoardColumn`
- `BoardColumn 1:N Card`
- `Meeting 1:1 Transcript`
- `Meeting 1:1 MeetingNote`
- `Meeting 1:N MeetingObservation`
- `Meeting 1:N Card` (cards de origem da reunião)
- `Card 1:N CardAssignee`
- `Card 1:N CardChecklist`
- `CardChecklist 1:N CardChecklistItem`
- `Card 1:N CardComment`
- `Card 1:N CardAttachment`
- `Card 1:N CardLink`
- `Card N:N CardLabel` via `CardLabelRelation`

## 5) Regras de Integridade

Unicidade importante:
- `Organization.slug` único
- `User.email` único
- `OrganizationMember (organizationId, userId)` único
- `ProjectMember (projectId, userId)` único
- `Board.projectId` único
- `Transcript.meetingId` único
- `MeetingNote.meetingId` único
- `CardAssignee (cardId, userId)` único
- `CardLabel (projectId, name)` único
- `CardLabelRelation (cardId, labelId)` único

Regras funcionais modeladas:
- cada projeto possui um board padrão;
- cada reunião pertence a um projeto;
- cada card pode ter múltiplos responsáveis;
- cards suportam checklist, comentários, anexos, links e etiquetas.

## 6) Campos JSON Estratégicos

`MeetingNote` utiliza JSON para estrutura analítica flexível:
- `topicsJson`
- `decisionsJson`
- `actionItemsJson`
- `pendingItemsJson`
- `commentsJson`
- `reportJson`

Vantagem: evolução do formato de IA sem migração frequente de colunas.

## 7) Isolamento Multi-tenant

A modelagem permite isolamento por organização através de:
- `Project.organizationId`
- joins de acesso por organização/projeto em todos os módulos sensíveis.

Prática recomendada de consulta:
- sempre filtrar por `organizationId` no nível raiz do domínio (`Project`, `Meeting`, `Card`, `ProjectFile`).

## 8) Decisões para Produção Inicial

- uso de UUIDs como PK para segurança e integração distribuída;
- `createdAt/updatedAt` em entidades operacionais;
- `onDelete` com cascata onde reduz lixo relacional;
- índices em FKs e campos de consulta frequente.

## 9) Próximas Evoluções de Schema

- auditoria por ação (`who/when/what`);
- histórico de versões de análise (`MeetingNoteVersion`);
- convites (`OrganizationInvite` / `ProjectInvite`);
- storage externo (S3/R2) com metadados de bucket/key;
- tabelas para fila e rastreio de jobs de processamento.
