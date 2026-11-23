const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
}

/**
 * Every request goes with credentials: 'include' so the httpOnly JWT cookie
 * set by the API's /auth/login is sent automatically — the frontend never
 * touches the token directly.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  // Plain string concatenation, not `new URL(path, API_URL)`: a base like
  // "/api" (the same-origin proxy used on Vercel, see next.config.ts) is
  // relative, and URL() would both reject it and drop its path prefix.
  const params = new URLSearchParams();
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) params.set(key, value);
    }
  }
  const qs = params.toString();
  const url = `${API_URL.replace(/\/$/, "")}${path}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
