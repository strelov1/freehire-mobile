import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type PurchasesType from 'react-native-purchases';
import type { LOG_LEVEL as LogLevel } from 'react-native-purchases';

/**
 * The two public platform keys, as `app.config.ts` resolved them into `extra`. Validated at
 * build time by `normalizeRevenueCatKeys`; read here without re-validating, because a value
 * that got this far was already checked by the thing that could still stop the build.
 */
export type PurchaseKeys = { ios: string; android: string };

/**
 * The key for one platform, or an empty string where purchases cannot work at all.
 *
 * Web gets nothing on purpose: there is no store to buy from and no native module to buy
 * with, so a key here would only let the purchase surface render and then fail. Absent keys
 * mean a development build — `app.config.ts` refuses that state for preview and production —
 * and a malformed `extra` disables the surface rather than throwing inside whichever screen
 * happened to read it first.
 */
export function resolvePurchaseKey(keys: unknown, platform: typeof Platform.OS): string {
  if (!keys || typeof keys !== 'object') return '';
  const pair = keys as Partial<PurchaseKeys>;

  const value = platform === 'ios' ? pair.ios : platform === 'android' ? pair.android : '';
  return typeof value === 'string' ? value : '';
}

/** The key this build will sell with, or an empty string when it cannot sell. */
export const purchaseKey = resolvePurchaseKey(Constants.expoConfig?.extra?.revenueCat, Platform.OS);

/**
 * Whether this build can take money.
 *
 * A key is necessary and not sufficient — the native module also has to be there — but it is
 * the part every caller can check cheaply, and it is what hides the purchase surface in a
 * development build that was never configured to sell.
 */
export const isPurchasingSupported = purchaseKey !== '';

let cachedModule: typeof PurchasesType | null = null;

/**
 * The purchases SDK, or null where it cannot work.
 *
 * THIS IS THE ONLY FILE IN THE PROJECT THAT IMPORTS `react-native-purchases`, on the shape of
 * `src/lib/notifications.ts`. Everything downstream — the offering model, the plan view, the
 * screen — is ordinary TypeScript that a jest test can drive without a native module, which is
 * the same arrangement that lets `push.test.ts` test notification handling.
 *
 * The require is lazy and guarded even though the SDK is unusually forgiving: in Expo Go it
 * does not throw but enters Preview API Mode and answers with JS mocks. So this guard is about
 * the web build, an unconfigured development build, and failing honestly — not about crashes.
 */
export function getPurchases(): typeof PurchasesType | null {
  if (!isPurchasingSupported) return null;
  if (cachedModule) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = (require('react-native-purchases') as { default: typeof PurchasesType }).default;
    return cachedModule;
  } catch {
    return null;
  }
}

/**
 * How loud the SDK should be, resolved here so that the enum — a VALUE, not a type — is
 * loaded through the same guarded require as everything else. Imported directly it would
 * pull the native module into any file that mentions a log level, which is exactly what this
 * module exists to prevent.
 *
 * WARN rather than the SDK's own default, which is verbose in a debug build: it narrates
 * every cache check and every request, and our own logs end up a few hundred lines down.
 */
export function purchaseLogLevel(): LogLevel {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LOG_LEVEL } = require('react-native-purchases') as typeof import('react-native-purchases');
  return LOG_LEVEL.WARN;
}
