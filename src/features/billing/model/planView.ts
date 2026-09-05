import type { Plan } from '../api/planApi';

/**
 * What the plan screen shows, decided in one place.
 *
 * This is where the store rules live, and they are rules rather than presentation: offering
 * an in-app purchase to somebody already paying through Stripe charges them twice for one
 * plan, and telling an in-app subscriber to cancel on a web page breaks Apple's own. Both are
 * decided from `pro_source`, which is exactly why the server sends it.
 *
 * It is a pure function of the server's answer, deliberately. Nothing here reads the
 * purchases SDK: the app shows the plan the SERVER believes in, because the web and the app
 * share one plan and only the server sees both — and a refund the store processed an hour ago
 * is in the server's answer whether or not it is in a cached CustomerInfo.
 */

/** Where a subscriber changes or cancels their plan. */
export type ManageAt =
  /** Their own App Store or Google Play subscriptions screen. */
  | 'store'
  /** The web account, where the card was entered. */
  | 'web'
  /** Nothing to manage: a granted plan, or an origin this build does not know. */
  | 'nowhere';

export type PlanView = {
  kind: 'signed_out' | 'loading' | 'unavailable' | 'free' | 'pro';
  /** When Pro runs out, for a live plan only. */
  proUntil?: Date;
  /**
   * Whether to show the purchase at all. False whenever the plan is unknown, already paid
   * for somewhere else, or this build cannot sell — never merely because a button would look
   * redundant.
   */
  offersPurchase: boolean;
  /**
   * Whether to offer restoring purchases. Apple requires the option of anything selling a
   * subscription, and it stays available to somebody already on Pro — a second device or a
   * reinstall is exactly when it is wanted.
   *
   * It is NOT offered signed out. A restore with no identity attaches whatever it finds to an
   * anonymous provider user, which is the attribution failure the whole identity mechanism
   * exists to prevent.
   */
  offersRestore: boolean;
  manageAt: ManageAt;
};

export type PlanViewInput = {
  plan: Plan | undefined;
  /** Whether this build can take money: keys present, native module reachable. */
  canPurchase: boolean;
  /**
   * Whether anybody is signed in. Defaults to true so the pure callers that only ask about a
   * plan they already hold — `confirmPurchase`, the profile row — need not say so.
   */
  signedIn?: boolean;
  /** The plan request failed. Distinct from "not yet arrived". */
  failed?: boolean;
};

export function planView({ plan, canPurchase, signedIn = true, failed }: PlanViewInput): PlanView {
  // Reached by deep link, which the profile row's own gating cannot prevent. Without this the
  // screen waits for a plan that is never requested — `usePlan` is disabled without a user, so
  // the answer never arrives and never fails, and "loading" would be forever.
  if (!signedIn) {
    return { kind: 'signed_out', offersPurchase: false, offersRestore: false, manageAt: 'nowhere' };
  }

  if (!plan) {
    // Neither state may sell. A purchase offered against a plan we could not read is how
    // somebody already paying gets charged a second time.
    return {
      kind: failed ? 'unavailable' : 'loading',
      offersPurchase: false,
      offersRestore: canPurchase,
      manageAt: 'nowhere',
    };
  }

  const proUntil = liveUntil(plan.pro_until);
  if (!proUntil) {
    return { kind: 'free', offersPurchase: canPurchase, offersRestore: canPurchase, manageAt: 'nowhere' };
  }

  return {
    kind: 'pro',
    proUntil,
    offersPurchase: false,
    offersRestore: canPurchase,
    manageAt: manageAtFor(plan.pro_source),
  };
}

/**
 * The expiry, if it is readable and still ahead.
 *
 * The server omits `pro_until` once a plan has ended, so this is belt and braces — but the
 * response can be held in a cache across the instant it lapses, and a plan that has run out
 * must read as free wherever it is read.
 */
function liveUntil(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return undefined;
  return at.getTime() > Date.now() ? at : undefined;
}

/**
 * An origin this build does not know sends the subscriber nowhere.
 *
 * Guessing would be worse than silence in both directions: naming the store for a plan bought
 * elsewhere sends them somewhere with nothing to cancel, and naming the web for a store
 * subscription is the thing Apple forbids.
 */
function manageAtFor(source: string | undefined): ManageAt {
  if (source === 'revenuecat') return 'store';
  if (source === 'stripe') return 'web';
  return 'nowhere';
}
