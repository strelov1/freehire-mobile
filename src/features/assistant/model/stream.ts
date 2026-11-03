import { makeDecoder } from './decoder';
import type { TurnEvent } from './wire';

export class StreamInterrupted extends Error {
  constructor() { super('The connection was interrupted. Your assistant may still be working.'); }
}

function decodeEvent(data: string): TurnEvent | null {
  try {
    const event: unknown = JSON.parse(data);
    if (!event || typeof event !== 'object' || !('type' in event)) return null;
    const value = event as Record<string, unknown>;
    switch (value.type) {
      case 'queued': case 'usage': case 'result':
        return value as TurnEvent;
      case 'user_prompt': case 'assistant_text': case 'assistant_thought':
        return typeof value.text === 'string' ? value as TurnEvent : null;
      case 'tool_use': case 'tool_result':
        return typeof value.name === 'string' ? value as TurnEvent : null;
      default: return null;
    }
  } catch { return null; }
}

/** Reads named SSE data across network and UTF-8 chunk boundaries. */
export async function readTurn(body: ReadableStream<Uint8Array>, onEvent: (event: TurnEvent) => void) {
  const reader = body.getReader();
  const decoder = makeDecoder();
  let buffer = '';
  let ended = false;
  try {
    while (!ended) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Normalize only complete CRLF pairs: a CR and LF may arrive separately.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block.split('\n').filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, '')).join('\n');
        const event = decodeEvent(data);
        if (!event) continue;
        onEvent(event);
        if (event.type === 'result') { ended = true; break; }
      }
    }
    if (!ended) throw new StreamInterrupted();
  } finally {
    reader.releaseLock();
  }
}
