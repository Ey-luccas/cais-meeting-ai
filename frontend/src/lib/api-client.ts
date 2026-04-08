const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 45_000;

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | null;
  timeoutMs?: number;
};

type ApiErrorPayload = {
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const tryParseJson = async <T>(response: Response): Promise<T | null> => {
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const parseApiError = async (response: Response): Promise<ApiError> => {
  const payload = await tryParseJson<ApiErrorPayload>(response);

  return new ApiError(
    payload?.message ?? 'Erro ao processar requisição.',
    response.status,
    payload?.details
  );
};

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, init?: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        cache: 'no-store',
        signal: controller.signal
      });

      if (!response.ok) {
        throw await parseApiError(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const payload = await tryParseJson<T>(response);
      if (payload === null) {
        throw new ApiError('Resposta da API em formato inesperado.', response.status);
      }

      return payload;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('Tempo limite excedido ao comunicar com a API.', 408);
      }

      throw new ApiError('Não foi possível conectar ao backend.', 503);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
