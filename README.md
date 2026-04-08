# CAIS Meeting AI

Plataforma fullstack para transformar reuniões em memória operacional: captura de áudio, transcrição com Groq, análise com DeepSeek e consolidação estruturada no MySQL.

## Visão Geral

O **CAIS Meeting AI** centraliza o ciclo pós-reunião em uma experiência web institucional:
- criação e gestão de reuniões
- upload ou gravação de áudio
- transcrição automática
- geração de notas executivas (resumo, tópicos, decisões, tarefas, pendências e comentários)
- histórico consultável com status de processamento

## Proposta de Valor

- Reduzir retrabalho na documentação de reuniões.
- Aumentar velocidade de tomada de decisão com síntese automática.
- Estruturar memória organizacional com dados persistidos e rastreáveis.
- Padronizar o fluxo operacional de captura -> análise -> execução.

## Stack Utilizada

### Frontend
- `Next.js 14` (App Router)
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui`
- `Radix UI`

### Backend
- `Node.js`
- `Express`
- `TypeScript`
- `Prisma ORM`
- `Multer` (upload local)
- `Groq SDK` (speech-to-text)
- `DeepSeek API` (análise textual)

### Banco e Infra
- `MySQL 8`
- `Docker Compose` (MySQL + Adminer)

## Arquitetura (Resumo)

Monorepo com separação explícita de responsabilidades:
- `frontend/`: interface institucional e operacional
- `backend/`: API REST modular, integração com IA e persistência
- `MySQL + Prisma`: armazenamento de reuniões, transcrições, notas e tags

Fluxo principal:
1. Frontend envia comandos REST para backend.
2. Backend persiste reunião e arquivo de áudio local.
3. Backend divide áudio em chunks e transcreve cada parte com Groq.
4. Backend gera notas estruturadas com DeepSeek.
5. Backend atualiza status e retorna dados consolidados.

## Funcionalidades Principais

- Landing page institucional premium.
- Dashboard com indicadores e atividade recente.
- CRUD básico de reuniões.
- Upload manual de áudio (`mp3`, `wav`, `m4a`, `webm`).
- Gravação de áudio no navegador (`MediaRecorder API`).
- Transcrição de áudio com Groq.
- Geração de notas com DeepSeek.
- Tela de detalhe com:
  - player de áudio
  - transcrição completa
  - resumo
  - tópicos
  - decisões
  - tarefas
  - pendências
  - comentários
- Copiar conteúdos-chave diretamente da interface.

## Estrutura de Pastas

```text
cais-meeting-ai/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── modules/
│   │   └── types/
│   └── .env.example
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── .env.example
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Variáveis de Ambiente

### Frontend (`frontend/.env.local`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base da API REST | `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_MAX_FILE_SIZE_MB` | Limite de upload exibido na UI | `200` |

### Backend (`backend/.env`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `NODE_ENV` | Ambiente de execução | `development` |
| `PORT` | Porta do backend | `4000` |
| `DATABASE_URL` | Conexão MySQL para Prisma | `mysql://root:root@localhost:3306/cais_meeting_ai` |
| `CORS_ORIGIN` | Origem permitida para o frontend | `http://localhost:3000` |
| `UPLOAD_DIR` | Diretório local de uploads | `uploads` |
| `MAX_FILE_SIZE_MB` | Limite de upload no backend em MB | `200` |
| `FFMPEG_BIN` | Binário do ffmpeg | `ffmpeg` |
| `FFPROBE_BIN` | Binário do ffprobe | `ffprobe` |
| `GROQ_API_KEY` | Chave da API Groq | `...` |
| `GROQ_STT_MODEL` | Modelo STT Groq | `whisper-large-v3` |
| `GROQ_MAX_CHUNK_MB` | Limite por chunk para Groq | `25` |
| `AUDIO_CHUNK_SECONDS` | Duração alvo de cada chunk | `600` |
| `AUDIO_MIN_CHUNK_SECONDS` | Menor duração permitida para resplit | `60` |
| `GROQ_CHUNK_RETRY_ATTEMPTS` | Tentativas extras por chunk | `2` |
| `DEEPSEEK_API_KEY` | Chave da API DeepSeek | `...` |
| `DEEPSEEK_MODEL` | Modelo DeepSeek | `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | URL base da API DeepSeek | `https://api.deepseek.com` |

## Instalação

Pré-requisitos:
- `Node.js >= 20`
- `npm >= 10`
- `Docker + Docker Compose`
- `ffmpeg` e `ffprobe` instalados no sistema (para transcrição de áudios longos)

1. Instale as dependências:

```bash
npm install
```

2. Configure os ambientes:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

3. Suba o banco local:

```bash
docker compose up -d
```

4. Gere Prisma Client e rode migrações:

```bash
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
```

Para criar novas migrações em ambiente de desenvolvimento:

```bash
npm run prisma:migrate:dev --workspace backend
```

## Como Rodar

### Frontend + Backend juntos

```bash
npm run dev
```

### Apenas frontend

```bash
npm run dev --workspace frontend
```

### Apenas backend

```bash
npm run dev --workspace backend
```

### Build e qualidade

```bash
npm run lint
npm run build
```

## Fluxo de Processamento da Reunião

1. `POST /meetings` cria a reunião (`PENDING`).
2. `POST /meetings/:id/upload` envia áudio (`UPLOADED`).
3. `POST /meetings/:id/transcribe` divide o áudio em chunks e roda Groq por parte (`TRANSCRIBING` -> `TRANSCRIBED`).
4. `POST /meetings/:id/generate-notes` roda DeepSeek (`PROCESSING_AI` -> `COMPLETED`).
5. Em erro de processamento, status final: `FAILED`.

Status suportados:
- `PENDING`
- `UPLOADED`
- `TRANSCRIBING`
- `TRANSCRIBED`
- `PROCESSING_AI`
- `COMPLETED`
- `FAILED`

## Roadmap do MVP

### Concluído
- Base fullstack com frontend e backend separados.
- Persistência MySQL com Prisma.
- Integração Groq + DeepSeek.
- Fluxo fim a fim de processamento.
- Interface institucional com landing, dashboard e gestão de reuniões.

### Próximos passos
1. Fila assíncrona para processamento (ex.: BullMQ/Redis).
2. Armazenamento de mídia em cloud object storage.
3. Autenticação e controle de acesso por organização.
4. Busca semântica e filtros avançados de histórico.
5. Observabilidade (tracing, métricas e auditoria de prompts IA).

## Documentação Complementar

- `docs/architecture.md`
- `docs/api.md`
- `docs/product-scope.md`
