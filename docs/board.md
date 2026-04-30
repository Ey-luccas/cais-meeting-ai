# Board Kanban - CAIS Meeting AI

## 1) Objetivo

Disponibilizar um board colaborativo estilo Trello para execução diária de projetos, integrando cards manuais e cards gerados por IA a partir de reuniões.

## 2) Estrutura de Dados do Board

Entidades:
- `Board` (1 por projeto)
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

### Colunas padrão por projeto
- A Fazer
- Em Andamento
- Em Revisão
- Concluído

## 3) Card: Capacidades

Campos base:
- `title`
- `description`
- `priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`)
- `dueDate`
- `sourceType` (`MANUAL` ou `AI`)
- `meetingId` (quando originado de reunião)

Relacionamentos suportados:
- múltiplos responsáveis (`CardAssignee`)
- checklist e itens
- comentários
- anexos
- links
- etiquetas

## 4) Permissões

Regras gerais:
- `OWNER` e `ADMIN` da organização têm gestão completa;
- membros do projeto com papel `VIEWER` têm leitura;
- papéis com escrita no projeto podem criar/editar/mover cards.

Validações importantes:
- responsável precisa pertencer ao projeto;
- etiqueta precisa pertencer ao projeto;
- reunião vinculada ao card precisa pertencer ao mesmo projeto.

## 5) Endpoints Principais

### Leitura do board
- `GET /projects/:id/board`

### Cards
- `POST /projects/:id/board/cards`
- `PATCH /board/cards/:id`
- `DELETE /board/cards/:id`

### Checklist
- `POST /board/cards/:id/checklists`
- `POST /board/checklist-items/:id/toggle`

### Colaboração
- `POST /board/cards/:id/comments`
- `POST /board/cards/:id/attachments`
- `POST /board/cards/:id/links`
- `POST /board/cards/:id/assignees`
- `POST /board/cards/:id/labels`

## 6) Fluxo Manual de Operação

1. criar card na coluna desejada;
2. ajustar prioridade e prazo;
3. atribuir responsáveis;
4. decompor em checklist;
5. registrar comentários de evolução;
6. mover entre colunas até concluído.

## 7) Geração Automática de Cards (IA)

Integração com reuniões:
- ao processar reunião, `actionItems` podem virar cards automáticos.

Comportamento:
- criação na coluna **A Fazer**;
- `sourceType = AI`;
- vínculo com `meetingId`;
- deduplicação por assinatura textual dentro da mesma reunião;
- tentativa de autoatribuição por nome/e-mail citado na reunião;
- quando a tarefa for ampla, pode gerar `Checklist sugerido (IA)`.

## 8) Correspondência de Responsáveis

Estratégia de match:
- comparação por e-mail quando disponível;
- fallback por normalização de nome;
- quando não há match confiável, sugestão permanece no card (sem atribuição automática incorreta).

## 9) UX Esperada no Frontend

Página alvo: ` /projects/[id]/board `

Diretrizes:
- visual claro e premium institucional;
- manipulação rápida de cards;
- leitura fácil de prioridade, prazo e responsáveis;
- responsividade para desktop e mobile;
- distinção visual entre cards `MANUAL` e `AI`.

## 10) Evoluções Recomendadas

- drag-and-drop com reordenação persistente de cards e colunas;
- histórico de mudanças por card (activity log);
- automações por regra (ex.: SLA vencido, mover para revisão);
- templates de checklists por tipo de tarefa;
- notificações de prazo e menções.
