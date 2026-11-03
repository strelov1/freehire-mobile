import { ApiError, request, subscribeUnauthorized } from './transport';

function response(status: number, body = '', contentType = 'application/json', extraHeaders: Record<string, string> = {}) {
  const text = jest.fn().mockResolvedValue(body);
  return {
    response: {
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? contentType : (extraHeaders[name.toLowerCase()] ?? null),
      },
      text,
    } as unknown as Response,
    text,
  };
}

describe('shared transport', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('includes cookies and handles 204 without parsing a body', async () => {
    const empty = response(204);
    global.fetch = jest.fn().mockResolvedValue(empty.response);
    await expect(request('/logout', { method: 'POST', authMode: 'public', expectsBody: false })).resolves.toBeUndefined();
    expect(empty.text).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/logout'), expect.objectContaining({ credentials: 'include' }));
  });

  it('publishes only required-request 401s with their captured epoch', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeUnauthorized(listener);
    global.fetch = jest.fn().mockResolvedValue(response(401, '{"error":"unauthorized"}').response);

    await expect(request('/login', { authMode: 'public', sessionEpoch: 3 })).rejects.toMatchObject({ status: 401 });
    await expect(request('/me', { authMode: 'probe', sessionEpoch: 3 })).rejects.toMatchObject({ status: 401 });
    await expect(request('/saved', { authMode: 'required', sessionEpoch: 3 })).rejects.toMatchObject({ status: 401 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ endpoint: '/saved', sessionEpoch: 3 });
    unsubscribe();
  });

  it('normalizes an HTML gateway failure as server availability', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(503, '<html>down</html>', 'text/html').response);
    await expect(request('/me', { authMode: 'probe' })).rejects.toMatchObject({ kind: 'server', status: 503, retryable: true });
  });

  it('keeps a valid Retry-After value bounded', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      response(429, '{"error":"slow down"}', 'application/json', { 'retry-after': '99999' }).response,
    );
    await expect(request('/login', { authMode: 'public' })).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 3600,
    });
  });

  it('normalizes malformed successful JSON as a protocol failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(200, '{bad').response);
    await expect(request('/me', { authMode: 'probe' })).rejects.toMatchObject({ kind: 'protocol' });
  });

  it('distinguishes caller cancellation from timeout', async () => {
    const caller = new AbortController();
    global.fetch = jest.fn((_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    ) as typeof fetch;
    const pending = request('/me', { authMode: 'probe', signal: caller.signal });
    caller.abort('navigation');
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' });

    jest.useFakeTimers();
    const timed = request('/me', { authMode: 'probe', timeoutMs: 5 });
    jest.advanceTimersByTime(5);
    await expect(timed).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('narrows network failures without reading unknown properties', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(request('/me', { authMode: 'probe' })).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({ kind: 'offline', retryable: true }),
    );
  });
});

describe('streaming response transport', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('returns the unread response for a successful stream and still reports required-auth failures', async () => {
    const streamed = response(200, 'event: result\n\ndata: {}\n\n', 'text/event-stream');
    global.fetch = jest.fn().mockResolvedValue(streamed.response);
    const raw = await request<Response>('/stream', { authMode: 'required', responseType: 'stream' });
    expect(raw).toBe(streamed.response);
    expect(streamed.text).not.toHaveBeenCalled();
    const onUnauthorized = jest.fn();
    const unsubscribe = subscribeUnauthorized(onUnauthorized);
    global.fetch = jest.fn().mockResolvedValue(response(401, '{"error":"Sign in"}').response);
    await expect(request('/stream', { authMode: 'required', sessionEpoch: 7, responseType: 'stream' })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledWith({ endpoint: '/stream', sessionEpoch: 7 });
    unsubscribe();
  });
});

it('keeps a streaming response linked to caller cancellation after headers arrive', async () => {
  const originalFetch = global.fetch;
  const streamed = response(200, '', 'text/event-stream');
  let fetchSignal: AbortSignal | null | undefined;
  global.fetch = jest.fn(async (_url, init) => { fetchSignal = init?.signal; return streamed.response; });
  const controller = new AbortController();
  try {
    await request<Response>('/stream', { authMode: 'required', signal: controller.signal, responseType: 'stream' });
    controller.abort();
    expect(fetchSignal?.aborted).toBe(true);
  } finally { global.fetch = originalFetch; }
});

it('uploads multipart bodies without JSON serialization or overriding their boundary', async () => {
  const originalFetch = global.fetch;
  const form = new FormData();
  form.append('file', 'test audio');
  let sentBody: unknown;
  let sentHeaders: HeadersInit | undefined;
  global.fetch = jest.fn(async (_url, init) => {
    sentBody = init?.body; sentHeaders = init?.headers;
    return response(200, '{"data":{"text":"Spoken words"}}').response;
  });
  try {
    await expect(request('/speech', { authMode: 'required', method: 'POST', body: form })).resolves.toEqual({ data: { text: 'Spoken words' } });
    expect(sentBody).toBe(form);
    expect(sentHeaders).not.toHaveProperty('Content-Type');
  } finally { global.fetch = originalFetch; }
});
