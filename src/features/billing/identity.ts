import { identityAction } from './model/identity';
import { getPurchases, isPurchasingSupported, purchaseKey } from './purchases';

/**
 * Who the purchases SDK currently believes it is serving, as a `users.id` string.
 *
 * Module state rather than React state, because the SDK is a process-wide singleton and the
 * question "who is this device buying for" outlives every screen. A component holding it
 * would answer differently depending on what happened to be mounted.
 */
let identified: string | null = null;

let configured = false;

/**
 * Ties the purchases SDK to the signed-in account, or clears it.
 *
 * CALLED FROM THE SESSION TRANSITION, never from a screen. That is the whole point: an
 * identity set when the paywall opens leaves the previous `app_user_id` in place until
 * somebody happens to visit that screen, and a purchase in between is attached to the wrong
 * account at RevenueCat — permanently, because the provider holds the attribution and we do
 * not.
 *
 * It never throws. A failure here means a later purchase may be attributed wrongly, which is
 * worth a log and is not worth taking the session transition down for — the transition also
 * clears the previous account's cached data, and that must happen either way.
 */
export async function syncPurchaseIdentity(userId: number | null): Promise<void> {
  if (!isPurchasingSupported) return;

  const next = userId === null ? null : String(userId);
  const action = identityAction(identified, next);
  if (action === 'none') return;

  const purchases = getPurchases();
  if (!purchases) return;

  try {
    // Configured once, lazily, on the first identity we are given. Not at import time: the
    // module is loaded by anything that touches billing, and configuring a payments SDK is a
    // side effect an import should not have.
    if (!configured) {
      purchases.configure({ apiKey: purchaseKey });
      configured = true;
    }

    if (action === 'logout') {
      await purchases.logOut();
    } else if (next !== null) {
      await purchases.logIn(next);
    }
    identified = next;
  } catch (error) {
    // Deliberately not rethrown, and deliberately not silent.
    console.warn('purchases: could not change the buying identity', error);
  }
}
