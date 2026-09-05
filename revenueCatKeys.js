// CommonJS at the repo root, for the same reason apiBase.js is — read that file's header
// first. `app.config.ts` is transpiled on its own by Expo, so anything it imports must be
// resolvable by plain Node; a `./src/lib/*.ts` import takes `expo start`, `expo config` and
// every EAS build down with it. A .js file is the one shape both that loader and Metro read,
// which is what lets the build-time check and the runtime client share one definition.

/** The prefix RevenueCat gives an iOS platform key. */
const IOS_KEY_PREFIX = 'appl_';
/** The prefix RevenueCat gives an Android platform key. */
const ANDROID_KEY_PREFIX = 'goog_';

/**
 * The rule for the two RevenueCat platform keys.
 *
 * These are PUBLIC by design and are meant to ship inside the binary — they can start a
 * purchase and read a customer's own entitlements, and nothing else. The secret `sk_` key,
 * which can grant and revoke, stays on the server and must never appear here. Rejecting
 * anything without a platform prefix is partly what enforces that: a secret key pasted into
 * the wrong variable fails the build rather than shipping to every device.
 *
 * The prefixes are also checked PER PLATFORM, because the two values are interchangeable
 * strings to a human and are not interchangeable to RevenueCat. Swapped, they build cleanly
 * and then fail every purchase on both platforms — discovered in the store, a review cycle
 * later.
 *
 * ABSENCE IS ALLOWED IN EVERY PROFILE, and that is a correction. The first draft failed a
 * preview or production build without keys, reasoning that a release which cannot sell is a
 * bad release. It made a coherent state into a broken build: the app already handles "this
 * build cannot sell" — `isPurchasingSupported` is false, the purchase surface is absent, the
 * plan still shows — and that state is tested. What the guard actually did was block every
 * release of an app whose store integration is deliberately not configured yet.
 *
 * So absence is reported loudly and allowed. A key that is PRESENT but malformed is still
 * refused in every profile, because that is a mistake rather than a decision, and it is the
 * case that would otherwise ship: a build that believes it can sell and cannot.
 *
 * @param {string | undefined} ios
 * @param {string | undefined} android
 * @param {boolean} release whether this is a preview or production build
 * @returns {{ ios: string, android: string }}
 */
function normalizeRevenueCatKeys(ios, android, release) {
  const pair = {
    ios: normalizeOne(ios, IOS_KEY_PREFIX, 'EXPO_PUBLIC_REVENUECAT_IOS_KEY'),
    android: normalizeOne(android, ANDROID_KEY_PREFIX, 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'),
  };

  // Said once, on the build log, where somebody cutting a release will see it. Not thrown:
  // shipping without a store integration is a legitimate state and was the only state this
  // app had until now.
  if (release && (!pair.ios || !pair.android)) {
    console.warn(
      '[app.config] No RevenueCat platform keys — this build cannot sell, and its purchase ' +
        'surface will be absent. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and ' +
        'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY to enable it.',
    );
  }
  return pair;
}

/**
 * @param {string | undefined} value
 * @param {string} prefix
 * @param {string} name
 * @returns {string}
 */
function normalizeOne(value, prefix, name) {
  const candidate = (value || '').trim();
  if (!candidate) return '';

  // Length as well as prefix: `appl_` on its own carries the shape and none of the key, and a
  // truncated paste is a plausible way to get one.
  if (!candidate.startsWith(prefix) || candidate.length <= prefix.length) {
    throw new Error(`${name} must be a RevenueCat platform key beginning with ${prefix}`);
  }
  return candidate;
}

module.exports = { normalizeRevenueCatKeys };
