# Pesquisa IA Central

## Visão geral
A **Pesquisa IA Central** adiciona uma camada de pergunta e resposta com IA sobre dados reais do Cais Teams, com escopo por organização e por projeto.

Principais pontos:
- Sem mock no frontend.
- Sem resposta sem fonte.
- Resposta da IA com fontes clicáveis.
- Histórico de conversas com arquivamento e exclusão lógica.
- Estratégia RAG econômica para reduzir consumo de tokens.

## Rotas frontend
- `/ai-search` (escopo organizacional)
- `/projects/[projectId]/ai-search` (escopo de projeto)

Componentes criados:
- `AiSearchPage`
- `AiSearchInput`
- `AiSearchMessageList`
- `AiSearchMessage`
- `AiSearchSources`
- `AiSearchHistorySidebar`
- `AiSearchScopeSelector`
- `AiSearchEmptyState`
- `AiSearchLoading`
- `AiSearchThreadActions`

## Fluxo funcional
1. Usuário abre a Pesquisa IA Central.
2. Define escopo (organização ou projeto, quando aplicável).
3. Envia pergunta.
4. Backend recupera chunks relevantes no MySQL.
5. Backend comprime contexto em fontes curtas.
6. Backend chama DeepSeek com contexto limitado.
7. Resposta retorna em JSON com fontes.
8. Pergunta, resposta e fontes são salvas no histórico.
9. Frontend exibe resposta e links para origem.

## Modelos Prisma
Adicionados no `schema.prisma`:

### Enums
- `AiSearchSourceType`
- `AiSearchScope`
- `AiSearchThreadStatus`
- `AiSearchMessageRole`

### Tabelas
- `AiSearchChunk`
  - índice de busca por blocos de conteúdo
  - suporta FULLTEXT em `title` + `content`
- `AiSearchThread`
  - conversa por usuário/organização (e opcionalmente projeto)
- `AiSearchMessage`
  - mensagens USER e ASSISTANT
- `AiSearchMessageSource`
  - fontes usadas por mensagem da IA

Migration criada:
- `backend/prisma/migrations/20260429101000_ai_search_central/migration.sql`

## Endpoints backend
Todos sob autenticação (`requireAuth`) e com escopo por `organizationId` da sessão:

- `POST /ai-search/threads`
- `GET /ai-search/threads`
- `GET /ai-search/threads/:id`
- `POST /ai-search/threads/:id/messages`
- `PATCH /ai-search/threads/:id/archive`
- `DELETE /ai-search/threads/:id`
- `POST /ai-search/reindex`
- `POST /projects/:projectId/ai-search/reindex`
- `GET /ai-search/suggestions`

## Estratégia RAG econômica
Implementada em 4 etapas:

1. **Indexação leve**
- Dados viram chunks em `AiSearchChunk`.
- Transcrições são divididas em blocos de ~800 a 1200 caracteres.
- Chunks indexados para:
  - projetos
  - reuniões
  - transcrições
  - notas
  - decisões
  - tarefas
  - cards
  - comentários de card
  - arquivos

2. **Busca barata no banco**
- Fulltext (`MATCH AGAINST`) quando disponível.
- Fallback com `contains` em título/conteúdo.
- Filtro obrigatório por organização.
- Filtro por projeto quando escopo de projeto.
- Limite de candidatos.

3. **Compressão de contexto**
- Ranqueamento por prioridade de tipo, match textual e recência.
- Seleção de poucas fontes (máximo ~10) com trecho curto.

4. **Resposta com fontes**
- Prompt restritivo ao DeepSeek.
- Resposta em JSON validado.
- Fontes persistidas em `AiSearchMessageSource`.

## Fontes clicáveis
Cada fonte salva/exibida contém:
- `sourceType`
- `sourceId`
- `title`
- `href`
- `excerpt`

Exemplos de navegação:
- Projeto: `/projects/{projectId}`
- Reunião: `/projects/{projectId}/meetings/{meetingId}`
- Card: `/projects/{projectId}/board?card={cardId}`
- Arquivos: `/projects/{projectId}/files`

## Histórico
- Mensagens de usuário e IA ficam em `AiSearchMessage`.
- Fontes ficam em `AiSearchMessageSource`.
- Arquivar altera `status=ARCHIVED` e `archivedAt`.
- Apagar é lógico: `status=DELETED` e `deletedAt`.

## Indexação incremental
Integração adicionada em eventos reais:
- Projeto criado/atualizado/excluído.
- Reunião criada/processada/upload novo de áudio/excluída.
- Card criado/atualizado/excluído.
- Comentário de card criado.
- Arquivo de projeto enviado/excluído.

## Reuso de resposta no mesmo thread
Quando a mesma pergunta é repetida no mesmo thread e não houve atualização de chunks no escopo, o backend reutiliza a resposta anterior para economizar custo/token.

## Integração com navegação
- Nova entrada “Pesquisa IA” na sidebar.
- Nova aba “Pesquisa IA” no `ProjectSubnav`.
- Topbar com botão “Abrir Pesquisa IA” (encaminha para `/ai-search`, opcionalmente com `q=`).

## Variáveis de ambiente
Já utilizadas pelo backend:
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`

## Limitações atuais
- Se não houver fontes no banco para a pergunta, a IA responde com mensagem de insuficiência de dados.
- Link de card usa rota de board com query (`?card=`); a abertura direta do card depende do comportamento da tela de board.
- Não há streaming de tokens no frontend; resposta é exibida após conclusão da chamada.
