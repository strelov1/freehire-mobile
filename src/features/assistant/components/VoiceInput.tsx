import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { transcribeRecording } from '../api/speechApi';
import { Dictation } from '../model/dictation';

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, sampleRate: 16_000, bitRate: 24_000 };
type Props = {
  disabled: boolean;
  onTranscript: (text: string) => void;
  onActiveChange: (active: boolean) => void;
  onError: (error: string | null) => void;
};
function removeRecording(uri: string) {
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Cache cleanup is best effort. */ }
}

function NativeVoiceInput({ disabled, onTranscript, onActiveChange, onError }: Props) {
  const c = getColors(useColorScheme());
  const { user, sessionEpoch, isOwnerCurrent } = useAuth();
  const dictationRef = useRef<Dictation | null>(null);
  const onActiveChangeRef = useRef(onActiveChange);
  useEffect(() => { onActiveChangeRef.current = onActiveChange; }, [onActiveChange]);
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    const dictation = dictationRef.current;
    if (!dictation || dictation.getSnapshot().phase !== 'recording') return;
    if (status.hasError || status.mediaServicesDidReset) {
      void dictation.fail(new Error('The recording stopped unexpectedly. Please try again.'));
    } else if (status.isFinished) {
      if (dictation.getSnapshot().elapsed >= 299) void dictation.finish();
      else void dictation.fail(new Error('The recording was interrupted. Please try again.'));
    }
  });
  const [dictation] = useState(() => {
    let recordingUri: string | null = null;
    const owner = { userId: user?.id ?? -1, sessionEpoch };
    return new Dictation({
      start: async () => {
        if (!isOwnerCurrent(owner)) throw new Error('Sign in to dictate a message.');
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) throw new Error('Allow microphone access in Settings to dictate a message.');
        try {
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          await recorder.prepareToRecordAsync();
          recordingUri = recorder.uri;
          recorder.record({ forDuration: 300 });
        } catch (error) {
          await setAudioModeAsync({ allowsRecording: false });
          if (recordingUri) removeRecording(recordingUri);
          recordingUri = null;
          throw error;
        }
      },
      stop: async () => {
        // The recorder hook may release its native object before our unmount cleanup.
        const uri = recordingUri;
        recordingUri = null;
        try {
          if (recorder.isRecording) await recorder.stop();
          return recorder.uri ?? uri;
        } catch (error) {
          if (uri) removeRecording(uri);
          throw error;
        } finally { await setAudioModeAsync({ allowsRecording: false }); }
      },
      remove: removeRecording,
      transcribe: (uri, signal) => transcribeRecording(uri, sessionEpoch, signal),
      onTranscript: (text) => { if (isOwnerCurrent(owner)) onTranscript(text); },
    });
  });
  useEffect(() => { dictationRef.current = dictation; return () => { dictationRef.current = null; }; }, [dictation]);
  const { phase, elapsed, error, unavailable } = useSyncExternalStore(dictation.subscribe, dictation.getSnapshot);
  useEffect(() => { onActiveChange(phase !== 'idle'); }, [onActiveChange, phase]);
  useEffect(() => { onError(unavailable ? null : error); }, [onError, error, unavailable]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // iOS becomes inactive while its microphone permission dialog is open.
      if (state === 'background' || (state === 'inactive' && dictation.getSnapshot().phase !== 'starting')) void dictation.cancel();
    });
    return () => { subscription.remove(); void dictation.cancel(); onActiveChangeRef.current(false); };
  }, [dictation]);
  useFocusEffect(useCallback(() => () => { void dictation.cancel(); }, [dictation]));

  if (unavailable) return null;
  if (phase === 'recording') {
    return <View accessibilityLiveRegion="polite" style={[styles.recording, { backgroundColor: c.destructiveMuted }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Discard recording" hitSlop={8} onPress={() => void dictation.cancel()} style={styles.smallButton}>
        <AppSymbol name="xmark" size={16} tintColor={c.mutedForeground} />
      </Pressable>
      <View style={[styles.dot, { backgroundColor: c.destructive }]} />
      <Text style={[styles.time, { color: c.mutedForeground }]}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Use recording" hitSlop={8} onPress={() => void dictation.finish()} style={[styles.smallButton, { backgroundColor: c.foreground }]}>
        <AppSymbol name="checkmark" size={16} tintColor={c.background} />
      </Pressable>
    </View>;
  }
  const processing = phase === 'starting' || phase === 'transcribing';
  return <Pressable accessibilityRole="button" accessibilityLabel={processing ? 'Transcribing' : 'Dictate a message'}
    accessibilityState={{ disabled: disabled || processing, busy: processing }} disabled={disabled || processing}
    hitSlop={4} onPress={() => void dictation.start()} style={[styles.button, { opacity: disabled ? 0.5 : 1 }]}>
    {processing ? <ActivityIndicator size="small" color={c.mutedForeground} /> : <AppSymbol name="mic" size={18} tintColor={c.mutedForeground} />}
  </Pressable>;
}

export function VoiceInput(props: Props) {
  return Platform.OS === 'web' ? null : <NativeVoiceInput {...props} />;
}
const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  recording: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, padding: Space.xs, borderRadius: Radius.pill },
  smallButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  dot: { width: 6, height: 6, borderRadius: Radius.pill },
  time: { fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'center' },
});
