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
 * `required` is true for preview and production. A development build without keys simply
 * cannot sell, which is right: a checkout of this repository should run for somebody who is
 * not selling anything. A key that is PRESENT but malformed is refused in every profile,
 * because that is a mistake rather than an absence.
 *
 * @param {string | undefined} ios
 * @param {string | undefined} android
 * @param {boolean} required
 * @returns {{ ios: string, android: string }}
 */
function normalizeRevenueCatKeys(ios, android, required) {
  const pair = {
    ios: normalizeOne(ios, IOS_KEY_PREFIX, 'EXPO_PUBLIC_REVENUECAT_IOS_KEY', required),
    android: normalizeOne(android, ANDROID_KEY_PREFIX, 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', required),
  };
  return pair;
}

/**
 * @param {string | undefined} value
 * @param {string} prefix
 * @param {string} name
 * @param {boolean} required
 * @returns {string}
 */
function normalizeOne(value, prefix, name, required) {
  const candidate = (value || '').trim();

  if (!candidate) {
    if (required) {
      throw new Error(`${name} is required for preview and production builds`);
    }
    return '';
  }

  // Length as well as prefix: `appl_` on its own carries the shape and none of the key, and a
  // truncated paste is a plausible way to get one.
  if (!candidate.startsWith(prefix) || candidate.length <= prefix.length) {
    throw new Error(`${name} must be a RevenueCat platform key beginning with ${prefix}`);
  }
  return candidate;
}

module.exports = { normalizeRevenueCatKeys, IOS_KEY_PREFIX, ANDROID_KEY_PREFIX };
