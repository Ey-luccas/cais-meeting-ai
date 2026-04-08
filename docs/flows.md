# Fluxos de Processamento - CAIS Meeting AI

## Fluxo de Criação de Reunião

Objetivo: registrar metadados iniciais da reunião.

1. Frontend envia `POST /meetings` com `title`, `description` e `tags` (opcional).
2. Backend valida os dados.
3. Backend cria registro em `Meeting` com status inicial `PENDING`.
4. Backend retorna objeto completo da reunião (incluindo relações vazias).

Resultado esperado:
- reunião criada e pronta para receber áudio.

## Fluxo de Upload de Áudio

Objetivo: associar mídia à reunião no MVP (storage local).

1. Frontend envia `POST /meetings/:id/upload` com `multipart/form-data` e campo `audio`.
2. Multer valida tipo e tamanho do arquivo.
3. Backend salva o arquivo em `UPLOAD_DIR`.
4. Backend remove transcrição/notas anteriores da mesma reunião (quando houver reupload).
5. Backend atualiza:
   - `audioPath`
   - `status = UPLOADED`
   - `durationSeconds = null`
6. Backend retorna reunião atualizada.

Resultado esperado:
- áudio disponível para transcrição.

## Fluxo de Transcrição

Objetivo: converter áudio em texto estruturado.

1. Frontend envia `POST /meetings/:id/transcribe`.
2. Backend valida existência da reunião e do arquivo.
3. Backend muda status para `TRANSCRIBING`.
4. `audio-processing.service` divide o áudio em chunks (`AUDIO_CHUNK_SECONDS`, padrão `600s`).
5. Cada chunk é transcrito separadamente no Groq (com retry por chunk).
6. Backend ordena por índice do chunk e faz `merge_transcripts`.
7. Serviço Groq retorna transcrição consolidada:
   - `fullText`
   - `language`
   - `durationSeconds`
   - `rawJson`
8. Backend faz `upsert` de `Transcript`.
9. Backend remove `Note` antiga (se existir).
10. Backend atualiza reunião para `TRANSCRIBED`.
11. Em erro, backend define status `FAILED`.

Resultado esperado:
- transcrição persistida e pronta para análise com DeepSeek.

## Fluxo de Geração de Notas

Objetivo: transformar transcrição em saída executiva acionável.

1. Frontend envia `POST /meetings/:id/generate-notes`.
2. Backend valida existência de `Transcript`.
3. Backend muda status para `PROCESSING_AI`.
4. Serviço DeepSeek gera JSON estruturado:
   - `summary`
   - `topics`
   - `decisions`
   - `tasks` (mapeado para `actionItems`)
   - `pending_items` (mapeado para `pendingItems`)
   - `notes` (mapeado para `comments`)
5. Backend faz `upsert` em `Note`.
6. Backend atualiza reunião para `COMPLETED`.
7. Em erro, backend define status `FAILED`.

Resultado esperado:
- reunião finalizada com notas inteligentes persistidas.

## Fluxo Unificado (Atalho)

Endpoint opcional:
- `POST /meetings/:id/process`

Comportamento:
- executa transcrição e geração de notas em sequência no backend.
