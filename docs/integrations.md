# Integrações de IA - CAIS Meeting AI

## 1) Visão Geral

O produto possui duas integrações de IA no fluxo principal:
- **Groq** para speech-to-text (transcrição de áudio)
- **DeepSeek** para análise estruturada de reuniões

Objetivo: converter reunião bruta em contexto executável no projeto.

## 2) Groq - Transcrição

### 2.1 Papel na arquitetura

A integração Groq é o provider padrão de transcrição quando `TRANSCRIPTION_ENGINE=GROQ`.

Serviços envolvidos:
- `audio-processing.service.ts` (FFmpeg, chunking)
- `groq-transcription.service.ts` (transcrição por chunk)
- `transcript-merge.service.ts` (merge consolidado)
- `transcription-router.service.ts` (roteamento de engine)

### 2.2 Pipeline de chunks

Regras principais:
- target de chunk: ~9 minutos
- limite por chunk: 25MB
- redução progressiva do tamanho de segmento quando chunk estoura limite
- transcrição em ordem de chunk
- retry por chunk em falha transitória
- limpeza de temporários ao final

Saída consolidada:
- `text` completo com marcadores `[HH:MM:SS]`
- `segments` normalizados
- `language` por votação de chunks
- `durationSeconds`
- `raw` com metadados do merge

### 2.3 Reprocessamento

O serviço suporta reprocessamento unitário de chunk para cenários de falha parcial (`reprocessChunk`).

## 3) DeepSeek - Análise de Reunião

### 3.1 Papel na arquitetura

Após transcrição consolidada, DeepSeek transforma o conteúdo em JSON estruturado para execução.

Serviço:
- `deepseek-meeting-analysis.service.ts`

### 3.2 Contrato de saída

Campos gerados:
- `summary`
- `topics[]`
- `decisions[]`
- `actionItems[]`
  - `title`
  - `description`
  - `assignees[]`
  - `dueDate`
  - `priority` (`low|medium|high|urgent`)
- `pendingItems[]`
- `comments[]`
- `report`

### 3.3 Qualidade de parse e robustez

Medidas aplicadas:
- API compatível com OpenAI via endpoint `/chat/completions`
- limpeza de blocos markdown quando presentes
- fallback de extração do primeiro objeto JSON válido
- validação de schema com `zod`
- tratamento explícito de erro de API e erro de parse

### 3.4 Contexto adicional de observações

Observações manuais da reunião (`MeetingObservation`) são incluídas no prompt para enriquecer:
- decisões
- tarefas
- pendências
- relatório final orientado à execução

## 4) Geração Automática de Cards (pós-análise)

Serviço:
- `ai-card-generator.service.ts`

Entrada:
- `actionItems` retornados pelo DeepSeek

Saída operacional:
- criação de cards na coluna **A Fazer**
- `sourceType = AI`
- vínculo `meetingId`
- inferência de prioridade e prazo
- tentativa de match de responsáveis por nome/e-mail
- deduplicação de itens semelhantes na mesma reunião
- checklist sugerido para tarefas amplas

## 5) Variáveis de Ambiente

### Transcrição
- `TRANSCRIPTION_ENGINE` (`GROQ` | `LOCAL_FALLBACK`)
- `GROQ_API_KEY`
- `GROQ_STT_MODEL`

### Análise
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`

### Infra de API
- `DATABASE_URL`
- `JWT_SECRET`
- `AUTH_COOKIE_NAME`
- `CORS_ORIGIN`
- `UPLOAD_DIR`

## 6) Tratamento de Falhas

### Falhas de Groq/FFmpeg
- chunk inválido, arquivo ausente, erro de integração ou limite
- atualização de status da reunião para `FAILED` em erro irreversível

### Falhas de DeepSeek
- resposta vazia, JSON inválido, schema inválido ou erro de API
- atualização de status da reunião para `FAILED`

### Resiliência funcional
- reupload de áudio permite reprocessar reunião
- pipeline foi desenhado para evolução futura com fila assíncrona

## 7) Observação de Compatibilidade

O fluxo principal de produção inicial está padronizado em **Groq + DeepSeek**.
