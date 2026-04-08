# Integrações Externas - CAIS Meeting AI

## Groq API

Objetivo:
- converter áudio de reunião em transcrição textual.

Serviço:
- `backend/src/services/groq.service.ts`
- `backend/src/services/audio-processing.service.ts`

Comportamento:
1. valida presença de `GROQ_API_KEY`.
2. valida existência do arquivo no storage local.
3. usa `ffmpeg` para dividir o áudio em chunks (padrão: `600s`).
4. garante chunk abaixo de `GROQ_MAX_CHUNK_MB` com resplit automático quando necessário.
5. envia cada chunk para `groq.audio.transcriptions.create`.
6. tenta `response_format: verbose_json` na primeira tentativa.
7. se o modelo/endpoint não aceitar `verbose_json`, faz fallback sem esse parâmetro.
8. faz retry por chunk (`GROQ_CHUNK_RETRY_ATTEMPTS`).
9. concatena transcrições em ordem para gerar transcrição final.
10. retorna:
   - `fullText`
   - `language`
   - `durationSeconds`
   - `rawJson`

Erros esperados:
- chave ausente -> erro de configuração (`500`).
- arquivo ausente -> erro de validação (`400`).
- ffmpeg/ffprobe ausentes -> erro de configuração (`500`).
- falha de integração -> erro de gateway (`502`).
- resposta vazia -> erro de integração (`502`).

## DeepSeek API

Objetivo:
- transformar transcrição em notas executivas estruturadas.

Serviço:
- `backend/src/services/deepseek.service.ts`

Comportamento:
1. valida presença de `DEEPSEEK_API_KEY`.
2. usa modelo configurado por `DEEPSEEK_MODEL`.
3. envia prompt técnico para retorno em JSON.
4. define schema de validação para:
   - `summary`
   - `topics`
   - `decisions`
   - `actionItems`
   - `pendingItems`
   - `comments`
5. executa validação final com `zod`.
6. retorna payload pronto para persistência.

Erros esperados:
- chave ausente -> erro de configuração (`500`).
- transcrição vazia -> erro de validação (`400`).
- limite de quota/rate limit -> erro (`429`).
- falha na API -> erro de gateway (`502`).
- JSON inválido/incompleto -> erro de integração (`502`).

## Variáveis de Ambiente

Integrações IA:
- `GROQ_API_KEY`
- `GROQ_STT_MODEL` (default: `whisper-large-v3`)
- `GROQ_MAX_CHUNK_MB` (default: `25`)
- `AUDIO_CHUNK_SECONDS` (default: `600`)
- `AUDIO_MIN_CHUNK_SECONDS` (default: `60`)
- `GROQ_CHUNK_RETRY_ATTEMPTS` (default: `2`)
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL` (default: `deepseek-chat`)
- `DEEPSEEK_BASE_URL` (default: `https://api.deepseek.com`)
- `FFMPEG_BIN` (default: `ffmpeg`)
- `FFPROBE_BIN` (default: `ffprobe`)

Suporte operacional:
- `UPLOAD_DIR`
- `MAX_FILE_SIZE_MB`
- `DATABASE_URL`
- `PORT`
- `NODE_ENV`
- `CORS_ORIGIN`

Frontend:
- `NEXT_PUBLIC_API_URL`

## Comportamento Esperado dos Serviços

### Em cenário nominal

- Upload de áudio finaliza em `UPLOADED`.
- Transcrição finaliza em `TRANSCRIBED`.
- Geração de notas finaliza em `COMPLETED`.
- Dados persistem com consistência em `Meeting`, `Transcript` e `Note`.

### Em cenário de falha

- Backend atualiza reunião para `FAILED`.
- API retorna erro padronizado com mensagem clara.
- Frontend exibe feedback de erro e permite nova tentativa.

### Idempotência funcional (MVP)

- Reupload de áudio limpa transcrição/nota antigas da reunião.
- Transcrição usa `upsert` em `Transcript`.
- Notas usam `upsert` em `Note`.
