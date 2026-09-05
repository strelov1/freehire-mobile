import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { getPlan, syncStorePurchase } from './api/planApi';
import { confirmPurchase } from './model/confirm';
import { purchaseOptions } from './model/offering';
import { buyPackage, restorePurchases, type PurchaseOutcome, type StoreLike } from './model/purchaseFlow';
import { getPurchases, isPurchasingSupported } from './purchases';
import { useAuth } from '@/lib/authStore';

/**
 * The paywall's dealings with the store.
 *
 * Thin on purpose: what is on sale is a cached read, what buying and restoring DECIDE lives in
 * `model/purchaseFlow`, and the retry policy lives in `model/confirm`. What is left here is the
 * React — a busy flag and a query — because a screen should not be the only place a rule
 * exists, and a rule inside a hook is one this project cannot test.
 */

export type { PurchaseOutcome } from './model/purchaseFlow';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const confirmAgainstServer = () =>
  confirmPurchase({ sync: syncStorePurchase, readPlan: () => getPlan(), wait: sleep });

/**
 * The offering is remote configuration and is the same for everybody, so it is cached like any
 * other read rather than fetched into component state. Not under `privateKeys`: nothing about
 * it belongs to the signed-in account, and clearing it on a session change would refetch for
 * no reason.
 */
const offeringsKey = ['billing', 'offerings'] as const;

const UNAVAILABLE: PurchaseOutcome = {
  kind: 'failed',
  message: 'Purchases are not available in this build.',
};

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
    // the whole staleTime. There is also nothing to sell to somebody who cannot buy: a purchase
    // has to attach to an account.
    //
    // An offering that will not load costs the purchase button and nothing else — the plan
    // state comes from the server and renders regardless, and the screen offers a retry.
    enabled: isPurchasingSupported && !!user,
    staleTime: 5 * 60_000,
  });

  const reloadOptions = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /** Runs one store flow with the busy flag held, or reports that this build cannot sell. */
  const run = useCallback(async (flow: (store: StoreLike) => Promise<PurchaseOutcome>) => {
    const purchases = getPurchases();
    if (!purchases) return UNAVAILABLE;

    setBusy(true);
    try {
      return await flow(purchases as unknown as StoreLike);
    } finally {
      setBusy(false);
    }
  }, []);

  const buy = useCallback(
    (optionId: string) => run((store) => buyPackage(store, optionId, confirmAgainstServer)),
    [run],
  );

  const restore = useCallback(() => run((store) => restorePurchases(store, confirmAgainstServer)), [run]);

  return { options, loadingOptions, busy, reloadOptions, buy, restore };
}
