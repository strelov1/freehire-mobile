import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { getPlan, syncStorePurchase } from './api/planApi';
import { confirmPurchase } from './model/confirm';
import { purchaseOptions } from './model/offering';
import { getPurchases, isPurchasingSupported } from './purchases';
import { useAuth } from '@/lib/authStore';

/**
 * The paywall's dealings with the store: what is on sale, buying it, and restoring what was
 * already bought.
 *
 * The rules it leans on live in `model/` and are tested there. What is here is the part that
 * genuinely needs the SDK, kept as thin as it can be — a screen should not be the only place
 * a retry policy exists.
 */

export type PurchaseOutcome =
  /** The server agrees: the account is Pro. */
  | { kind: 'confirmed' }
  /** Paid, and the server has not caught up yet. The reconciler finishes it. */
  | { kind: 'pending' }
  /** The buyer backed out of the store's own sheet. Not an error, and not shown as one. */
  | { kind: 'cancelled' }
  /** Nothing to restore for this account. */
  | { kind: 'nothing_to_restore' }
  | { kind: 'failed'; message: string };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const confirmAgainstServer = () =>
  confirmPurchase({ sync: syncStorePurchase, readPlan: () => getPlan(), wait: sleep });

/**
 * The offering is remote configuration and is the same for everybody, so it is cached like
 * any other read rather than fetched into component state. Not under `privateKeys`: nothing
 * about it belongs to the signed-in account, and clearing it on a session change would refetch
 * for no reason.
 */
const offeringsKey = ['billing', 'offerings'] as const;

export function usePurchase() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const {
    data: options = [],
    isLoading: loadingOptions,
    refetch,
  } = useQuery({
    queryKey: offeringsKey,
    queryFn: async () => {
      const purchases = getPurchases();
      if (!purchases) return [];
      const offerings = await purchases.getOfferings();
      return purchaseOptions(offerings.current);
    },
    // Signed in as well as configured, and the account half is an ORDERING requirement rather
    // than a nicety. The SDK is configured lazily on the first identity change, so nobody
    // signed in means nobody has configured it — and asking an unconfigured SDK for offerings
    // fails for a reason that has nothing to do with the offering, then sits in this cache for
    // the whole staleTime. There is also nothing to sell to somebody who cannot buy: a
    // purchase has to attach to an account.
    //
    // An offering that will not load costs the purchase button and nothing else — the plan
    // state comes from the server and renders regardless, and the screen offers a retry.
    enabled: isPurchasingSupported && !!user,
    staleTime: 5 * 60_000,
  });

  const reloadOptions = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const buy = useCallback(async (optionId: string): Promise<PurchaseOutcome> => {
    const purchases = getPurchases();
    if (!purchases) return { kind: 'failed', message: 'Purchases are not available in this build.' };

    setBusy(true);
    try {
      const offerings = await purchases.getOfferings();
      const target = offerings.current?.availablePackages.find((p) => p.identifier === optionId);
      if (!target) return { kind: 'failed', message: 'That plan is no longer offered.' };

      await purchases.purchasePackage(target);
      return { kind: await confirmAgainstServer() };
    } catch (error) {
      // The SDK reports a user backing out of the store sheet as an error carrying this flag.
      // It is the most common outcome of opening a paywall and must not be shown as a failure.
      if (isUserCancellation(error)) return { kind: 'cancelled' };
      return { kind: 'failed', message: purchaseErrorMessage(error) };
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Restoring is required by Apple of anything selling a subscription, and it is also the
   * recovery path for a reinstall, a new device, or a purchase whose webhook was lost.
   */
  const restore = useCallback(async (): Promise<PurchaseOutcome> => {
    const purchases = getPurchases();
    if (!purchases) return { kind: 'failed', message: 'Purchases are not available in this build.' };

    setBusy(true);
    try {
      await purchases.restorePurchases();
      // Confirmed the same way a new purchase is: the store's answer is not the plan, the
      // server's is.
      const outcome = await confirmAgainstServer();
      return outcome === 'confirmed' ? { kind: 'confirmed' } : { kind: 'nothing_to_restore' };
    } catch (error) {
      if (isUserCancellation(error)) return { kind: 'cancelled' };
      return { kind: 'failed', message: purchaseErrorMessage(error) };
    } finally {
      setBusy(false);
    }
  }, []);

  return { options, loadingOptions, busy, reloadOptions, buy, restore };
}

function isUserCancellation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'userCancelled' in error
    ? Boolean((error as { userCancelled?: unknown }).userCancelled)
    : false;
}

/**
 * The store's own words where there are any.
 *
 * A message written here would have to guess at what went wrong — a declined card, an
 * unavailable product, a parental restriction — and the store already knows and says so in
 * the buyer's language.
 */
function purchaseErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'The purchase could not be completed.';
}
