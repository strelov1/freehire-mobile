import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { Radius, Space, getColors } from '@/constants/freehire';
import { allowanceRows } from '@/features/billing/model/allowances';
import { planHeadline, planView } from '@/features/billing/model/planView';
import { isPurchasingSupported } from '@/features/billing/purchases';
import { WEB_PLAN_URL, storeSubscriptionsURL } from '@/features/billing/storeLinks';
import { usePurchase, type PurchaseOutcome } from '@/features/billing/usePurchase';
import { useAuth } from '@/lib/authStore';
import { usePlan, useRefreshPlan } from '@/lib/usePlan';

const PRIVACY_POLICY_URL = 'https://freehire.me/privacy';
const TERMS_OF_SERVICE_URL = 'https://freehire.me/terms';

async function openExternally(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
    });
  } catch {
    // A browser that will not open is not worth an error dialog on top of it.
  }
}

/**
 * The plan screen: what the account is on, and — only where it is allowed — what it can buy.
 *
 * Every "allowed" here is a store rule rather than a layout choice, and all of them are
 * decided in `planView` from the server's `pro_source`. Selling to somebody already paying
 * through Stripe charges them twice for one plan; telling an in-app subscriber to cancel on a
 * web page breaks Apple's rules. Neither is something this screen should be free to get
 * wrong, which is why neither decision is made here.
 */
export default function PlanScreen() {
  const c = getColors(useColorScheme());
  const { user } = useAuth();
  const { data: plan, isError } = usePlan();
  const refreshPlan = useRefreshPlan();
  const { options, loadingOptions, busy, reloadOptions, buy, restore } = usePurchase();

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const view = planView({
    plan,
    canPurchase: isPurchasingSupported,
    signedIn: !!user,
    failed: isError,
  });
  const headline = planHeadline(view);
  const allowances = allowanceRows(plan);

  const settle = useCallback(
    async (outcome: PurchaseOutcome) => {
      setNotice(null);
      setError(null);
      switch (outcome.kind) {
        case 'confirmed':
          await refreshPlan();
          setNotice('You are on Pro.');
          return;
        case 'pending':
          // Money has been taken. Saying so plainly beats a spinner, and beats offering the
          // purchase again — which is how somebody pays twice.
          await refreshPlan();
          setNotice('Payment received. Your plan will be active in a moment.');
          return;
        case 'nothing_to_restore':
          setNotice('No purchases to restore on this account.');
          return;
        case 'cancelled':
          // The most common outcome of opening a paywall. Not an error, and not narrated.
          return;
        case 'failed':
          setError(outcome.message);
      }
    },
    [refreshPlan],
  );

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.headerBar, { borderBottomColor: c.border }]}>
        <Pressable
          // Arriving from a deep link leaves nothing to go back to, and a button that
          // silently does nothing strands the user here.
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <AppSymbol name="chevron.left" size={20} tintColor={c.foreground} />
          <Text style={[styles.backText, { color: c.foreground }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {view.kind === 'loading' ? (
            <ActivityIndicator color={c.brandStrong} />
          ) : (
            <>
              <Text style={[styles.planName, { color: c.foreground }]}>{headline.title}</Text>
              <Text style={[styles.planNote, { color: c.mutedForeground }]}>{headline.detail}</Text>
            </>
          )}
        </View>

        {view.kind === 'signed_out' && (
          <Pressable
            onPress={() => router.push('/auth')}
            style={[styles.option, { borderColor: c.border }]}
            accessibilityRole="button">
            <Text style={[styles.optionPeriod, { color: c.brandStrong }]}>Sign in</Text>
          </Pressable>
        )}


        {view.offersPurchase && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Upgrade</Text>

            {loadingOptions ? (
              <ActivityIndicator color={c.brandStrong} />
            ) : options.length === 0 ? (
              <Pressable onPress={() => void reloadOptions()} style={styles.linkRow}>
                <Text style={[styles.linkText, { color: c.brandStrong }]}>
                  Prices are unavailable. Tap to try again.
                </Text>
              </Pressable>
            ) : (
              options.map((option) => (
                <Pressable
                  key={option.id}
                  disabled={busy}
                  onPress={() => void buy(option.id).then(settle)}
                  style={[styles.option, { borderColor: c.border, opacity: busy ? 0.5 : 1 }]}
                  accessibilityRole="button">
                  <View style={styles.optionText}>
                    <Text style={[styles.optionPeriod, { color: c.foreground }]}>
                      {option.period === 'annual' ? 'Yearly' : option.period === 'monthly' ? 'Monthly' : 'Pro'}
                    </Text>
                    {option.savingPercent !== undefined && (
                      <Text style={[styles.optionSaving, { color: c.brandStrong }]}>
                        Save {option.savingPercent}%
                      </Text>
                    )}
                  </View>
                  {/* The store's own price string, for the buyer's own storefront. */}
                  <Text style={[styles.optionPrice, { color: c.foreground }]}>{option.priceLabel}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {allowances.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Today</Text>
            {/* Said once, plainly: none of these is reachable from this app. Listing them
                without that line would read as a promise about buttons that are not here. */}
            <Text style={[styles.planNote, { color: c.mutedForeground }]}>
              What your plan allows across freehire each day. These features live on the web.
            </Text>
            {allowances.map((row) => (
              <View key={row.key} style={styles.allowanceRow}>
                <Text style={[styles.allowanceLabel, { color: c.foreground }]}>{row.label}</Text>
                <Text style={[styles.allowanceDetail, { color: c.mutedForeground }]}>{row.detail}</Text>
              </View>
            ))}
          </View>
        )}

        {notice && <Text style={[styles.notice, { color: c.brandStrong }]}>{notice}</Text>}
        {error && <Text style={[styles.notice, { color: c.destructive }]}>{error}</Text>}

        <View style={styles.section}>
          {/* Apple requires a restore path in anything selling a subscription, and it is the
              recovery route after a reinstall or a new device — so it stays available to
              somebody the server already reports as Pro. Never signed out, though: a restore
              with no identity attaches whatever it finds to an anonymous provider user. */}
          {view.offersRestore && (
            <Pressable disabled={busy} onPress={() => void restore().then(settle)} style={styles.linkRow}>
              <Text style={[styles.linkText, { color: c.brandStrong }]}>Restore purchases</Text>
            </Pressable>
          )}

          {view.manageAt === 'store' && (
            <Pressable onPress={() => void openExternally(storeSubscriptionsURL())} style={styles.linkRow}>
              <Text style={[styles.linkText, { color: c.brandStrong }]}>Manage subscription</Text>
            </Pressable>
          )}

          {view.manageAt === 'web' && (
            <>
              {/* Bought on the web, so it is changed on the web. Nothing here offers a second
                  purchase: that would charge one person twice for one plan. */}
              <Text style={[styles.planNote, { color: c.mutedForeground }]}>
                Your subscription was bought on freehire.me and is managed there.
              </Text>
              <Pressable onPress={() => void openExternally(WEB_PLAN_URL)} style={styles.linkRow}>
                <Text style={[styles.linkText, { color: c.brandStrong }]}>Open your plan on the web</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Apple expects both on any screen that sells. */}
        <View style={styles.legalRow}>
          <Pressable onPress={() => void openExternally(TERMS_OF_SERVICE_URL)}>
            <Text style={[styles.legalText, { color: c.mutedForeground }]}>Terms</Text>
          </Pressable>
          <Pressable onPress={() => void openExternally(PRIVACY_POLICY_URL)}>
            <Text style={[styles.legalText, { color: c.mutedForeground }]}>Privacy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Space.xs,
    paddingHorizontal: Space.xs,
  },
  backText: { fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 60 },
  scrollContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.xl + 8,
    gap: Space.xl,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.xs,
  },
  planName: { fontSize: 20, fontWeight: '700' },
  planNote: { fontSize: 14, lineHeight: 20 },
  section: { gap: Space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
  },
  optionText: { gap: 2 },
  optionPeriod: { fontSize: 16, fontWeight: '600' },
  optionSaving: { fontSize: 13, fontWeight: '600' },
  optionPrice: { fontSize: 16, fontWeight: '700' },
  allowanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.xs,
    gap: Space.md,
  },
  allowanceLabel: { fontSize: 15, flexShrink: 1 },
  allowanceDetail: { fontSize: 14 },
  notice: { fontSize: 14, lineHeight: 20 },
  linkRow: { paddingVertical: Space.sm },
  linkText: { fontSize: 15, fontWeight: '600' },
  legalRow: { flexDirection: 'row', gap: Space.lg },
  legalText: { fontSize: 13 },
});
