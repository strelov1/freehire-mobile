import type { Plan, StoreSyncStatus } from '../api/planApi';
import { planView } from './planView';

/**
 * Turning a completed store purchase into a plan the server agrees with.
 *
 * The gap this closes is real and short: the purchase finishes on the device, and RevenueCat's
 * webhook reaches the server afterwards. Asking the server to re-read immediately usually
 * closes it in one round trip; retrying covers the case where the store itself has not told
 * RevenueCat yet.
 *
 * It is a plain function over injected effects rather than a hook, so the retry rule — which
 * is the part that decides what a buyer sees after paying — is testable without a native
 * module, a network, or a clock.
 */

/** How many times the plan is read before the screen stops waiting. */
const ATTEMPTS = 4;

/** Growing gaps: the first read usually succeeds, and the later ones are worth waiting for. */
const BACKOFF_MS = [500, 1500, 3000];

export type ConfirmResult =
  /** The server agrees the account is Pro. */
  | 'confirmed'
  /** The purchase went through and the server has not caught up. Not a failure. */
  | 'pending';

export type ConfirmDeps = {
  /** Asks the server to re-read this caller's own store subscription. */
  sync: () => Promise<StoreSyncStatus>;
  readPlan: () => Promise<Plan>;
  wait: (ms: number) => Promise<void>;
};

export async function confirmPurchase({ sync, readPlan, wait }: ConfirmDeps): Promise<ConfirmResult> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // A sync that fails is not a failed purchase — the store has the money and the server's
    // hourly reconciler will find it — so the plan is read regardless. `no_subscription`
    // right after a purchase means the store has not told RevenueCat yet, which is the
    // ordinary racing case rather than an answer to stop on.
    try {
      await sync();
    } catch {
      // Deliberately ignored; the plan read below is the thing that decides.
    }

    try {
      const plan = await readPlan();
      if (planView({ plan, canPurchase: false }).kind === 'pro') return 'confirmed';
    } catch {
      // Offline, or a server that answered badly. Same treatment as a free answer: try again.
    }

    const pause = BACKOFF_MS[attempt];
    if (pause !== undefined) await wait(pause);
  }

  // Bounded on purpose. Money has been taken, so the screen owes the buyer a plain sentence
  // rather than a spinner that never resolves — and the reconciler closes this within the
  // hour whether the app is open or not.
  return 'pending';
}
