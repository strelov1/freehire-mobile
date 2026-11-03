import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { renderedText } from '@/__tests__/renderedText';
import { AssistantChat } from './AssistantChat';
import { Conversation } from '../model/conversation';
import { VoiceInput } from './VoiceInput';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('./VoiceInput', () => ({ VoiceInput: () => null }));
jest.mock('@/components/AppSymbol', () => ({ AppSymbol: () => null }));
jest.mock('@/lib/useJob', () => ({ useJob: () => ({ data: undefined }) }));
jest.mock('@/components/JobCard', () => ({ JobCard: () => null }));

it('sends a typed message, renders the reply and keeps the composer usable', async () => {
  const conversation = new Conversation({
    get: async () => ({ session: { id: 'chat', label: 'My chat', preset: 'chat' }, messages: [] }),
    send: async (text, onEvent) => {
      onEvent({ type: 'user_prompt', text });
      onEvent({ type: 'assistant_text', text: 'Here is your answer.' });
      onEvent({ type: 'result' });
    },
    cancel: async () => {},
  });
  let renderer!: Renderer.ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}><AssistantChat conversation={conversation} /></SafeAreaProvider>);
  });
  act(() => renderer.root.findByType(TextInput).props.onChangeText('Find remote jobs'));
  act(() => renderer.root.findByType(VoiceInput).props.onActiveChange(true));
  expect(renderer.root.findByProps({ accessibilityLabel: 'Send message' }).props.disabled).toBe(true);
  expect(renderer.root.findByType(TextInput).props.editable).toBe(false);
  act(() => renderer.root.findByType(VoiceInput).props.onTranscript('with React'));
  expect(renderer.root.findByType(TextInput).props.value).toBe('Find remote jobs with React');
  expect(renderedText(renderer).join(' ')).not.toContain('Here is your answer.');
  act(() => renderer.root.findByType(VoiceInput).props.onActiveChange(false));
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Send message' }).props.onPress(); });
  expect(renderedText(renderer).join(' ')).toContain('Find remote jobs');
  expect(renderedText(renderer).join(' ')).toContain('Here is your answer.');
  expect(renderer.root.findByType(TextInput).props.value).toBe('');
  act(() => renderer.unmount());
});
