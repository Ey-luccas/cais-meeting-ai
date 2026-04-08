# Banco de Dados - CAIS Meeting AI

## Modelagem MySQL

Banco relacional com Prisma ORM, orientado ao ciclo completo de reunião.

Tecnologia:
- MySQL 8
- Prisma Client

Enum de domínio:
- `MeetingStatus`
  - `PENDING`
  - `UPLOADED`
  - `TRANSCRIBING`
  - `TRANSCRIBED`
  - `PROCESSING_AI`
  - `COMPLETED`
  - `FAILED`

## Entidades

### Meeting

Campos principais:
- `id` (UUID, PK)
- `title`
- `description` (Text, opcional)
- `audioPath` (opcional)
- `durationSeconds` (opcional)
- `status` (enum)
- `createdAt`
- `updatedAt`

Responsabilidade:
- entidade raiz do domínio.

### Transcript

Campos principais:
- `id` (UUID, PK)
- `meetingId` (único, FK)
- `fullText` (LongText)
- `language` (opcional)
- `rawJson` (Json, opcional)
- `createdAt`

Responsabilidade:
- armazenar resultado completo de speech-to-text.

### Note

Campos principais:
- `id` (UUID, PK)
- `meetingId` (único, FK)
- `summary` (LongText)
- `topicsJson` (Json)
- `decisionsJson` (Json)
- `actionItemsJson` (Json)
- `pendingItemsJson` (Json)
- `commentsJson` (Json)
- `createdAt`

Responsabilidade:
- armazenar saída analítica gerada por IA.

### MeetingTag

Campos principais:
- `id` (UUID, PK)
- `meetingId` (FK)
- `tag`

Regras:
- `@@unique([meetingId, tag])` para evitar duplicidade por reunião.

Responsabilidade:
- classificação e busca por contexto de reunião.

## Relacionamentos

- `Meeting 1:1 Transcript`
  - uma reunião pode ter no máximo uma transcrição.
- `Meeting 1:1 Note`
  - uma reunião pode ter no máximo uma nota consolidada.
- `Meeting 1:N MeetingTag`
  - uma reunião pode conter várias tags.

Regras de deleção:
- `onDelete: Cascade` em `Transcript`, `Note` e `MeetingTag` quando `Meeting` é removida.

## Índices e Restrições

Índices existentes:
- `Meeting.status`
- `Meeting.createdAt`
- `Transcript.createdAt`
- `Note.createdAt`
- `MeetingTag.meetingId`
- `MeetingTag.tag`

Restrições de unicidade:
- `Transcript.meetingId` (1:1)
- `Note.meetingId` (1:1)
- `MeetingTag(meetingId, tag)`

## Observações de Escalabilidade

1. Processamento assíncrono:
   mover transcrição/análise para fila (ex.: BullMQ/Redis) para maior resiliência.
2. Histórico/versionamento:
   considerar tabela de versões de nota/transcrição para auditoria temporal.
3. Busca avançada:
   para full-text e analytics, avaliar réplica analítica ou mecanismo dedicado.
4. Multi-tenant:
   adicionar entidade de organização e chave de isolamento por tenant.
