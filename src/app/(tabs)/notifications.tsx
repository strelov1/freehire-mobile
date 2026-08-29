import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';
import { markNotificationRead } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';
import type { NotificationItem, NotificationsPage } from '@/lib/types';
import { useNotifications } from '@/lib/useNotifications';

/** Icon + short label per notification kind. An unrecognized kind (a future
 *  addition this build predates) still renders — generic bell, its raw kind
 *  string as the label — rather than crashing or rendering blank. */
const KIND_META: Record<string, { icon: SFSymbol; label: string }> = {
  subscription_digest: { icon: 'bell', label: 'Saved search' },
  reminder: { icon: 'clock', label: 'Reminder' },
  nudge_follow_up: { icon: 'arrow.uturn.right', label: 'Follow up' },
  nudge_interview_prep: { icon: 'text.bubble', label: 'Interview prep' },
  nudge_job_closed: { icon: 'xmark.circle', label: 'Job closed' },
};

function kindMeta(kind: string): { icon: SFSymbol; label: string } {
  return KIND_META[kind] ?? { icon: 'bell', label: kind };
}

/**
 * One notification card. The whole card is pressable — mirrors `JobCard`'s
 * tap-the-whole-surface convention. Unread state reads as a filled brand dot
 * plus a bolder title, same weight/color language `AccountScreen`'s badges
 * and `JobCard`'s title already use; read cards fall back to the muted tone.
 */
function NotificationCard({
  item,
  colors: c,
  onPress,
}: {
  item: NotificationItem;
  colors: ReturnType<typeof getColors>;
  onPress: () => void;
}) {
  const unread = !item.read_at;
  const meta = kindMeta(item.kind);
  const posted = timeAgo(item.created_at);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: unread ? c.brandMuted : c.card, borderColor: c.border },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: c.card }]}>
        <AppSymbol name={meta.icon} size={18} tintColor={c.mutedForeground} />
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.kind, { color: c.mutedForeground }]}>{meta.label}</Text>
          {posted ? (
            <Text style={[styles.posted, { color: c.mutedForeground }]}>{posted}</Text>
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[styles.title, { color: c.foreground, fontWeight: unread ? '700' : '500' }]}>
          {item.title}
        </Text>
        <Text numberOfLines={3} style={[styles.text, { color: c.mutedForeground }]}>
          {item.body}
        </Text>
      </View>

      {unread ? <View style={[styles.dot, { backgroundColor: c.brand }]} /> : null}
    </Pressable>
  );
}

/**
 * The notification center — every `user_notifications` row for the signed-in
 * user, newest first, as tappable cards. Tapping a card marks it read (always,
 * per the backend's idempotent `POST .../read`). When it carries a job's
 * `public_slug`, lifecycle nudges (`nudge_follow_up`, `nudge_interview_prep`)
 * navigate to tracker detail (`/tracker/[id]`), while reminders, closed notices,
 * and single-job digests navigate to the job. A slug-less card carrying a
 * `jobs` snapshot (a multi-job digest) opens its own matched-jobs screen;
 * one with neither only marks read.
 */
export default function NotificationsScreen() {
  const c = getColors(useColorScheme());
  const qc = useQueryClient();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  // Optimistic local read state: flips this row (and the badge count) the
  // instant a card is tapped, rather than waiting on the network — the real
  // mark-read call still fires below, and a failure just leaves it to
  // reconcile on the next list refresh (best-effort, matches the backend's
  // own "recording a failure must not block the user" posture elsewhere).
  function markReadLocally(id: number) {
    qc.setQueryData<InfiniteData<NotificationsPage, number>>(['notifications', 'list'], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.map((n) =>
            n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
          ),
        })),
      };
    });
    qc.setQueryData<number>(['notifications', 'unread-count'], (old) =>
      old ? Math.max(0, old - 1) : old,
    );
  }

  function onPressCard(item: NotificationItem) {
    if (!item.read_at) markReadLocally(item.id);
    markNotificationRead(item.id).catch(() => {
      // Best-effort: see markReadLocally's note above.
    });
    if (item.public_slug) {
      if (item.kind === 'nudge_follow_up' || item.kind === 'nudge_interview_prep') {
        router.push({ pathname: '/tracker/[id]' as any, params: { id: item.public_slug } });
      } else {
        router.push(`/jobs/${item.public_slug}`);
      }
    } else if (item.jobs && item.jobs.length > 0) {
      // A multi-job digest carries no single slug — its own jobs-list screen
      // shows the snapshot recorded at delivery instead.
      router.push({ pathname: '/notifications/[id]', params: { id: item.id } });
    }
  }

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={c.brand} />
      </View>
    );
  } else if (isError && items.length === 0) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          Couldn’t load notifications.{'\n'}
          {(error as Error)?.message ?? 'Please try again.'}
        </Text>
        <Text onPress={() => refetch()} style={[styles.retry, { color: c.brand }]}>
          Tap to retry
        </Text>
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <AppSymbol name="bell" size={32} tintColor={c.mutedForeground} />
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          No notifications yet.
        </Text>
      </View>
    );
  } else {
    body = (
      <FlashList<NotificationItem>
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <NotificationCard item={item} colors={c} onPress={() => onPressCard(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: Space.sm }} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            tintColor={c.brand}
            colors={[c.brand]}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={c.brand} />
            </View>
          ) : null
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Notifications</Text>
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
  header: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  listContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xs,
    // Clears the custom bottom tab bar so the last card isn't hidden behind it.
    paddingBottom: Space.xl + TAB_BAR_HEIGHT,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  kind: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  posted: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  retry: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: Space.lg,
  },
});
