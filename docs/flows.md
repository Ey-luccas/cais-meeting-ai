# Fluxos do Produto - CAIS Meeting AI

## 1) Onboarding e Sessão

### 1.1 Registro inicial (`POST /auth/register`)

Objetivo: criar workspace da organização com primeiro usuário OWNER.

Passos:
1. validar payload de organização e usuário;
2. criar `User`;
3. criar `Organization`;
4. criar `OrganizationMember` com papel `OWNER`;
5. emitir JWT e persistir cookie;
6. retornar sessão com organização ativa.

### 1.2 Login (`POST /auth/login`)

Passos:
1. validar credenciais;
2. carregar memberships do usuário;
3. selecionar organização ativa (slug opcional);
4. emitir JWT e atualizar cookie;
5. retornar contexto de sessão.

### 1.3 Sessão atual (`GET /auth/me`)

Passos:
1. validar token;
2. revalidar membership;
3. retornar usuário + organização ativa + organizações acessíveis.

## 2) Gestão de Organização e Equipe

### 2.1 Organização
- `GET /organization`
- `PATCH /organization`

### 2.2 Equipe
- `GET /organization/members`
- `POST /organization/members`
- `PATCH /organization/members/:id`
- `DELETE /organization/members/:id`

Regra de autorização:
- somente `OWNER` e `ADMIN` gerenciam equipe.

## 3) Fluxo de Projeto

### 3.1 Criação de projeto (`POST /projects`)

Passos:
1. validar dados do projeto;
2. criar `Project`;
3. vincular criador como `ProjectMember` (`OWNER`);
4. criar `Board` padrão;
5. criar colunas padrão:
   - A Fazer
   - Em Andamento
   - Em Revisão
   - Concluído

### 3.2 Operação do projeto
- listagem e detalhe (`GET /projects`, `GET /projects/:id`)
- atualização e exclusão (`PATCH /projects/:id`, `DELETE /projects/:id`)
- gestão de membros do projeto (`/projects/:id/members`)
- arquivos (`/projects/:id/files`)
- relatório consolidado (`/projects/:id/reports`)

## 4) Fluxo de Reunião

### 4.1 Criação (`POST /projects/:id/meetings`)

Passos:
1. validar acesso ao projeto;
2. criar reunião com `status = PENDING`;
3. opcionalmente receber áudio já na criação.

### 4.2 Upload/reupload de áudio (`POST /meetings/:meetingId/upload`)

Passos:
1. validar arquivo e permissões;
2. persistir mídia localmente;
3. atualizar reunião para `UPLOADED`;
4. limpar transcrição/análise anteriores quando aplicável.

### 4.3 Observações manuais (`POST /meetings/:meetingId/observations`)

Passos:
1. registrar `timestampSeconds`, `type`, `content` e autor;
2. persistir `MeetingObservation`;
3. disponibilizar observações para leitura na tela da reunião;
4. usar observações como contexto adicional na análise DeepSeek.

## 5) Pipeline de Transcrição com Chunks (Groq)

Entrada: `POST /meetings/:meetingId/process` (pipeline completo).

Etapas:
1. validar reunião e presença de áudio;
2. definir `status = TRANSCRIBING`;
3. dividir áudio com FFmpeg em chunks (~9 min alvo, limite 25MB por chunk);
4. transcrever cada chunk via Groq em ordem;
5. aplicar retry por chunk em falha transitória;
6. consolidar transcrição com marcadores `[HH:MM:SS]` por início de chunk;
7. persistir `Transcript` com texto completo, idioma e payload bruto;
8. definir `status = TRANSCRIBED`.

Falhas:
- falha grave em chunk/processamento leva reunião para `FAILED`.

## 6) Pipeline de Análise (DeepSeek)

Após transcrição:
1. definir `status = PROCESSING_AI`;
2. enviar prompt com transcrição + observações manuais;
3. forçar resposta JSON estruturada;
4. validar e normalizar saída (`summary`, `topics`, `decisions`, `actionItems`, `pendingItems`, `comments`, `report`);
5. persistir `MeetingNote`;
6. avançar para criação automática de cards;
7. finalizar reunião com `status = COMPLETED`.

## 7) Geração Automática de Cards

Fonte: `actionItems` retornados na análise.

Passos:
1. localizar coluna `A Fazer` do board do projeto;
2. deduplicar itens óbvios dentro da mesma reunião;
3. criar card com:
   - `sourceType = AI`
   - `meetingId` de origem
   - prioridade e prazo inferidos (quando presentes)
4. tentar correspondência de responsáveis citados com membros do projeto;
5. quando aplicável, gerar checklist sugerido;
6. salvar sugestões de responsáveis não resolvidas no conteúdo do card.

## 8) Fluxo de Board Manual

Principais operações:
- criar/editar/excluir card;
- mover card entre colunas;
- atribuir responsáveis;
- checklist e toggle de item;
- comentários;
- anexos e links;
- etiquetas.

O board integra duas origens:
- execução manual do time (`MANUAL`)
- execução sugerida por IA (`AI`).

## 9) Fluxo de Relatórios

`GET /projects/:id/reports` consolida:
- total de reuniões no período;
- tópicos recorrentes;
- decisões recentes;
- tarefas abertas vindas de reuniões;
- pendências recorrentes;
- resumo por período (buckets temporais).
