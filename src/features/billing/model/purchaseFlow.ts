import type { ConfirmResult } from './confirm';

/**
 * What buying and restoring actually decide, with no React and no SDK types.
 *
 * It lives here rather than in the hook for the reason everything else in `model/` does: these
 * are the outcomes a buyer meets at the worst possible moment — just after paying — and a rule
 * that only exists inside a hook is a rule this project cannot test. The hook keeps the parts
 * that genuinely need React: the busy flag and the cached offering.
 */

export type PurchaseOutcome =
  /** The server agrees: the account is Pro. */
  | { kind: 'confirmed' }
  /** Paid, and the server has not caught up yet. The reconciler finishes it. */
  | { kind: 'pending' }
  /** The buyer backed out of the store's own sheet. Not an error, and not shown as one. */
  | { kind: 'cancelled' }
  /** The store handed nothing back for this account. */
  | { kind: 'nothing_to_restore' }
  | { kind: 'failed'; message: string };

/** The parts of the purchases SDK these flows use, as a shape rather than a type. */
export type StoreLike = {
  getOfferings(): Promise<{ current?: { availablePackages: { identifier: string }[] } | null }>;
  purchasePackage(pkg: unknown): Promise<unknown>;
  restorePurchases(): Promise<unknown>;
};

/** Asks the server whether the account is now Pro, and how sure we are. */
export type Confirm = () => Promise<ConfirmResult>;

export async function buyPackage(
  store: StoreLike,
  optionId: string,
  confirm: Confirm,
): Promise<PurchaseOutcome> {
  return guarded(async () => {
    const offerings = await store.getOfferings();
    const target = offerings.current?.availablePackages.find((p) => p.identifier === optionId);
    if (!target) return { kind: 'failed', message: 'That plan is no longer offered.' };

    await store.purchasePackage(target);
    return { kind: await confirm() };
  });
}

/**
 * Restoring is required by Apple of anything selling a subscription, and it is also the
 * recovery path for a reinstall, a new device, or a purchase whose webhook was lost.
 *
 * The STORE says whether anything came back; the SERVER says whether it confers. Both are
 * asked, and neither is asked the other's question — collapsing them told a subscriber whose
 * entitlement the server had not caught up with that they owned nothing, which is the one case
 * this path exists to serve.
 */
export async function restorePurchases(store: StoreLike, confirm: Confirm): Promise<PurchaseOutcome> {
  return guarded(async () => {
    const info = await store.restorePurchases();
    if (!hasActiveEntitlement(info)) return { kind: 'nothing_to_restore' };
    return { kind: await confirm() };
  });
}

/** The failure handling both share: a dismissed sheet is not an error, and the store's own
 *  words beat any we could invent. */
async function guarded(op: () => Promise<PurchaseOutcome>): Promise<PurchaseOutcome> {
  try {
    return await op();
  } catch (error) {
    if (isUserCancellation(error)) return { kind: 'cancelled' };
    return { kind: 'failed', message: purchaseErrorMessage(error) };
  }
}

/**
 * Whether the store found anything to restore.
 *
 * This is the ONE thing CustomerInfo is asked, and it is not an entitlement decision: it
 * answers "did the store hand anything back". What the account is on comes from `/me/plan` and
 * from nowhere else.
 */
function hasActiveEntitlement(info: unknown): boolean {
  if (!info || typeof info !== 'object') return false;
  const active = (info as { entitlements?: { active?: unknown } }).entitlements?.active;
  return !!active && typeof active === 'object' && Object.keys(active).length > 0;
}

/** The SDK reports a buyer backing out of the store sheet as an error carrying this flag. */
function isUserCancellation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'userCancelled' in error
    ? Boolean((error as { userCancelled?: unknown }).userCancelled)
    : false;
}

/**
 * A message written here would have to guess at what went wrong — a declined card, an
 * unavailable product, a parental restriction — and the store already knows and says so in the
 * buyer's own language.
 */
function purchaseErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'The purchase could not be completed.';
}
