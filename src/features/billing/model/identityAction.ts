/** What the purchases SDK should be told, given who it currently believes it is serving. */
export type IdentityAction = 'none' | 'login' | 'logout';

/**
 * Decides whether the purchases SDK needs re-identifying.
 *
 * Separated from the call so the rule can be tested without a native module, and because the
 * rule is the part that matters: a purchase is attributed to whoever the SDK thinks it is
 * serving, at RevenueCat, permanently. The case worth naming is the third one — one device,
 * two people. Without the switch, everything the second buys is attached to the first.
 *
 * Doing nothing when the identity has not moved is not an optimisation either: session state
 * changes for reasons that are not identity changes — a refresh, a recovered connection — and
 * each would otherwise be a call into the SDK for no reason.
 */
export function identityAction(current: string | null, next: string | null): IdentityAction {
  if (current === next) return 'none';
  return next === null ? 'logout' : 'login';
}
