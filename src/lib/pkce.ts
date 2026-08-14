import * as Crypto from 'expo-crypto';

import { secureRandomBytes } from './secureRandom';

/**
 * Converts standard Base64 string to URL-safe Base64 without padding (RFC 4648 §5).
 */
export function base64ToBase64Url(b64: string): string {
  return b64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Converts a Uint8Array byte array to Base64URL string.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');

  return base64ToBase64Url(base64);
}

/**
 * Generates an RFC 7636 §4.1 compliant PKCE Code Verifier.
 *
 * Requirements:
 * - High-entropy cryptographic random string
 * - Length: 43 characters (256 bits / 32 bytes of randomness)
 * - Charset: Base64URL unreserved characters [A-Za-z0-9_-]
 *
 * @returns {string} 43-character base64url string
 */
export function generateVerifier(): string {
  return bytesToBase64Url(secureRandomBytes(32));
}

/**
 * Computes an RFC 7636 §4.2 compliant S256 PKCE Code Challenge.
 *
 * Formula: code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
 *
 * @param verifier - RFC 7636 code verifier string (43-128 chars)
 * @returns {Promise<string>} 43-character base64url SHA-256 challenge string
 */
export async function computeChallenge(verifier: string): Promise<string> {
  if (!verifier || typeof verifier !== 'string') {
    throw new TypeError('PKCE code verifier must be a non-empty string');
  }
  if (!/^[A-Za-z0-9._~-]+$/.test(verifier)) {
    throw new Error('PKCE code verifier contains invalid characters outside RFC 7636 unreserved set');
  }

  let base64Digest = '';
  if (typeof Crypto.digestStringAsync === 'function') {
    base64Digest =
      (await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      )) || '';
  }
  if (!base64Digest && typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return bytesToBase64Url(new Uint8Array(hashBuffer));
  }

  // An empty digest would otherwise travel on as an empty `code_challenge`,
  // turning the exchange into a plain unprotected one.
  if (!base64Digest) {
    throw new Error('No SHA-256 implementation is available to compute the PKCE code challenge');
  }

  return base64ToBase64Url(base64Digest);
}
