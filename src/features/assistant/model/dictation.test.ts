import { Dictation, appendTranscript, type DictationDependencies } from './dictation';
import { ApiError } from '@/lib/transport';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup(overrides: Partial<DictationDependencies> = {}) {
  const transcripts: string[] = [];
  const removed: string[] = [];
  let stopped = 0;
  const dictation = new Dictation({
    start: async () => {}, stop: async () => { stopped++; return 'file:///voice.mp4'; },
    transcribe: async () => 'new words', remove: (uri) => removed.push(uri),
    onTranscript: (text) => transcripts.push(text), ...overrides,
  });
  return { dictation, transcripts, removed, stopped: () => stopped };
}

afterEach(() => jest.useRealTimers());

it('adds transcription to the existing draft without sending or replacing typed text', async () => {
  const { dictation, transcripts, removed } = setup();
  await dictation.start();
  expect(dictation.getSnapshot().phase).toBe('recording');
  await dictation.finish();
  expect(appendTranscript('Typed first', transcripts[0] ?? '')).toBe('Typed first new words');
  expect(appendTranscript('Typed first ', '  ')).toBe('Typed first ');
  expect(removed).toEqual(['file:///voice.mp4']);
  expect(dictation.getSnapshot().phase).toBe('idle');
});

it('discards capture when cancelled, without transcription', async () => {
  let uploaded = false;
  const { dictation, removed, stopped } = setup({ transcribe: async () => { uploaded = true; return 'unused'; } });
  await dictation.start();
  await dictation.cancel();
  expect(uploaded).toBe(false);
  expect(stopped()).toBe(1);
  expect(removed).toEqual(['file:///voice.mp4']);
});

it('stops a capture that starts after the screen has left or permission dialog returns late', async () => {
  const permission = deferred<void>();
  const { dictation, transcripts, stopped } = setup({ start: async () => permission.promise });
  const start = dictation.start();
  await dictation.cancel();
  permission.resolve();
  await start;
  expect(stopped()).toBe(1);
  expect(transcripts).toEqual([]);
  expect(dictation.getSnapshot().phase).toBe('idle');
});

it('ignores a late transcription after backgrounding or an account change and removes its recording', async () => {
  const response = deferred<string>();
  const { dictation, transcripts, removed } = setup({ transcribe: async () => response.promise });
  await dictation.start();
  const finish = dictation.finish();
  await Promise.resolve(); await Promise.resolve();
  await dictation.cancel();
  response.resolve('Old account words');
  await finish;
  expect(transcripts).toEqual([]);
  expect(removed).toContain('file:///voice.mp4');
});

it('automatically finishes at the recording limit', async () => {
  jest.useFakeTimers();
  const { dictation, transcripts } = setup();
  await dictation.start();
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(transcripts).toEqual(['new words']);
  expect(dictation.getSnapshot().phase).toBe('idle');
});

it('surfaces permission failure and removes the microphone when speech is unavailable', async () => {
  const denied = setup({ start: async () => { throw new Error('Microphone permission denied'); } }).dictation;
  await denied.start();
  expect(denied.getSnapshot()).toMatchObject({ phase: 'idle', error: 'Microphone permission denied' });
  const { dictation, removed } = setup({ transcribe: async () => { throw new ApiError({ kind: 'http', status: 501, endpoint: '/speech' }); } });
  await dictation.start(); await dictation.finish();
  expect(dictation.getSnapshot().unavailable).toBe(true);
  expect(removed).toEqual(['file:///voice.mp4']);
});
