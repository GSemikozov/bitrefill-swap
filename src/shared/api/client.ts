import type { z } from 'zod';

export type ApiErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'SCHEMA_MISMATCH'
  | `HTTP_${number}`;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: ApiErrorCode,
    options?: { status?: number; details?: unknown }
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

interface ApiRequestOptions<T> {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  /** Every external response is validated here — a mismatch surfaces as a typed error. */
  schema: z.ZodType<T>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

async function readJson(response: Response, url: string): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(`Invalid JSON from ${url}`, 'PARSE_ERROR', {
      status: response.status,
      details: text.slice(0, 200),
    });
  }
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of ['message', 'detail', 'error', 'errorCode']) {
    if (typeof record[key] === 'string') return record[key];
  }
  return undefined;
}

function toApiError(error: unknown, url: string): ApiError {
  if (error instanceof ApiError) return error;
  if (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return new ApiError(`Request to ${url} timed out`, 'TIMEOUT');
  }
  if (error instanceof TypeError) {
    return new ApiError(`Network error calling ${url}`, 'NETWORK_ERROR', {
      details: error.message,
    });
  }
  return new ApiError(
    error instanceof Error ? error.message : 'Unknown request error',
    'NETWORK_ERROR',
    { details: error }
  );
}

export async function apiRequest<T>(url: string, options: ApiRequestOptions<T>): Promise<T> {
  const { method = 'GET', headers, body, schema, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    payload = await readJson(response, url);
  } catch (error) {
    throw toApiError(error, url);
  }

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload) ?? `Request failed with status ${response.status}`,
      `HTTP_${response.status}`,
      { status: response.status, details: payload }
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(`Unexpected response shape from ${url}`, 'SCHEMA_MISMATCH', {
      status: response.status,
      details: parsed.error.issues,
    });
  }
  return parsed.data;
}
