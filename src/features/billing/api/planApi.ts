import { request } from '@/lib/transport';

/**
 * Where a live Pro plan was bought.
 *
 * It is behavioural rather than informational, which is the only reason the app reads it. A
 * `stripe` subscriber must not be offered an in-app purchase — that charges them twice for
 * one plan — and a `revenuecat` subscriber must be sent to their store to cancel rather than
 * to a web page, which Apple's rules require. `granted` is Pro given by hand: nothing to buy
 * and nothing to cancel.
 *
 * The union is open on purpose. The server may name an origin this build does not know, and
 * an unknown one has to read as "some plan we did not sell here" — never as free, and never
 * as something to sell over.
 */
export type ProSource = 'stripe' | 'revenuecat' | 'granted' | (string & {});

/**
 * One metered feature's standing today.
 *
 * `enforced` is the field that is easy to miss and expensive to ignore: while it is false the
 * server counts the allowance and still runs the action, so `used` may exceed `limit` without
 * anybody being refused. A client that reads `used >= limit` as "blocked" would be wrong, and
 * the API documentation says so explicitly.
 */
export type Allowance = {
  feature: string;
  used: number;
  limit: number;
  unlimited: boolean;
  enforced: boolean;
  resets_at: string;
};

/**
 * The caller's plan, as `GET /api/v1/me/plan` answers it.
 *
 * `pro_until` and `pro_source` are absent together: on the free plan, and on one that has
 * ended. The allowances are the per-feature daily budgets for freehire's metered AI features,
 * which today are reachable from the web rather than from this app — the plan screen shows
 * them anyway, because the plan is one plan across both and a subscriber deciding whether Pro
 * is worth it should see what it lifts.
 */
export type Plan = {
  plan: string;
  resets_at: string;
  pro_until?: string;
  pro_source?: ProSource;
  allowances?: Allowance[];
};

/** The plan the SERVER believes in, which is the only one this app shows. */
export async function getPlan(signal?: AbortSignal): Promise<Plan> {
  const { data } = await request<{ data: Plan }>('/api/v1/me/plan', {
    authMode: 'required',
    signal,
    cache: 'no-store',
  });
  return data;
}

/** What the sync route reports back. */
export type StoreSyncStatus = 'synced' | 'no_subscription';

/**
 * Ask the server to re-read this caller's own store subscription, now.
 *
 * A purchase completes on the device before RevenueCat's webhook reaches the server, and if
 * that delivery is lost the provider stops retrying after 80 minutes — so without this call a
 * buyer can sit in front of a paywall they have already paid at.
 *
 * It carries NO BODY, and that is the contract rather than an omission: the account is the
 * session's, and the server ignores any id sent with the request. There is nothing this
 * client could usefully say.
 */
export async function syncStorePurchase(signal?: AbortSignal): Promise<StoreSyncStatus> {
  const { data } = await request<{ data: { status: StoreSyncStatus } }>(
    '/api/v1/billing/revenuecat/sync',
    { method: 'POST', authMode: 'required', signal, cache: 'no-store' },
  );
  return data.status;
}
