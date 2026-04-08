# API Inicial - CAIS Meeting AI

Base URL local: `http://localhost:4000/api/v1`

## Health

### `GET /health`

Retorna status da API.

## Meetings

### `POST /meetings`

Cria uma reunião e inicia processamento de transcrição + análise.

- Content-Type: `multipart/form-data`
- Campos:
  - `title` (string, obrigatório)
  - `description` (string, opcional)
  - `audio` (file, obrigatório)

Resposta: `201` com objeto completo da reunião.

### `GET /meetings`

Lista reuniões recentes.

- Query opcional:
  - `take` (number, max 100)

Resposta: `200`

```json
{
  "meetings": []
}
```

### `GET /meetings/:id`

Obtém detalhe completo de uma reunião.

Resposta: `200` com objeto da reunião.

### `PATCH /meetings/:id`

Atualiza metadados básicos da reunião.

Body JSON:

```json
{
  "title": "Novo título",
  "description": "Novo contexto"
}
```

Campos são opcionais, mas ao menos um deve ser enviado.

Resposta: `200` com objeto atualizado da reunião.

### `DELETE /meetings/:id`

Exclui reunião, análise, segmentos e tenta remover o arquivo local de áudio.

Resposta: `204`.

## Formato do objeto `Meeting`

Campos principais:

- `id`, `title`, `description`, `status`
- `audioOriginalName`, `audioUrl`
- `language`, `durationSeconds`
- `transcript`, `segments[]`
- `analysis`:
  - `summary`
  - `topics[]`
  - `decisions[]`
  - `tasks[]`
  - `pendingItems[]`
  - `comments[]`
