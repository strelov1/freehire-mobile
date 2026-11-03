import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space, withAlpha } from '@/constants/freehire';
import type { Conversation } from '../model/conversation';
import type { ChatState } from '../model/chat';
import { AssistantMessage } from './AssistantMessage';
import { VoiceInput } from './VoiceInput';
import { appendTranscript } from '../model/dictation';

const STARTERS = ['Find jobs that match my skills', 'Help me describe my experience', 'Help me prepare for an interview'];

export function AssistantChat({ conversation }: { conversation: Conversation }) {
  const c = getColors(useColorScheme());
  const snapshot = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot);
  const { chat, phase, draft, error, label, unavailable, stopRequested } = snapshot;
  const list = useRef<FlatList<ChatState['messages'][number]>>(null);
  const nearBottom = useRef(true);
  const input = useRef<TextInput>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const busy = phase === 'sending';
  const running = busy || phase === 'recovering';
  const canSend = (phase === 'ready' || phase === 'recovering') && !unavailable;
  const canSubmit = canSend && !voiceActive && !!draft.trim();
  let activity = 'Assistant is working…';
  if (chat.queued) activity = 'Waiting for the previous request…';
  if (stopRequested) activity = 'Stopping…';

  useEffect(() => {
    void conversation.load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void conversation.load();
      else conversation.detach();
    });
    return () => { subscription.remove(); conversation.detach(); };
  }, [conversation]);

  const acceptTranscript = useCallback((text: string) => {
    conversation.setDraft(appendTranscript(conversation.getSnapshot().draft, text));
    requestAnimationFrame(() => input.current?.focus());
  }, [conversation]);
  function send() { if (voiceActive) return; nearBottom.current = true; void conversation.send(); }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Conversation history" onPress={() => router.canGoBack() ? router.back() : router.replace('/assistant')} style={styles.iconButton}>
          <AppSymbol name="chevron.left" tintColor={c.brandStrong} />
        </Pressable>
        <View style={styles.fill}>
          <Text numberOfLines={1} style={[styles.title, { color: c.foreground }]}>{label}</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>FreeHire Assistant</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh conversation" disabled={busy} onPress={() => void conversation.load()} style={styles.iconButton}>
          <AppSymbol name="arrow.counterclockwise" tintColor={busy ? c.mutedForeground : c.brandStrong} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {phase === 'loading' ? <ActivityIndicator style={{ padding: Space.md }} color={c.brandStrong} accessibilityLabel="Loading conversation" /> : null}
        {error ? <View style={[styles.notice, { backgroundColor: c.destructiveMuted }]}>
          <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text>
          {!unavailable && phase === 'error' ? <Pressable onPress={() => void conversation.load()}><Text style={{ color: c.brandStrong }}>Retry</Text></Pressable> : null}
        </View> : null}
        {phase === 'recovering' ? <View style={[styles.notice, { backgroundColor: c.brandMuted }]}>
          <Text style={{ color: c.foreground }}>{stopRequested ? 'Stop requested. Refresh to see the latest saved messages.' : 'Showing saved messages. The assistant may still be working.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => void conversation.load()}><Text style={{ color: c.brandStrong }}>Refresh messages</Text></Pressable>
        </View> : null}
        <FlatList ref={list} data={chat.messages} keyExtractor={(_message, index) => String(index)}
          renderItem={({ item }) => <AssistantMessage message={item} />}
          contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled"
          onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
            nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100;
          }} scrollEventThrottle={100}
          onContentSizeChange={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
          ListEmptyComponent={phase === 'ready' ? <View style={styles.empty}>
            <AppSymbol name="text.bubble" size={36} tintColor={c.brandStrong} />
            <Text style={[styles.emptyTitle, { color: c.foreground }]}>What’s your next career move?</Text>
            <Text style={[styles.body, { color: c.mutedForeground }]}>Search for opportunities, explore your experience, or prepare for what comes next.</Text>
            {STARTERS.map((text) => <Pressable key={text} accessibilityRole="button" onPress={() => conversation.setDraft(text)} style={[styles.starter, { borderColor: c.border, backgroundColor: c.card }]}>
              <Text style={{ color: c.brandStrong }}>{text}</Text>
            </Pressable>)}
          </View> : null}
          ListFooterComponent={busy ? <Text style={{ padding: Space.md, color: c.mutedForeground }}>{activity}</Text> : null}
        />
        <View style={[styles.composer, { borderTopColor: c.border }]}>
          <View style={[styles.composerFrame, {
            backgroundColor: c.card,
            borderColor: composerFocused ? c.ring : withAlpha(c.border, 0.6),
            boxShadow: composerFocused ? `0 0 0 2px ${c.ring}` : '0 1px 2px rgba(0, 0, 0, 0.05)',
          }]}>
            <TextInput ref={input} accessibilityLabel="Message to assistant" value={draft} onChangeText={conversation.setDraft}
              editable={canSend && !voiceActive} multiline maxLength={20_000} placeholder="Ask your assistant…" placeholderTextColor={c.mutedForeground}
              onFocus={() => setComposerFocused(true)} onBlur={() => setComposerFocused(false)}
              style={[styles.input, { color: c.foreground }]} />
            <VoiceInput disabled={!canSend} onTranscript={acceptTranscript} onActiveChange={setVoiceActive} onError={setVoiceError} />
            {running ? (
              <Pressable accessibilityRole="button" accessibilityLabel={stopRequested ? 'Stopping' : 'Stop generating'}
                accessibilityState={{ disabled: stopRequested }} disabled={stopRequested} onPress={() => void conversation.stop()} hitSlop={4}
                style={({ pressed }) => [styles.send, { backgroundColor: c.foreground, opacity: stopRequested ? 0.5 : pressed ? 0.9 : 1 }]}>
                <AppSymbol name="stop.fill" size={14} tintColor={c.background} />
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: !canSubmit }}
                disabled={!canSubmit} onPress={send} hitSlop={4}
                style={({ pressed }) => [styles.send, { backgroundColor: c.foreground, opacity: canSubmit ? (pressed ? 0.9 : 1) : 0.5 }]}>
                <AppSymbol name="arrow.up" size={16} weight="bold" tintColor={c.background} />
              </Pressable>
            )}
          </View>
          {voiceError ? <Text accessibilityRole="alert" style={[styles.voiceError, { color: c.destructive }]}>{voiceError}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.sm, paddingVertical: Space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  messages: { padding: Space.md, flexGrow: 1 },
  empty: { padding: Space.lg, paddingTop: Space.xl, gap: Space.lg },
  emptyTitle: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  starter: { borderWidth: 1, borderRadius: Radius.lg, padding: Space.lg },
  notice: { margin: Space.md, padding: Space.md, gap: Space.sm, borderRadius: Radius.md },
  composer: { padding: Space.md, borderTopWidth: StyleSheet.hairlineWidth },
  composerFrame: { width: '100%', maxWidth: 768, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, borderWidth: 1, borderRadius: 24, paddingHorizontal: Space.lg, paddingVertical: 10 },
  input: { flex: 1, paddingHorizontal: 0, paddingVertical: 6, fontSize: 16, lineHeight: 24, minHeight: 36, maxHeight: 200, textAlignVertical: 'top' },
  voiceError: { marginTop: 6, paddingHorizontal: Space.lg, fontSize: 12 },
  send: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
});
