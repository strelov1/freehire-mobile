import React, { useState } from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Text, TextInput, type AppStateStatus } from 'react-native';
import { renderedText } from '@/__tests__/renderedText';
import { VoiceInput } from './VoiceInput';
import { appendTranscript } from '../model/dictation';

let mockReleased = false;
const mockFiles = new Set<string>();
const mockRecorder = {
  prepareToRecordAsync: async () => { mockFiles.add('file:///voice.m4a'); },
  record: () => {}, stop: async () => {},
  get uri() { if (mockReleased) throw new Error('Released recorder'); return 'file:///voice.m4a'; },
  get isRecording() { if (mockReleased) throw new Error('Released recorder'); return true; },
};
const mockPermission = jest.fn(async () => ({ granted: true }));
jest.mock('expo-audio', () => ({
  useAudioRecorder: () => {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => () => { mockReleased = true; }, []);
    return mockRecorder;
  },
  RecordingPresets: { HIGH_QUALITY: {} },
  AudioModule: { requestRecordingPermissionsAsync: () => mockPermission() },
  setAudioModeAsync: async () => {},
}));
jest.mock('expo-file-system', () => ({ File: class { uri: string; constructor(uri: string) { this.uri = uri; } get exists() { return mockFiles.has(this.uri); } delete() { mockFiles.delete(this.uri); } } }));
jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));
jest.mock('@/components/AppSymbol', () => ({ AppSymbol: () => null }));
jest.mock('@/lib/authStore', () => ({ useAuth: () => ({ user: { id: 9 }, sessionEpoch: 1, isOwnerCurrent: () => true }) }));
jest.mock('../api/speechApi', () => ({ transcribeRecording: async () => 'spoken words' }));

function Host() {
  const [draft, setDraft] = useState('Typed first');
  const [error, setError] = useState<string | null>(null);
  return <><TextInput value={draft} /><Text>{error}</Text><VoiceInput disabled={false} onError={setError} onTranscript={(text) => setDraft((before) => appendTranscript(before, text))} onActiveChange={() => {}} /></>;
}
let renderer: Renderer.ReactTestRenderer;
beforeEach(() => { mockReleased = false; mockFiles.clear(); });
afterEach(() => { if (renderer) act(() => renderer.unmount()); jest.clearAllMocks(); jest.restoreAllMocks(); });

it('records on demand, lets the user confirm, and appends words without sending', async () => {
  await act(async () => { renderer = Renderer.create(<Host />); });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Dictate a message' }).props.onPress(); });
  expect(renderedText(renderer).join(' ')).toContain('0:00');
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Use recording' }).props.onPress(); });
  expect(renderer.root.findByType(TextInput).props.value).toBe('Typed first spoken words');
});

it('shows microphone permission failure in the composer', async () => {
  mockPermission.mockResolvedValueOnce({ granted: false });
  await act(async () => { renderer = Renderer.create(<Host />); });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Dictate a message' }).props.onPress(); });
  expect(renderedText(renderer).join(' ')).toContain('microphone');
  expect(renderer.root.findByType(TextInput).props.value).toBe('Typed first');
});

it('removes raw audio on unmount even after the native recorder has been released', async () => {
  await act(async () => { renderer = Renderer.create(<Host />); });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Dictate a message' }).props.onPress(); });
  expect(mockFiles.has('file:///voice.m4a')).toBe(true);
  await act(async () => { renderer.unmount(); });
  expect(mockFiles.has('file:///voice.m4a')).toBe(false);
});

it('allows the permission dialog to make iOS inactive without cancelling the requested recording', async () => {
  let onChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => { onChange = listener; return { remove: () => {} }; });
  let grant!: (permission: { granted: boolean }) => void;
  mockPermission.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
  await act(async () => { renderer = Renderer.create(<Host />); });
  let start: Promise<void> | undefined;
  act(() => { start = renderer.root.findByProps({ accessibilityLabel: 'Dictate a message' }).props.onPress(); });
  await act(async () => { onChange?.('inactive'); grant({ granted: true }); await start; });
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Use recording' })).not.toHaveLength(0);
});
