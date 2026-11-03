import { memo } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, Radius, Space } from '@/constants/freehire';
import { JobCard } from '@/components/JobCard';
import { useJob } from '@/lib/useJob';
import { splitPresentingCalls, type DeckEntry } from '../model/deck';
import type { ChatState } from '../model/chat';

function Recommendation({ entry }: { entry: DeckEntry }) {
  const c = getColors(useColorScheme());
  const { data: job, isLoading, isError, refetch } = useJob(entry.slug);
  const reasons = entry.note || entry.whyFits.length > 0 || entry.concerns.length > 0 ? (
    <View style={styles.reasons}>
      {entry.note ? <Text style={[styles.note, { color: c.foreground }]}>{entry.note}</Text> : null}
      {entry.whyFits.map((text, index) => <Text key={index} style={[styles.reason, { color: c.brandStrong }]}>✓ {text}</Text>)}
      {entry.concerns.map((text, index) => <Text key={index} style={[styles.reason, { color: c.mutedForeground }]}>• {text}</Text>)}
    </View>
  ) : null;
  if (job) return <JobCard job={job}>{reasons}</JobCard>;
  // The vacancy has not arrived (or could not): the reasons still stand on their own card.
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="View recommended job"
      onPress={() => router.push({ pathname: '/jobs/[slug]', params: { slug: entry.slug } })}
      style={[styles.recommendation, { backgroundColor: c.card, borderColor: c.border }]}>
      {isLoading ? <ActivityIndicator color={c.brandStrong} /> : <Text style={[styles.title, { color: c.foreground }]}>View recommended job</Text>}
      {reasons}
      {isError ? <Pressable accessibilityRole="button" onPress={() => void refetch()}><Text style={{ color: c.brandStrong }}>Could not load job details. Retry</Text></Pressable> : null}
    </Pressable>
  );
}

export const AssistantMessage = memo(function AssistantMessage({ message }: { message: ChatState['messages'][number] }) {
  const c = getColors(useColorScheme());
  const { decks, rest } = splitPresentingCalls(message.tools, message.streaming);
  const isUser = message.role === 'user';
  const pendingTools = rest.filter((tool) => tool.result === undefined);
  return (
    <View style={[styles.message, isUser && styles.userMessage, { backgroundColor: isUser ? c.brandMuted : c.background }]}>
      <Text style={[styles.author, { color: c.mutedForeground }]}>{isUser ? 'You' : 'Assistant'}</Text>
      {message.text ? <Text selectable style={[styles.text, { color: c.foreground }]}>{message.text}</Text> : null}
      {message.attachments.map((name, index) => <Text key={index} style={{ color: c.mutedForeground }}>Document: {name}</Text>)}
      {message.streaming && !message.text ? <Text style={{ color: c.mutedForeground }}>{pendingTools.length ? 'Working on your request…' : 'Thinking…'}</Text> : null}
      {decks.map((slot, index) => slot.status === 'pending'
        ? <ActivityIndicator key={index} color={c.brandStrong} accessibilityLabel="Loading recommendations" />
        : <View key={index} style={{ gap: Space.sm }}>
            {slot.deck.heading ? <Text style={[styles.title, { color: c.foreground }]}>{slot.deck.heading}</Text> : null}
            {slot.deck.entries.map((entry) => <Recommendation key={entry.slug} entry={entry} />)}
          </View>)}
      {message.errored ? <Text style={{ color: c.destructive }}>The assistant could not finish this reply. You can ask it to continue.</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  message: { gap: Space.sm, marginBottom: Space.lg, padding: Space.md, borderRadius: Radius.lg },
  userMessage: { marginLeft: Space.xl },
  author: { fontSize: 12, fontWeight: '600' },
  text: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 16, fontWeight: '700' },
  reasons: { gap: 2, marginTop: Space.xs },
  note: { fontSize: 15, lineHeight: 22 },
  reason: { fontSize: 14, lineHeight: 20 },
  recommendation: { padding: Space.lg, borderRadius: Radius.lg, borderWidth: 1, gap: Space.sm },
});
