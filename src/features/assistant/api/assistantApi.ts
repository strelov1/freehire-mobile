import { request } from '@/lib/transport';
import { readTurn, StreamInterrupted } from '../model/stream';
import type { SessionSummary, StoredMessage, TurnEvent } from '../model/wire';

const BASE = '/api/v1/assistant/sessions';
export type Transcript = { session: SessionSummary; messages: StoredMessage[] };

export function assistantApi(sessionEpoch: number) {
  async function data<T>(path: string, signal: AbortSignal, method = 'GET', body?: unknown) {
    const response = await request<{ data: T }>(path, {
      authMode: 'required', sessionEpoch, signal, method, body, cache: 'no-store',
    });
    return response.data;
  }
  return {
    list: (signal: AbortSignal) => data<SessionSummary[]>(BASE, signal),
    create: (signal: AbortSignal) => data<SessionSummary>(BASE, signal, 'POST', {}),
    delete: (id: string, signal: AbortSignal) => request<void>(`${BASE}/${encodeURIComponent(id)}`, {
      authMode: 'required', sessionEpoch, signal, method: 'DELETE', expectsBody: false,
    }),
    conversation: (id: string) => {
      const path = `${BASE}/${encodeURIComponent(id)}`;
      return {
        get: (signal: AbortSignal) => data<Transcript>(path, signal),
        cancel: (signal: AbortSignal) => request<void>(`${path}/cancel`, {
          authMode: 'required', sessionEpoch, signal, method: 'POST', expectsBody: false,
        }),
        send: async (text: string, onEvent: (event: TurnEvent) => void, signal: AbortSignal) => {
          const response = await request<Response>(`${path}/messages`, {
            authMode: 'required', sessionEpoch, signal, method: 'POST', body: { text },
            headers: { Accept: 'text/event-stream' }, responseType: 'stream', timeoutMs: 30_000,
          });
          if (!response.body) throw new StreamInterrupted();
          try { await readTurn(response.body, onEvent); }
          catch (error) {
            if (signal.aborted) throw error;
            throw new StreamInterrupted();
          }
        },
      };
    },
  };
}
