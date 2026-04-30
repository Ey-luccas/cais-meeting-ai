# Auditoria de Navegação e Renderização Next.js - Cais Teams

## Data
29 de abril de 2026

## Objetivo
Eliminar sensação de recarregamento visual entre rotas autenticadas e padronizar a arquitetura de layout compartilhado no App Router.

## Problemas encontrados
1. `AppShell` era renderizado dentro de cada `page.tsx` autenticada.
2. Cada página autenticada recriava fluxo de autenticação e wrapper de tela completa, causando remount visual do shell.
3. Sidebar/Topbar não estavam centralizadas em um layout de segmento (`app/(app)/layout.tsx`).
4. Rotas autenticadas não estavam agrupadas em route group dedicado.

## Arquitetura final aplicada
1. Layout global raiz: `frontend/src/app/layout.tsx`.
2. Layout autenticado compartilhado: `frontend/src/app/(app)/layout.tsx`.
3. Shell persistente final: `frontend/src/components/layout/authenticated-layout.tsx` + `frontend/src/components/layout/app-shell.tsx`.
4. Configuração por página sem recriar shell: `frontend/src/components/layout/app-shell-config.tsx`.
5. Sessão compartilhada entre páginas autenticadas: `frontend/src/lib/app-session.tsx`.

## Rotas autenticadas cobertas por `app/(app)/layout.tsx`
- `/dashboard`
- `/team`
- `/projects`
- `/projects/[projectId]`
- `/projects/[projectId]/meetings`
- `/projects/[projectId]/meetings/new`
- `/projects/[projectId]/meetings/[meetingId]`
- `/projects/[projectId]/board`
- `/projects/[projectId]/files`
- `/projects/[projectId]/reports`

## Correções aplicadas
1. Criação do route group autenticado `app/(app)` e migração das páginas autenticadas para esse grupo.
2. Criação de `AuthenticatedLayout` para resolver auth uma vez e manter `AppShell` persistente.
3. Remoção de `AppShell` duplicado de todos os `page.tsx` autenticados.
4. Introdução de `useConfigureAppShell(...)` para cada página definir título, busca, subnav de projeto e comportamento de container sem remontar sidebar/topbar.
5. `AppShell` ajustado para consumir configuração por contexto e inferir `projectId` via rota quando necessário.
6. Remoção de dependência de auth por página para renderização de shell (auth centralizada no layout do grupo).

## Arquivos corrigidos
- `frontend/src/app/(app)/layout.tsx`
- `frontend/src/components/layout/authenticated-layout.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/layout/app-shell-config.tsx`
- `frontend/src/lib/app-session.tsx`
- `frontend/src/app/(app)/dashboard/page.tsx`
- `frontend/src/app/(app)/team/page.tsx`
- `frontend/src/app/(app)/projects/page.tsx`
- `frontend/src/app/(app)/projects/[projectId]/page.tsx`
- `frontend/src/app/(app)/projects/[projectId]/meetings/page.tsx`
- `frontend/src/app/(app)/projects/[projectId]/meetings/new/page.tsx`
- `frontend/src/app/(app)/projects/[projectId]/meetings/[meetingId]/page.tsx`
- `frontend/src/app/(app)/projects/[projectId]/board/page.tsx`
- `frontend/src/app/(app)/projects/[projectId]/files/page.tsx`
- `frontend/src/app/(app)/projects/[projectId]/reports/page.tsx`

## Auditoria de navegação interna
1. Não foram encontrados links internos com `<a href="/rota">` nas áreas autenticadas; navegação interna está por `next/link` e `router.push`.
2. Não foi encontrado uso de `window.location.assign`, `window.location =`, `location.reload` para navegação.
3. Existe uso de `window.location.href` apenas para copiar URL atual no clipboard (não é navegação).

## Active state
1. Sidebar permanece com active state por `usePathname` em:
   - `frontend/src/components/layout/sidebar.tsx`
2. Subnav de projeto permanece com active state por `usePathname` em:
   - `frontend/src/components/layout/project-subnav.tsx`

## loading.tsx
- Não existem arquivos `loading.tsx` no `app/` atual, portanto não há fallback de rota alta substituindo o shell inteiro.

## Dynamic routes e layout
1. Não existe layout local em `projects/[projectId]/layout.tsx` que sobreponha sidebar/topbar.
2. Sidebar/Topbar estão acima de todas as rotas autenticadas no `app/(app)/layout.tsx`.

## Verificações executadas
1. `npm run lint --workspace frontend` -> sem warnings/erros.
2. `npm run build --workspace frontend` -> build concluído com sucesso.

## Validação pós-refatoração
1. `AppShell` não possui `key` dinâmica e não há forçamento de remount por chave em `AppShell`, `AuthenticatedLayout`, `Sidebar`, `Topbar` ou providers globais.
2. `AppSessionProvider` e `AppShellConfigProvider` permanecem no layout autenticado compartilhado (`app/(app)/layout.tsx` via `AuthenticatedLayout`), não dentro de páginas individuais.
3. Não existem arquivos `loading.tsx` em `app/(app)`, `dashboard`, `team`, `projects` ou `projects/[projectId]`; portanto não há fallback de tela cheia substituindo shell.
4. Não há `Suspense` em nível alto envolvendo todo o shell autenticado.
5. `ProjectSubnav` permanece único e consistente, renderizado pelo mesmo componente para:
   - `/projects/[projectId]`
   - `/projects/[projectId]/meetings`
   - `/projects/[projectId]/board`
   - `/projects/[projectId]/files`
   - `/projects/[projectId]/reports`
6. `app-shell-config.tsx` foi ajustado para configuração de conteúdo apenas:
   - `title`
   - `searchValue`
   - `searchPlaceholder`
   - `onSearchChange`
   - `project` (contexto para subnav)
   Removidos controles de estrutura visual por página (`containerSize`, `containerClassName`, `withContainer`).
7. Navegação interna continua em `next/link` e `router.push`/`router.replace` (`next/navigation`), sem `window.location`, `location.href` para navegação ou reload manual.
8. Ajustes de estabilidade visual e overflow:
   - Board mantém área de conteúdo full-bleed por regra de rota no shell, sem depender de config estrutural.
   - Reforço de `min-w-0`, `break-words` e `overflow-x-auto` em telas de reunião para prevenir overflow horizontal indevido fora do board.
   - Sidebar/Topbar mantidas fixas e estáveis entre rotas autenticadas.
9. Diagnóstico temporário adicionado em `development`:
   - `console.log("AppShell mounted")`
   - `console.log("Sidebar mounted")`
   - `console.log("Topbar mounted")`
   Os logs são protegidos por `NODE_ENV === "development"` para não afetar produção.
10. Resultado da validação:
   - `AppShell`: não remonta por troca de rota autenticada (sem key dinâmica e layout persistente).
   - `Sidebar`: não remonta por troca de rota autenticada (componente persistente no shell).
   - `Topbar`: não remonta por troca de rota autenticada (componente persistente no shell).
   - Não havia `key` dinâmica forçando remount.
   - Não havia `loading.tsx`/`Suspense` substituindo shell.
   - Ajustes finais aplicados para reforçar estabilidade visual e evitar overflow.

## Conclusão
- Sidebar e Topbar agora são renderizadas de forma persistente no layout autenticado compartilhado.
- Apenas a área de conteúdo troca entre páginas.
- A arquitetura atende o padrão SaaS fluido esperado no App Router.
