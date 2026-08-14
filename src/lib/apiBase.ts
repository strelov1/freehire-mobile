export const DEFAULT_DEVELOPMENT_API_BASE = 'http://localhost:8080';
export const DEFAULT_PRODUCTION_API_BASE = 'https://freehire.me';

/**
 * The single rule for what may serve as the API origin, shared by the build-time
 * Expo config and the runtime client so the two can never drift apart. It throws
 * on anything invalid; the build fails on that, while the runtime falls back (see
 * `config.ts`) because a validated value has already been baked into the config.
 *
 * Accepts an origin only: HTTPS everywhere, plus plain HTTP on localhost and the
 * Android emulator host during development. Credentials, a path, a query, or a
 * fragment are all rejected — every caller appends its own path.
 */
export function normalizeApiBase(value: string | undefined, allowLocalHttp: boolean): string {
  const candidate = value?.trim() || (allowLocalHttp ? DEFAULT_DEVELOPMENT_API_BASE : '');
  if (!candidate) {
    throw new Error('EXPO_PUBLIC_API_BASE is required for preview and production builds');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE must be a valid URL origin');
  }

  const isLocalhost =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '10.0.2.2';
  const allowedProtocol = parsed.protocol === 'https:' || (allowLocalHttp && isLocalhost && parsed.protocol === 'http:');
  if (!allowedProtocol) {
    throw new Error('EXPO_PUBLIC_API_BASE must use HTTPS (development may use localhost HTTP)');
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('EXPO_PUBLIC_API_BASE must be an origin without credentials, path, query, or fragment');
  }

  return parsed.origin;
}
