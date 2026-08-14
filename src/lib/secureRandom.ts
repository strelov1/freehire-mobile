import * as Crypto from 'expo-crypto';

/**
 * Cryptographically secure random bytes, from `expo-crypto` on device and from
 * WebCrypto everywhere else (web, Jest). There is deliberately no `Math.random`
 * fallback: a PKCE verifier or an Apple nonce built from a predictable source
 * silently voids the guarantee it exists for, so an unavailable CSPRNG has to
 * fail the sign-in rather than weaken it.
 */
export function secureRandomBytes(length: number): Uint8Array {
  if (typeof Crypto.getRandomBytes === 'function') {
    return Crypto.getRandomBytes(length);
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(new Uint8Array(length));
  }
  throw new Error('No cryptographically secure random source is available on this platform');
}
