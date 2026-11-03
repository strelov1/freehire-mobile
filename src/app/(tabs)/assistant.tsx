import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { useTabBarClearance } from '@/lib/tabBarVisibility';
import { assistantApi } from '@/features/assistant/api/assistantApi';
import { AssistantAccess } from '@/features/assistant/components/AssistantAccess';
import { assistantError } from '@/features/assistant/model/conversation';
import type { SessionSummary } from '@/features/assistant/model/wire';

function ConversationList({ userId, sessionEpoch }: { userId: number; sessionEpoch: number }) {
  const c = getColors(useColorScheme());
  const tabBarClearance = useTabBarClearance();
  const { isOwnerCurrent, createPrivateMutation } = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(() => assistantApi(sessionEpoch), [sessionEpoch]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transport = useRef<{ signal: AbortSignal; release: () => void } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const key = useMemo(() => ['private', userId, 'assistant', 'sessions'] as const, [userId]);
  const sessions = useQuery({ queryKey: key, queryFn: ({ signal }) => api.list(signal), retry: 1 });
  useFocusEffect(useCallback(() => { void queryClient.invalidateQueries({ queryKey: key }); }, [queryClient, key]));
  useEffect(() => () => { controller.current?.abort(); transport.current?.release(); }, []);

  async function mutate(action: (signal: AbortSignal) => Promise<SessionSummary | void>) {
    if (transport.current) return;
    const owner = { userId, sessionEpoch };
    if (!isOwnerCurrent(owner)) return;
    const registration = createPrivateMutation(owner);
    const local = new AbortController();
    controller.current = local;
    const abort = () => local.abort();
    registration.signal.addEventListener('abort', abort, { once: true });
    transport.current = registration;
    setPending(true);
    setError(null);
    try {
      const created = await action(local.signal);
      if (local.signal.aborted || !isOwnerCurrent(owner)) return;
      await queryClient.invalidateQueries({ queryKey: key });
      if (created && !local.signal.aborted && isOwnerCurrent(owner)) {
        router.push({ pathname: '/assistant/[id]', params: { id: created.id } });
      }
    } catch (cause) {
      if (!local.signal.aborted && isOwnerCurrent(owner)) setError(assistantError(cause));
    } finally {
      registration.signal.removeEventListener('abort', abort);
      registration.release();
      if (transport.current === registration) transport.current = null;
      if (!local.signal.aborted && isOwnerCurrent(owner)) setPending(false);
    }
  }

  function remove(session: SessionSummary) {
    Alert.alert('Delete conversation?', 'This removes it from FreeHire on all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void mutate((signal) => api.delete(session.id, signal)) },
    ]);
  }

  const items = sessions.data?.filter((session) => session.preset !== 'tailor' && session.preset !== 'browse') ?? [];
  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>Assistant</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="New conversation" disabled={pending} hitSlop={8}
          onPress={() => void mutate(api.create)} style={styles.compose}>
          {pending ? <ActivityIndicator color={c.foreground} /> : <AppSymbol name="square.and.pencil" size={24} tintColor={c.foreground} />}
        </Pressable>
      </View>
      {(error || sessions.isError) ? <View style={styles.notice}>
        <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error || assistantError(sessions.error)}</Text>
        {sessions.isError ? <Pressable onPress={() => void sessions.refetch()}><Text style={{ color: c.brandStrong }}>Retry</Text></Pressable> : null}
      </View> : null}
      {sessions.isPending ? <ActivityIndicator color={c.brandStrong} style={{ padding: Space.xl }} /> : null}
      <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
        refreshControl={<RefreshControl refreshing={sessions.isRefetching} onRefresh={() => void sessions.refetch()} tintColor={c.brandStrong} />}
        ListEmptyComponent={!sessions.isPending && !sessions.isError ? <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.foreground }]}>What can I help with?</Text>
          <Text style={[styles.description, { color: c.mutedForeground }]}>Find jobs, talk through your experience, get ready for interviews. Tap the pencil to start. Conversations from the web appear here too.</Text>
        </View> : null}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityHint="Long press to delete" disabled={pending}
          onPress={() => router.push({ pathname: '/assistant/[id]', params: { id: item.id } })}
          onLongPress={() => remove(item)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.card }]}>
          <Text numberOfLines={1} style={[styles.sessionTitle, { color: c.foreground }]}>{item.label?.trim() || 'New conversation'}</Text>
        </Pressable>}
      />
    </View>
  );
}

export default function AssistantListScreen() {
  const c = getColors(useColorScheme());
  const { user, sessionEpoch } = useAuth();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.background }]}>
      <AssistantAccess>
        {user ? <ConversationList key={`${user.id}:${sessionEpoch}`} userId={user.id} sessionEpoch={sessionEpoch} /> : null}
      </AssistantAccess>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.lg, paddingTop: Space.sm },
  title: { fontSize: 28, fontWeight: '700' },
  compose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Space.md },
  row: { paddingVertical: Space.md, paddingHorizontal: Space.sm, borderRadius: Radius.md },
  sessionTitle: { fontSize: 17 },
  empty: { alignItems: 'center', padding: Space.xl, gap: Space.lg },
  emptyTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  notice: { padding: Space.lg, gap: Space.sm },
});
