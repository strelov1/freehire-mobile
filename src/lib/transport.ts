import { apiBase } from './config';

export type AuthMode = 'public' | 'probe' | 'required';
export type ApiErrorKind = 'http' | 'offline' | 'timeout' | 'aborted' | 'server' | 'protocol';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly endpoint: string;
  readonly retryable: boolean;
  readonly serverError?: string;
  readonly retryAfterSeconds?: number;

  constructor(input: {
    kind: ApiErrorKind;
    endpoint: string;
    status?: number;
    code?: string;
    retryable?: boolean;
    serverError?: string;
    retryAfterSeconds?: number;
    cause?: unknown;
  }) {
    super(input.serverError ?? (input.status ? `HTTP ${input.status}` : input.kind), { cause: input.cause });
    this.name = 'ApiError';
    this.kind = input.kind;
    this.status = input.status;
    this.code = input.code;
    this.endpoint = input.endpoint;
    this.retryable = input.retryable ?? false;
    this.serverError = input.serverError;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export type UnauthorizedEvent = { sessionEpoch: number; endpoint: string };
type UnauthorizedListener = (event: UnauthorizedEvent) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function subscribeUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/**
 * The epoch a request is stamped with when its caller does not pass one. Callers
 * that thread the epoch explicitly still win; this only stops a required-auth
 * request from silently skipping the unauthorized signal, which used to leave an
 * expired session looking signed in with no data behind it.
 */
let ambientSessionEpoch = 0;

export function setAmbientSessionEpoch(epoch: number) {
  ambientSessionEpoch = epoch;
}

function publishUnauthorized(event: UnauthorizedEvent) {
  for (const listener of unauthorizedListeners) {
    try {
      listener(event);
    } catch {
      // isolate listener errors from network caller
    }
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  authMode: AuthMode;
  sessionEpoch?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  expectsBody?: boolean;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

function parseBackendError(value: unknown): { code?: string; message?: string } {
  if (!value || typeof value !== 'object') return {};
  const body = value as Record<string, unknown>;
  const nested = body.error;
  if (typeof nested === 'string') {
    return { code: typeof body.code === 'string' ? body.code : undefined, message: nested };
  }
  if (nested && typeof nested === 'object') {
    const error = nested as Record<string, unknown>;
    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message: typeof error.message === 'string' ? error.message : undefined,
    };
  }
  return {
    code: typeof body.code === 'string' ? body.code : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 3600);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(Math.ceil((date - Date.now()) / 1000), 0), 3600);
}

function composedSignal(caller: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let source: 'caller' | 'timeout' | undefined;
  const onCallerAbort = () => {
    if (source) return;
    source = 'caller';
    controller.abort(caller?.reason);
  };
  if (caller?.aborted) onCallerAbort();
  else caller?.addEventListener('abort', onCallerAbort, { once: true });

  const timeout = setTimeout(() => {
    if (source) return;
    source = 'timeout';
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    abortSource: () => source,
    cleanup: () => {
      clearTimeout(timeout);
      caller?.removeEventListener('abort', onCallerAbort);
    },
  };
}

/** Shared fetch boundary. It normalizes failures but never mutates session state. */
export async function request<T>(path: string, options: RequestOptions): Promise<T> {
  let serializedBody: string | undefined;
  if (options.body !== undefined) {
    try {
      serializedBody = JSON.stringify(options.body);
    } catch (cause) {
      throw new ApiError({ kind: 'protocol', endpoint: path, cause });
    }
  }

  const timeout = composedSignal(options.signal, options.timeoutMs ?? 15_000);
  try {
    let response: Response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        cache: options.cache,
        signal: timeout.signal,
        body: serializedBody,
        headers: {
          Accept: 'application/json',
          ...(serializedBody === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
      });
    } catch (cause) {
      const abortSource = timeout.abortSource();
      if (abortSource === 'timeout') {
        throw new ApiError({ kind: 'timeout', endpoint: path, retryable: true, cause });
      }
      if (abortSource === 'caller') {
        throw new ApiError({ kind: 'aborted', endpoint: path, cause });
      }
      throw new ApiError({ kind: 'offline', endpoint: path, retryable: true, cause });
    }

    const bodyless = response.status === 204 || response.status === 205 || options.expectsBody === false;
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    let payload: unknown;
    if (!bodyless) {
      try {
        const text = await response.text();
        if (text) {
          if (!contentType.includes('application/json') && !contentType.includes('+json')) {
            if (response.ok) {
              throw new ApiError({ kind: 'protocol', endpoint: path, status: response.status });
            }
          } else {
            try {
              payload = JSON.parse(text);
            } catch (cause) {
              throw new ApiError({
                kind: response.ok ? 'protocol' : response.status >= 500 ? 'server' : 'http',
                endpoint: path,
                status: response.status,
                retryable: response.status >= 500,
                cause,
              });
            }
          }
        }
      } catch (cause) {
        if (cause instanceof ApiError) throw cause;
        const abortSource = timeout.abortSource();
        if (abortSource === 'timeout') {
          throw new ApiError({ kind: 'timeout', endpoint: path, status: response.status, retryable: true, cause });
        }
        if (abortSource === 'caller') {
          throw new ApiError({ kind: 'aborted', endpoint: path, status: response.status, cause });
        }
        throw new ApiError({
          kind: response.ok ? 'protocol' : response.status >= 500 ? 'server' : 'http',
          endpoint: path,
          status: response.status,
          retryable: response.status >= 500,
          cause,
        });
      }
    }

    if (!response.ok) {
      const backend = parseBackendError(payload);
      const error = new ApiError({
        kind: response.status >= 500 ? 'server' : 'http',
        endpoint: path,
        status: response.status,
        code: backend.code,
        serverError: backend.message,
        retryAfterSeconds: response.status === 429 ? parseRetryAfter(response.headers.get('retry-after')) : undefined,
        retryable: response.status === 429 || response.status >= 500,
      });
      if (response.status === 401 && options.authMode === 'required') {
        publishUnauthorized({ endpoint: path, sessionEpoch: options.sessionEpoch ?? ambientSessionEpoch });
      }
      throw error;
    }

    if (bodyless) return undefined as T;
    if (payload === undefined) {
      throw new ApiError({ kind: 'protocol', endpoint: path, status: response.status });
    }
    return payload as T;
  } finally {
    timeout.cleanup();
  }
}
