import { initChat, reduceTurnEvent } from './chat';
import { eventsFromTranscript } from './wire';
import { splitPresentingCalls } from './deck';

it('replays the same conversation and accepted job cards as the live stream', () => {
  const events = eventsFromTranscript([
    { seq: 1, role: 'user', content: { text: 'Find a job' } },
    { seq: 2, role: 'assistant', content: { text: 'Try these.', tool_calls: [{ id: 'a', name: 'present_jobs', arguments: JSON.stringify({ jobs: [{ slug: 'accepted', note: 'Good fit' }, { slug: 'rejected' }] }) }] } },
    { seq: 3, role: 'tool', content: { name: 'present_jobs', result: '{"presented":["accepted","accepted"]}' } },
  ]);
  const chat = events.reduce(reduceTurnEvent, initChat());
  expect(chat.messages.map((m) => [m.role, m.text, m.streaming])).toEqual([
    ['user', 'Find a job', false], ['assistant', 'Try these.', false],
  ]);
  expect(splitPresentingCalls(chat.messages[1]!.tools).decks).toEqual([
    { status: 'ready', deck: { heading: undefined, entries: [{ slug: 'accepted', note: 'Good fit', whyFits: [], concerns: [] }] } },
  ]);
});

it('matches repeated tool results in order and surfaces failures before any reply', () => {
  const chat = [
    { type: 'user_prompt' as const, text: 'Search' },
    { type: 'tool_use' as const, name: 'search' },
    { type: 'tool_use' as const, name: 'search' },
    { type: 'tool_result' as const, name: 'search', result: 'first' },
    { type: 'tool_result' as const, name: 'search', result: 'second' },
    { type: 'result' as const, is_error: true },
  ].reduce(reduceTurnEvent, initChat());
  expect(chat.messages[1]?.tools.map((t) => t.result)).toEqual(['first', 'second']);
  expect(chat.messages[1]?.errored).toBe(true);
  const failed = reduceTurnEvent(initChat(), { type: 'result', is_error: true });
  expect(failed.messages[0]?.errored).toBe(true);
});

it('never shows rejected recommendations or endless placeholders from a saved transcript', () => {
  expect(splitPresentingCalls([{ name: 'present_jobs', input: { jobs: [{ slug: 'bad' }] }, result: '{"error":"rejected"}', isError: true }]).decks).toEqual([]);
  expect(splitPresentingCalls([{ name: 'present_jobs' }], false).decks).toEqual([]);
});
