# Sistema de Notificações - Cais Teams

## Visão geral
O Cais Teams possui um sistema de notificações reais com persistência em banco (MySQL/Prisma), API dedicada no backend, dropdown funcional no sino da Topbar e toast no canto inferior esquerdo no frontend.

Não há mock: toda notificação exibida vem da tabela `Notification`.

## Modelagem Prisma
Model principal:

- `Notification`
  - `id`
  - `organizationId`
  - `userId` (opcional)
  - `projectId` (opcional)
  - `title`
  - `message`
  - `type`
  - `channel`
  - `targetType` (opcional)
  - `targetId` (opcional)
  - `targetHref` (opcional)
  - `isRead`
  - `readAt` (opcional)
  - `emailSentAt` (opcional)
  - `createdAt`
  - `updatedAt`

Enums:

- `NotificationType`
  - `CARD_CREATED`
  - `CARD_ASSIGNED`
  - `CARD_DUE_DATE_SET`
  - `CARD_DUE_SOON`
  - `CARD_OVERDUE`
  - `CARD_COMMENTED`
  - `CARD_MOVED`
  - `MEETING_CREATED`
  - `MEETING_TRANSCRIPTION_READY`
  - `MEETING_NOTES_READY`
  - `FILE_UPLOADED`
  - `PROJECT_MEMBER_ADDED`
  - `SYSTEM`

- `NotificationChannel`
  - `IN_APP`
  - `EMAIL`
  - `BOTH`

Migration relacionada:

- `backend/prisma/migrations/20260430103000_notifications_system/migration.sql`

## Endpoints
Módulo backend:

- `backend/src/modules/notifications`

Rotas:

- `GET /notifications`
  - Lista notificações do usuário autenticado.
  - Query params:
    - `unreadOnly=true|false`
    - `limit` (default 20, máximo 100)
  - Ordenação: mais recentes primeiro.

- `GET /notifications/unread-count`
  - Retorna contador de não lidas para o escopo visível do usuário.

- `PATCH /notifications/:id/read`
  - Marca uma notificação como lida.

- `PATCH /notifications/read-all`
  - Marca todas as notificações visíveis como lidas.

- `DELETE /notifications/:id`
  - Remove notificação visível para o usuário.

Campos retornados na listagem incluem:

- `id`
- `title`
- `message`
- `type`
- `targetHref`
- `isRead`
- `createdAt`
- `projectId`
- `targetType`

## Segurança e permissões
O backend aplica escopo de visualização por:

- usuário autenticado
- `organizationId` da sessão
- associação ao projeto quando a notificação está vinculada a projeto
- papel organizacional (`OWNER`/`ADMIN` podem ver notificações gerais de todos os projetos da organização)

Regras importantes:

- nunca retorna notificações de outra organização
- notificações com `userId` específico só aparecem para o usuário correto
- para perfis não administrativos, notificações vinculadas a projeto só aparecem quando há acesso ao projeto

## Serviço central de criação
Arquivo:

- `backend/src/modules/notifications/notification.service.ts`

Função central:

- `createNotification({...})`

Comportamento:

1. Persiste no banco quando `channel` é `IN_APP` ou `BOTH`.
2. Envia e-mail quando `channel` é `EMAIL` ou `BOTH`.
3. Falha de e-mail não quebra fluxo principal.
4. Falhas de e-mail são registradas em log.

## Envio de e-mail
Arquivo:

- `backend/src/modules/notifications/email-notification.service.ts`

Configuração por ambiente:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Comportamento:

- assunto: `[Cais Teams] {title}`
- corpo em português
- inclui link para origem (`targetHref`)
- se SMTP não estiver configurado, registra warning em log e segue fluxo
- se e-mail do destinatário for inválido, não envia e registra warning

## Eventos que geram notificações
Integração principal via:

- `backend/src/modules/notifications/notification-event.service.ts`

Eventos já integrados:

- cartão criado (`CARD_CREATED`) - IN_APP
- usuário atribuído (`CARD_ASSIGNED`) - BOTH
- prazo definido/alterado (`CARD_DUE_DATE_SET`) - BOTH
- comentário no cartão (`CARD_COMMENTED`) - IN_APP
- cartão movido (`CARD_MOVED`) - IN_APP
- transcrição pronta (`MEETING_TRANSCRIPTION_READY`) - BOTH
- notas geradas (`MEETING_NOTES_READY`) - BOTH
- arquivo enviado (`FILE_UPLOADED`) - IN_APP
- membro adicionado ao projeto (`PROJECT_MEMBER_ADDED`) - BOTH

Targets internos utilizados:

- `/projects/{projectId}/board?card={cardId}`
- `/projects/{projectId}/meetings/{meetingId}`
- `/projects/{projectId}/files`
- `/projects/{projectId}`

## Eventos com e-mail
Eventos configurados com canal `BOTH` (in-app + e-mail):

- `CARD_ASSIGNED`
- `CARD_DUE_DATE_SET`
- `CARD_DUE_SOON`
- `CARD_OVERDUE`
- `MEETING_TRANSCRIPTION_READY`
- `MEETING_NOTES_READY`
- `PROJECT_MEMBER_ADDED`

## Dropdown do sino (Topbar)
Arquivo:

- `frontend/src/components/layout/topbar.tsx`

Comportamento:

- clique no sino abre dropdown real
- usa `GET /notifications` e `GET /notifications/unread-count`
- mostra badge de não lidas
- permite clicar notificação para marcar como lida
- permite `Marcar todas como lidas`
- navega para `targetHref` quando existir
- estados de loading, erro e vazio

Hook utilizado:

- `frontend/src/lib/use-notifications.ts`

## Toast no canto inferior esquerdo
Implementação no frontend:

- toasts renderizados em `bottom-left`
- duração ~6.5s
- texto em português
- ação opcional `Abrir` quando existir `targetHref`
- polling para detectar novidades (45s)
- deduplicação por `localStorage` + controle em memória

## Limitações atuais
- Não existe página dedicada `/notifications` nesta versão.
- Não existe tela persistida de preferências de notificação por usuário.
- Não existe job agendado automático registrado no backend para prazos; há serviço pronto para cron.

## Prazos próximos e vencidos (job)
Existe função preparada para agendamento futuro:

- `notificationEventService.runDueDateNotifications()`

Ela processa:

- `CARD_DUE_SOON`
- `CARD_OVERDUE`

A integração com cron externo (ex.: scheduler do ambiente) pode chamar essa função periodicamente.
