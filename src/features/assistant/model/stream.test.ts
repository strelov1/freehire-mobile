import { readTurn } from './stream';
import type { TurnEvent } from './wire';

function body(parts: string[]) {
  let index = 0;
  const releaseLock = jest.fn();
  return { getReader: () => ({
    read: async () => index < parts.length ? { done: false, value: parts[index++] } : { done: true },
    releaseLock,
  }) } as unknown as ReadableStream<Uint8Array>;
}

// Hermes provides TextDecoder; Jest's node environment does not always install it.
jest.mock('./decoder', () => ({ makeDecoder: () => ({ decode: (value?: string) => value ?? '' }) }));

it('reads fragmented CRLF frames, ignores keepalives and malformed data, and requires a terminal result', async () => {
  const events: TurnEvent[] = [];
  await readTurn(body([': ping\r\n\r\nevent: assistant_text\r\ndata: {"type":"assistant_', 'text","text":"Hello"}\r\n\r\ndata: nope\n\ndata: {"type":"result"}\n\n']), (e) => events.push(e));
  expect(events).toEqual([{ type: 'assistant_text', text: 'Hello' }, { type: 'result' }]);
});

it('reports a truncated stream so callers recover history instead of resending a prompt', async () => {
  await expect(readTurn(body(['data: {"type":"assistant_text","text":"Partial"}\n\n']), () => {})).rejects.toThrow('interrupted');
});
