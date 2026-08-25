export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * The FastAPI backend wraps every `/api/v1` response in this envelope. `meta`
 * carries pagination info for list endpoints, or is empty for single-item
 * endpoints like `/health`.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta: Record<string, never>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiListEnvelope<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

/** A non-2xx HTTP response from the API (the server responded, just not with success). */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** `fetch` itself failed — the API is unreachable (server down, no network, CORS block, etc). */
export class NetworkError extends Error {
  constructor(message: string = "Unable to reach the API server") {
    super(message);
    this.name = "NetworkError";
  }
}

/**
 * A single place to turn a caught error into UI copy, so every form shows
 * the same friendly wording instead of raw backend/network text. A 403
 * always means the same thing to a user regardless of which action tripped
 * it, so it gets one consistent message rather than whatever string the
 * backend happened to send.
 */
export function getErrorMessage(
  err: unknown,
  fallback: string = "Unable to reach the API server. Please try again."
): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return "You don't have permission to do this. Ask an admin if you think this is a mistake.";
    }
    return err.message;
  }
  if (err instanceof NetworkError) {
    return err.message;
  }
  return fallback;
}
