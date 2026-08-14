import { StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Space } from '@/constants/freehire';

/**
 * Companies tab placeholder — no company list/search API exists yet (only
 * a per-company detail route, `companies/[slug].tsx`, reached from a job's
 * card). Static, no data fetching; replace with a real list once that API
 * exists.
 */
export default function CompaniesScreen() {
  const c = getColors(useColorScheme());

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
      <AppSymbol name="building.2" size={40} tintColor={c.mutedForeground} />
      <Text style={[styles.title, { color: c.foreground }]}>Companies</Text>
      <Text style={[styles.subtitle, { color: c.mutedForeground }]}>Coming soon.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Space.sm, padding: Space.xl },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
});
