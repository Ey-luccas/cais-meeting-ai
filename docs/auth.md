# Autenticação e Autorização - CAIS Meeting AI

## 1) Objetivo

Garantir autenticação central da organização e autorização por papéis em arquitetura multi-tenant.

## 2) Modelo de Identidade

Entidades principais:
- `User`: identidade global.
- `Organization`: tenant.
- `OrganizationMember`: vínculo de usuário na organização com papel.

Papéis organizacionais (`OrganizationRole`):
- `OWNER`
- `ADMIN`
- `MEMBER`
- `VIEWER`

## 3) Estratégia de Sessão

A API aceita token JWT em dois formatos:
- cookie HTTP-only (`AUTH_COOKIE_NAME`), padrão para frontend web;
- header `Authorization: Bearer <token>`.

O payload do token contém:
- `userId`
- `organizationId`
- `memberId`
- `role`

Segurança aplicada:
- senha com `bcrypt` (cost 12);
- cookie `httpOnly`, `sameSite=lax`, `secure` em produção;
- expiração configurável por `JWT_EXPIRES_IN` e `AUTH_COOKIE_MAX_AGE_DAYS`.

## 4) Contexto Autenticado da Requisição

Middleware `requireAuth`:
1. extrai token de cookie ou bearer;
2. valida assinatura JWT;
3. confirma vínculo real em `OrganizationMember`;
4. injeta `req.auth`.

`req.auth`:
- `userId`
- `organizationId`
- `memberId`
- `role`

Middleware `requireRoles(...roles)`:
- bloqueia acesso quando o papel atual não está na lista permitida.

## 5) Endpoints de Auth

### `POST /auth/register`

Cria organização e usuário OWNER no mesmo fluxo.

Payload:
- `organizationName` (obrigatório)
- `organizationSlug` (obrigatório)
- `organizationEmail` (opcional)
- `ownerName` (obrigatório)
- `ownerEmail` (obrigatório)
- `ownerPassword` (obrigatório)

Fluxo:
1. valida payload;
2. verifica unicidade de e-mail do usuário e slug;
3. cria `User`;
4. cria `Organization`;
5. cria `OrganizationMember` com `role = OWNER`;
6. gera JWT;
7. retorna sessão + seta cookie.

### `POST /auth/login`

Payload:
- `email`
- `password`
- `organizationSlug` (opcional, para selecionar organização ativa)

Fluxo:
1. valida credenciais;
2. carrega memberships do usuário;
3. escolhe organização ativa (slug informado ou primeira);
4. gera JWT;
5. retorna sessão + seta cookie.

### `GET /auth/me`

Retorna sessão atual (usuário + organização ativa + lista de organizações acessíveis).

Observação:
- endpoint legado `GET /auth/session` também está disponível por compatibilidade.

## 6) Estrutura da Resposta de Sessão

Campos principais:
- `token`
- `user`: `{ id, name, fullName, email, avatarUrl }`
- `activeOrganization`: `{ id, name, slug, email, memberId, role }`
- `organizations[]`: organizações nas quais o usuário é membro

## 7) Regras de Autorização (Resumo)

Organização/equipe:
- `OWNER` e `ADMIN` podem gerenciar membros.
- `MEMBER` e `VIEWER` não podem gerenciar equipe.

Projetos/board/reuniões/arquivos:
- papéis organizacionais elevados (`OWNER`/`ADMIN`) têm acesso administrativo;
- demais usuários dependem de vínculo em `ProjectMember`;
- `VIEWER` em projeto possui acesso de leitura.

## 8) Endpoints Relacionados a Organização/Equipe

- `GET /organization`
- `PATCH /organization`
- `GET /organization/members`
- `POST /organization/members`
- `PATCH /organization/members/:id`
- `DELETE /organization/members/:id`

Compatibilidade mantida:
- `/organizations/current` e rotas equivalentes ainda disponíveis.

## 9) Boas Práticas Recomendadas

- usar apenas HTTPS em produção;
- rotação periódica de `JWT_SECRET`;
- adicionar auditoria de login e troca de papéis;
- evoluir para refresh token com revogação server-side.
