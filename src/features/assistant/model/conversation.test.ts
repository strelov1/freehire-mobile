import { Conversation, type ConversationApi } from './conversation';
import { StreamInterrupted } from './stream';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup(overrides: Partial<ConversationApi> = {}) {
  const api: ConversationApi = {
    get: async () => ({ session: { id: 'chat', preset: 'chat', label: '' }, messages: [] }),
    send: async (_text, onEvent) => { onEvent({ type: 'user_prompt', text: 'Hello' }); onEvent({ type: 'assistant_text', text: 'Hi' }); onEvent({ type: 'result' }); },
    cancel: async () => {},
    ...overrides,
  };
  return new Conversation(api);
}

it('retains the draft on a refused send and prevents double submissions', async () => {
  const sent = deferred<void>();
  const chat = setup({ send: async (_text, onEvent) => { onEvent({ type: 'user_prompt', text: 'Hello' }); await sent.promise; } });
  await chat.load();
  chat.setDraft('Hello');
  const pending = chat.send();
  await chat.send();
  expect(chat.getSnapshot().phase).toBe('sending');
  sent.resolve();
  await pending;
  expect(chat.getSnapshot().draft).toBe('');
  const refused = setup({ send: async () => { throw new Error('Daily limit reached'); } });
  await refused.load();
  refused.setDraft('Keep this');
  await refused.send();
  expect(refused.getSnapshot()).toMatchObject({ draft: 'Keep this', error: 'Daily limit reached', phase: 'ready' });
});

it('detaches on background without cancelling server work and reloads saved messages on return', async () => {
  let cancelled = false;
  const sent = deferred<void>();
  const chat = setup({
    send: async () => sent.promise,
    cancel: async () => { cancelled = true; },
    get: async () => ({ session: { id: 'chat', preset: 'chat', label: '' }, messages: [{ seq: 1, role: 'assistant', content: { text: 'Saved reply' } }] }),
  });
  await chat.load();
  chat.setDraft('Hello');
  const pending = chat.send();
  chat.detach();
  await chat.load();
  sent.resolve();
  await pending;
  expect(cancelled).toBe(false);
  expect(chat.getSnapshot().chat.messages[0]?.text).toBe('Saved reply');
});

it('keeps partial responses on interruption and never resends automatically', async () => {
  const chat = setup({ send: async (_text, onEvent) => {
    onEvent({ type: 'user_prompt', text: 'Hello' });
    onEvent({ type: 'assistant_text', text: 'Partial' });
    throw new StreamInterrupted();
  } });
  await chat.load();
  chat.setDraft('Hello');
  await chat.send();
  expect(chat.getSnapshot()).toMatchObject({ phase: 'recovering', draft: '' });
  expect(chat.getSnapshot().chat.messages[1]?.text).toBe('Partial');
});

it('only explicit stop cancels server generation and reports cancellation failures', async () => {
  let cancelled = false;
  const chat = setup({ cancel: async () => { cancelled = true; throw new Error('Offline'); } });
  await chat.load();
  await chat.stop();
  expect(cancelled).toBe(true);
  expect(chat.getSnapshot().error).toContain('Offline');
});

it('keeps reading after Stop is acknowledged until the server emits the terminal result', async () => {
  const finish = deferred<void>();
  const chat = setup({ send: async (_text, onEvent) => {
    onEvent({ type: 'user_prompt', text: 'Hello' });
    onEvent({ type: 'assistant_text', text: 'Partial' });
    await finish.promise;
    onEvent({ type: 'assistant_text', text: ' reply' });
    onEvent({ type: 'result', stop_reason: 'cancelled' });
  } });
  await chat.load();
  chat.setDraft('Hello');
  const pending = chat.send();
  await chat.stop();
  expect(chat.getSnapshot().phase).toBe('sending');
  expect(chat.getSnapshot().chat.messages[1]?.streaming).toBe(true);
  finish.resolve();
  await pending;
  expect(chat.getSnapshot()).toMatchObject({ phase: 'ready', stopRequested: false });
  expect(chat.getSnapshot().chat.messages[1]?.text).toBe('Partial reply');
});

it('retains uncertainty when reopening a previously interrupted session or stopping without a reader', async () => {
  const api: ConversationApi = {
    get: async () => ({ session: { id: 'chat', preset: 'chat', label: '' }, messages: [] }),
    send: async () => {}, cancel: async () => {},
  };
  const chat = new Conversation(api, { initial: true, changed: () => {} });
  await chat.load();
  expect(chat.getSnapshot().phase).toBe('recovering');
  await chat.stop();
  expect(chat.getSnapshot()).toMatchObject({ phase: 'recovering', stopRequested: true });
});

it('does not erase previous recovery when a new message is refused before it starts', async () => {
  const changed: boolean[] = [];
  const chat = new Conversation({
    get: async () => ({ session: { id: 'chat', preset: 'chat', label: '' }, messages: [] }),
    send: async () => { throw new Error('Limit reached'); },
    cancel: async () => {},
  }, { initial: true, changed: (value) => changed.push(value) });
  await chat.load();
  chat.setDraft('Follow up');
  await chat.send();
  expect(chat.getSnapshot()).toMatchObject({ phase: 'recovering', draft: 'Follow up' });
  expect(changed).not.toContain(false);
});

it('keeps a confirmed finished turn ready when its cancellation acknowledgement arrives late', async () => {
  const finish = deferred<void>();
  const cancelled = deferred<void>();
  const chat = setup({
    send: async (_text, onEvent) => {
      onEvent({ type: 'user_prompt', text: 'Hello' });
      await finish.promise;
      onEvent({ type: 'assistant_text', text: 'Finished' });
      onEvent({ type: 'result' });
    },
    cancel: async () => cancelled.promise,
  });
  await chat.load(); chat.setDraft('Hello');
  const sending = chat.send();
  const stopping = chat.stop();
  finish.resolve(); await sending;
  cancelled.resolve(); await stopping;
  expect(chat.getSnapshot()).toMatchObject({ phase: 'ready', stopRequested: false });
});
