import Constants from 'expo-constants';

import { DEFAULT_DEVELOPMENT_API_BASE, DEFAULT_PRODUCTION_API_BASE, normalizeApiBase } from './apiBase';

/**
 * Resolves the origin that `app.config.ts` already validated at build time, so
 * the fallback path here is unreachable in a real build. It stays reachable in
 * Expo Go and in tests, where no config was generated — hence a fallback rather
 * than a crash on launch. The rules themselves live in `apiBase.ts`; this file
 * only decides what to do when a value fails them.
 */
export function validateApiBase(value: unknown, allowLocalHttp: boolean): string {
  try {
    return normalizeApiBase(typeof value === 'string' ? value : undefined, allowLocalHttp);
  } catch {
    return allowLocalHttp ? DEFAULT_DEVELOPMENT_API_BASE : DEFAULT_PRODUCTION_API_BASE;
  }
}

const configuredApiBase = Constants.expoConfig?.extra?.apiBase;

/** Public API origin embedded in the Expo config. It is never a secret. */
export const apiBase = validateApiBase(configuredApiBase, __DEV__);
