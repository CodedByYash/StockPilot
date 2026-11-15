export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

// Read lazily inside apiFetch rather than captured as module-level
// constants. Capturing at import time makes correctness depend on import
// order (dotenv/config must run before this module is first imported,
// anywhere in the chain) — fragile, and it genuinely broke the verify
// script below on the first run. Reading at call time removes that
// ordering hazard entirely.
function getBaseUrl(): string {
  const value = process.env.API_BASE_URL;
  if (!value) throw new Error('API_BASE_URL is not set. Copy .env.example to .env and fill it in.');
  return value;
}

function getToken(): string {
  const value = process.env.MCP_SERVICE_TOKEN;
  if (!value) {
    throw new Error(
      'MCP_SERVICE_TOKEN is not set. Run `npm run create-service-account` in ../api and put the printed token in .env.'
    );
  }
  return value;
}

function buildUrl(path: string, query?: ApiFetchOptions['query']): string {
  const url = new URL(path, getBaseUrl());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/**
 * Every MCP tool calls the real inventory API through this one function —
 * same shape as web/lib/api.ts on the frontend, except authenticated with
 * a Bearer token (this process has no cookie jar) instead of a session
 * cookie. See api/src/middleware/auth.ts for the server-side half of this.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorObj = data as { error?: unknown };
    const message = typeof errorObj.error === 'string' ? errorObj.error : `API request failed with ${res.status}`;
    throw new ApiClientError(res.status, message);
  }

  return data as T;
}
