# Auditoria de Idioma - Cais Teams

## Escopo
Revisão e padronização de textos visíveis ao usuário no frontend Next.js para português do Brasil, com padronização de naming do produto para **Cais Teams**.

## Textos em inglês encontrados e corrigidos
- `Dashboard` -> `Painel`
- `Team` -> `Equipe`
- `Projects` -> `Projetos`
- `Settings` -> `Configurações`
- `Support` -> `Suporte`
- `Sign out` -> `Sair`
- `New Meeting` -> `Nova reunião`
- `Search...` -> `Buscar...` / `Buscar na organização`
- `Good morning, Executive Team` -> `Bom dia, Cais Teams`
- `Total Projects` -> `Total de projetos`
- `Meetings Analyzed` -> `Reuniões analisadas`
- `Open Cards` -> `Cards em aberto`
- `Decisions Extracted` -> `Decisões extraídas`
- `Pending Actions` -> `Pendências`
- `Action Required` -> `Ação necessária`
- `View All` -> `Ver tudo`
- `Active Projects` -> `Projetos ativos`
- `Team Management` -> `Gestão da equipe`
- `Overview / Meetings / Board / Files / Reports` -> `Visão geral / Reuniões / Quadro / Arquivos / Relatórios`
- `Upload Audio File` -> `Enviar arquivo de áudio`
- `Browse Files` -> `Selecionar arquivo`
- `Record Audio directly` -> `Gravar áudio direto`
- `Quick Capture` -> `Captura rápida`
- `Share` -> `Compartilhar`
- `Export` -> `Exportar`
- `Transcription / Summary / Topics` -> `Transcrição / Resumo / Tópicos`

## Nome do produto padronizado
Substituições visíveis aplicadas para:
- `CAIS Meeting AI` -> `Cais Teams`
- `CAIS Platform` -> `Cais Teams`
- `Premium AI SaaS` -> `Plataforma de equipes com IA`
- `Meeting AI` -> `Cais Teams`
- `Executive Team` -> `Cais Teams`

## Arquivos corrigidos
- `frontend/src/app/layout.tsx`
- `frontend/src/app/not-found.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/team/page.tsx`
- `frontend/src/app/projects/page.tsx`
- `frontend/src/app/projects/[projectId]/page.tsx`
- `frontend/src/app/projects/[projectId]/meetings/page.tsx`
- `frontend/src/app/projects/[projectId]/meetings/new/page.tsx`
- `frontend/src/app/projects/[projectId]/meetings/[meetingId]/page.tsx`
- `frontend/src/app/projects/[projectId]/board/page.tsx`
- `frontend/src/app/projects/[projectId]/files/page.tsx`
- `frontend/src/app/projects/[projectId]/reports/page.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/components/layout/topbar.tsx`
- `frontend/src/components/layout/project-subnav.tsx`
- `frontend/src/components/navigation/project-workspace-nav.tsx`
- `frontend/src/components/project/project-card.tsx`
- `frontend/src/components/board/kanban-card.tsx`
- `frontend/src/components/board/kanban-column.tsx`
- `frontend/src/components/meetings/audio-recorder-card.tsx`
- `frontend/src/components/meetings/file-upload-card.tsx`
- `frontend/src/components/meetings/meeting-observations-panel.tsx`
- `frontend/src/components/ui/search-input.tsx`
- `frontend/src/components/ui/role-badge.tsx`
- `frontend/src/components/ui/permission-locked-state.tsx`
- `frontend/src/components/auth/auth-screen.tsx`
- `frontend/src/lib/format.ts`

## Termos padronizados
- Produto: **Cais Teams**
- Subtítulo institucional: **Plataforma de equipes com IA**
- Sidebar:
  - `Painel`
  - `Equipe`
  - `Projetos`
  - `Configurações`
  - `Suporte`
  - `Sair`
  - Ação principal: `Nova reunião`
- Submenu interno de projeto:
  - `Visão geral`
  - `Reuniões`
  - `Quadro`
  - `Arquivos`
  - `Relatórios`
- Papéis:
  - `OWNER` -> `Dono`
  - `ADMIN` -> `Administrador`
  - `MEMBER` -> `Membro`
  - `VIEWER` -> `Visualizador`
- Status de reunião:
  - `PENDING` -> `Pendente`
  - `UPLOADED` -> `Áudio enviado`
  - `TRANSCRIBING` -> `Transcrevendo`
  - `TRANSCRIBED` -> `Transcrito`
  - `PROCESSING_AI` -> `Processando IA`
  - `COMPLETED` -> `Concluída`
  - `FAILED` -> `Falhou`
- Prioridades de card:
  - `LOW` -> `Baixa`
  - `MEDIUM` -> `Média`
  - `HIGH` -> `Alta`
  - `URGENT` -> `Urgente`

## Pendências
- Não há pendências de tradução de texto visível identificadas nas páginas principais autenticadas e na landing.
- Permanecem em inglês apenas identificadores técnicos internos (nomes de tipos, enums, variáveis, rotas e imports), conforme critério solicitado.
