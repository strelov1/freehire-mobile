import Constants from 'expo-constants';

const DEVELOPMENT_API_BASE = 'http://localhost:8080';
const PRODUCTION_API_BASE = 'https://freehire.me';

export function validateApiBase(value: unknown, allowLocalHttp: boolean): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) {
    return allowLocalHttp ? DEVELOPMENT_API_BASE : PRODUCTION_API_BASE;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    if (allowLocalHttp) return DEVELOPMENT_API_BASE;
    return PRODUCTION_API_BASE;
  }

  const isLocalhost =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '10.0.2.2';
  if (parsed.protocol !== 'https:' && !(allowLocalHttp && isLocalhost && parsed.protocol === 'http:')) {
    if (allowLocalHttp) return DEVELOPMENT_API_BASE;
    return PRODUCTION_API_BASE;
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    if (allowLocalHttp) return DEVELOPMENT_API_BASE;
    return PRODUCTION_API_BASE;
  }
  return parsed.origin;
}

const configuredApiBase = Constants.expoConfig?.extra?.apiBase;

/** Public API origin embedded in the Expo config. It is never a secret. */
export const apiBase = validateApiBase(configuredApiBase, __DEV__);
