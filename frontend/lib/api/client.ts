import { ApiError, NetworkError, type PaginatedResponse, type PaginationParams } from "./types";

/**
 * Base URL for the FastAPI backend, versioned under /api/v1 to match
 * `backend/app/core/config.py`'s `API_V1_PREFIX`. Override via
 * `NEXT_PUBLIC_API_BASE_URL` in `.env.local` once the backend is deployed
 * somewhere other than the local default.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

/** Plain (non-httpOnly) cookie holding the JWT, so client components can
 * both read it (to attach `Authorization: Bearer`) and Proxy can presence-
 * check it. Kept here — not in `auth.ts` — so any module can reference the
 * name without pulling in `next/headers`. */
export const AUTH_COOKIE_NAME = "topten_auth_token";

function readBrowserCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolves the caller's auth token for both runtimes: `document.cookie` in
 * the browser, `next/headers`'s `cookies()` on the server. The server branch
 * uses a dynamic `import()` so this module — imported by both Server and
 * Client Components — never statically pulls `next/headers` into the
 * client bundle.
 */
export async function getAuthorizationHeader(): Promise<Record<string, string>> {
  if (typeof window !== "undefined") {
    const token = readBrowserCookie(AUTH_COOKIE_NAME);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const token = store.get(AUTH_COOKIE_NAME)?.value;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

const DEFAULT_MOCK_DELAY_MS = 300;

/**
 * Simulates the network latency of a real request. Every mock-backed
 * resource function awaits this before returning, so loading states built
 * against these functions keep behaving the same way once a resource swaps
 * its mock implementation for a real `apiFetch` call.
 */
export function simulateNetworkDelay(ms: number = DEFAULT_MOCK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Recursively converts snake_case object keys to camelCase. A default
 * FastAPI/Pydantic model serializes to snake_case, while every type in this
 * codebase is camelCase — this keeps that contract realistic without
 * requiring the backend to adopt a camelCase alias generator.
 */
export function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(camelizeKeys);
  }

  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase()),
        camelizeKeys(entryValue),
      ])
    );
  }

  return value;
}

export function buildQueryString(
  params: Record<string, string | number | boolean | undefined>
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : "";
}

/**
 * Typed wrapper around `fetch` for the FastAPI backend. Distinguishes a
 * reachable-but-erroring API (`ApiError`, non-2xx response) from an
 * unreachable one (`NetworkError`, `fetch` itself threw). Resource modules
 * (e.g. `lib/api/customers.ts`) call this directly rather than using raw
 * `fetch`, and unwrap the `{ success, data, meta }` envelope themselves since
 * its `data`/`meta` shape differs per endpoint.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    const authHeader = await getAuthorizationHeader();
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = body || response.statusText;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      message = parsed.detail ?? message;
    } catch {
      // Response body wasn't JSON — fall back to the raw text/status above.
    }
    throw new ApiError(message, response.status);
  }

  // A 204 (e.g. DELETE) has no body — `.json()` would throw on it.
  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json();
  return camelizeKeys(data) as T;
}

function requestWithBody<T>(
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return requestWithBody<T>("POST", path, body, init);
}

export function apiPatch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return requestWithBody<T>("PATCH", path, body, init);
}

export function apiPut<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return requestWithBody<T>("PUT", path, body, init);
}

export function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: "DELETE" });
}

/**
 * Slices an in-memory array into the `{ items, total, page, pageSize }` shape
 * a real FastAPI list endpoint would return. When `pageSize` is omitted, the
 * full array is returned as a single page — matching how every list page in
 * this app consumes its mock-backed `list*` function today (see e.g.
 * `app/dashboard/customers/page.tsx`) — while still supporting real
 * pagination once a caller passes `page`/`pageSize` explicitly.
 */
export function paginate<T>(
  items: readonly T[],
  { page = 1, pageSize }: PaginationParams = {}
): PaginatedResponse<T> {
  const total = items.length;
  const effectivePageSize = pageSize ?? total;
  const start = (page - 1) * effectivePageSize;
  const end = effectivePageSize > 0 ? start + effectivePageSize : total;

  return {
    items: items.slice(start, end),
    total,
    page,
    pageSize: effectivePageSize,
  };
}
