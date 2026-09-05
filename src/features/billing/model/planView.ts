import type { Plan } from '../api/planApi';
import { formatDate } from '@/lib/format';

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

  if (!isProLive(plan)) {
    return { kind: 'free', offersPurchase: canPurchase, offersRestore: canPurchase, manageAt: 'nowhere' };
  }

  return {
    kind: 'pro',
    // Absent when the server named a tier it could not date. The plan still stands; only
    // "until when" is unknown, and the screen says so rather than inventing a day.
    proUntil: liveUntil(plan.pro_until),
    offersPurchase: false,
    offersRestore: canPurchase,
    manageAt: manageAtFor(plan.pro_source),
  };
}

/**
 * Whether the server says this account is on Pro right now.
 *
 * TWO SOURCES, and the second is not belt-and-braces. `pro_until` is the usual answer and the
 * only one that carries a date. But the server names the tier separately, and it can answer
 * `plan: "pro"` with no expiry — its plan surface reads the tier and the dates through
 * different queries, and the second can fail on its own. Reading only the date turns that into
 * "free", and a free-looking Pro subscriber is offered the purchase they already own.
 *
 * So a tier of "pro" confers even with no readable date. The direction matters: being wrong
 * here costs a subscriber a plan they paid for, or charges them for it twice.
 */
export function isProLive(plan: Plan | undefined): boolean {
  if (!plan) return false;

  // A READABLE date wins, in both directions. It is the authoritative answer and the only one
  // that can lapse: a response held in cache across the instant it expired still says
  // `plan: "pro"`, and trusting the tier there would leave somebody unable to buy again
  // because the app insists they already have it.
  const parsed = plan.pro_until ? new Date(plan.pro_until) : undefined;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.getTime() > Date.now();

  // No date, or one that will not parse. Now the tier is all there is, and it is believed:
  // reading it as free would offer the purchase to somebody already paying.
  return plan.plan === 'pro';
}

/** What a surface calls the plan, and what it says underneath. */
export type PlanHeadline = { title: string; detail: string };

/**
 * One wording for every state, so the two surfaces that show a plan cannot describe the same
 * account differently.
 *
 * They did: the profile row said "Free plan" where the plan screen said "Free", each through
 * its own chain of ternaries. Two places rendering one fact is how the wordings drift, and
 * drift is how a screen ends up saying something the other contradicts.
 */
export function planHeadline(view: PlanView): PlanHeadline {
  switch (view.kind) {
    case 'pro':
      return {
        title: 'freehire Pro',
        detail: view.proUntil ? `Active until ${formatDate(view.proUntil.toISOString())}` : 'Active',
      };
    case 'free':
      return { title: 'Free plan', detail: 'Everything freehire does, with daily limits.' };
    case 'signed_out':
      return {
        title: 'Sign in to see your plan',
        detail: 'A plan belongs to an account, so there is nothing to show yet.',
      };
    case 'unavailable':
      return { title: 'Plan unavailable', detail: 'We could not read your plan just now.' };
    case 'loading':
      return { title: 'Plan', detail: 'Loading…' };
  }
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
