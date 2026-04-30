# Módulo Biblioteca do Projeto

## Visão do módulo
A Biblioteca é a central unificada de conhecimento e materiais do projeto no Cais Teams. Ela substitui a experiência principal de **Arquivos** por um único módulo capaz de armazenar e operar:
- arquivos enviados
- documentos editáveis
- atas geradas com IA
- conteúdos vinculados a reuniões
- materiais indexáveis na Pesquisa IA

Rotas principais:
- `GET /projects/:projectId/library` (API)
- `/projects/[projectId]/library` (Frontend)
- `/projects/[projectId]/library/documents/[documentId]` (Frontend)

A rota antiga `/projects/[projectId]/files` foi mantida com redirecionamento para `/projects/[projectId]/library`.

## Diferença entre Documento e Arquivo
- **DOCUMENT**:
  - conteúdo editável (`contentMarkdown`, `contentText`, `contentJson`)
  - versionamento (`LibraryItemVersion`)
  - exportação Markdown e DOCX
  - pode ser criado manualmente ou por IA/reunião
- **FILE**:
  - upload bruto (metadados + caminho físico)
  - abertura/baixar direto da Biblioteca
  - metadados, pasta e etiquetas

## Models criados/ajustados

### Enums novos
- `LibraryItemType`: `DOCUMENT`, `FILE`
- `LibraryItemOrigin`: `MANUAL`, `AI`, `MEETING`, `UPLOAD`
- `LibraryItemStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `LibraryDocumentType`:
  - `MEETING_MINUTES`, `SCOPE`, `REQUIREMENTS`, `PLANNING`, `PROPOSAL`, `TECHNICAL`, `MANUAL`, `DECISION_RECORD`, `ACTION_PLAN`, `OTHER`

### Models novos
- `LibraryFolder`
- `LibraryItem`
- `LibraryTag`
- `LibraryItemTag`
- `LibraryItemVersion`

### Ajustes de integração
- `AiSearchSourceType` recebeu `LIBRARY_ITEM`
- relações adicionadas em `Project`, `Meeting`, `User` e `ProjectFile` para o novo domínio

## Migração e compatibilidade
- Migration criada em:
  - `backend/prisma/migrations/20260430150000_library_module_unified/migration.sql`
- Inclui:
  - criação das tabelas da Biblioteca
  - índices e FKs
  - atualização de enums da Pesquisa IA
  - backfill de `ProjectFile` para `LibraryItem` (`type=FILE`, `origin=UPLOAD`, `status=PUBLISHED`)

## Endpoints

### Listagem e filtros
- `GET /projects/:projectId/library`
  - query: `q`, `type`, `origin`, `status`, `folderId`, `tagId`

### Pastas
- `GET /projects/:projectId/library/folders`
- `POST /projects/:projectId/library/folders`
- `PATCH /projects/:projectId/library/folders/:folderId`
- `DELETE /projects/:projectId/library/folders/:folderId`

### Etiquetas
- `GET /projects/:projectId/library/tags`
- `POST /projects/:projectId/library/tags`
- `PATCH /projects/:projectId/library/tags/:tagId`
- `DELETE /projects/:projectId/library/tags/:tagId`

### Itens
- `POST /projects/:projectId/library/documents`
- `POST /projects/:projectId/library/files`
- `GET /projects/:projectId/library/items/:itemId`
- `PATCH /projects/:projectId/library/items/:itemId`
- `PATCH /projects/:projectId/library/items/:itemId/archive`
- `DELETE /projects/:projectId/library/items/:itemId` (soft delete via `deletedAt`)

### Tags no item
- `POST /projects/:projectId/library/items/:itemId/tags/:tagId`
- `DELETE /projects/:projectId/library/items/:itemId/tags/:tagId`

### Exportação
- `GET /projects/:projectId/library/items/:itemId/export?format=markdown`
- `GET /projects/:projectId/library/items/:itemId/export?format=docx`

### Ata da reunião
- `POST /projects/:projectId/meetings/:meetingId/library/generate-minutes`
  - body opcional: `{ "forceNew": true }`

## Fluxo de upload
1. Usuário envia arquivo na Biblioteca.
2. Backend valida sessão/permissão.
3. Upload é persistido em storage e metadados ficam em `LibraryItem` (`type=FILE`, `origin=UPLOAD`).
4. Item aparece na listagem da Biblioteca.
5. Índice da Pesquisa IA é atualizado para o novo item.

## Fluxo de criação de documento
1. Usuário clica em **Novo documento**.
2. Documento é criado como `DOCUMENT`, `origin=MANUAL`, `status=DRAFT`.
3. É criada versão inicial em `LibraryItemVersion`.
4. Frontend redireciona para `/projects/:projectId/library/documents/:documentId`.

## Fluxo de geração de ata
1. Na reunião, ação **Gerar ata** chama endpoint dedicado.
2. Backend valida existência de transcrição/notas.
3. DeepSeek gera Markdown com estrutura obrigatória.
4. Sistema cria `LibraryItem`:
   - `type=DOCUMENT`
   - `origin=MEETING`
   - `documentType=MEETING_MINUTES`
   - `status=DRAFT`
   - `meetingId` vinculado
5. Frontend redireciona para o documento gerado.

## Exportação Markdown/DOCX
- Markdown: arquivo `.md` com metadados básicos + conteúdo.
- DOCX: arquivo `.docx` gerado com biblioteca `docx` no backend.
- PDF não é exibido na UI (não implementado).

## Integração com Pesquisa IA
- Novo `sourceType`: `LIBRARY_ITEM`.
- Indexação inclui:
  - `title`, `description`, `contentText`, `fileName`, `origin`, `type`, `status`, tags
- `href` indexado:
  - documento: `/projects/{projectId}/library/documents/{itemId}`
  - arquivo: `/projects/{projectId}/library?item={itemId}`
- Itens com `deletedAt` são removidos do índice.

## Integração com Notificações
O serviço da Biblioteca dispara notificações internas (`SYSTEM`/`IN_APP`) para eventos:
- novo documento criado
- novo arquivo enviado
- documento publicado
- nova ata gerada

Alvos (`targetHref`) apontam para Biblioteca/documento.

## Permissões
Regras aplicadas no backend por projeto/organização:
- leitura: usuário membro/administrador da organização
- escrita: `OWNER`, `ADMIN`, `MEMBER`
- administração da biblioteca (excluir/arquivar/pastas/etiquetas): `OWNER`/`ADMIN`

No frontend, ações são exibidas conforme essas permissões.

## Rotas antigas de Arquivos
- Item principal do submenu do projeto foi alterado de **Arquivos** para **Biblioteca**.
- `/projects/[projectId]/files` permanece somente como redirecionamento para `/projects/[projectId]/library`.

## Pendências reais
- Não há exportação PDF (não exposta na UI).
- Itens de arquivo ainda não têm edição de conteúdo textual no próprio arquivo bruto (somente metadados).
- Indexação sem OCR/extração avançada de conteúdo binário (texto indexado depende do conteúdo disponível no item).
