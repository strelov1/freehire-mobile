import * as Crypto from 'expo-crypto';

import { secureRandomBytes } from './secureRandom';

/**
 * Converts a Uint8Array byte array into a lowercase hexadecimal string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Generates a 32-byte (256-bit) cryptographically random raw nonce.
 *
 * Output: 64-character lowercase hex string.
 * Used for Apple Sign-In authentication flow.
 *
 * @returns {string} 64-character hex string
 */
export function generateNonce(): string {
  return bytesToHex(secureRandomBytes(32));
}

/**
 * Computes the SHA-256 hex digest of an input string.
 *
 * Output: 64-character lowercase hex string.
 * Used to calculate the `nonce_challenge` for Apple Sign-In (`sha256Hex(raw_nonce)`).
 *
 * @param input - The raw nonce string (or any text input)
 * @returns {Promise<string>} 64-character hex string digest
 */
export async function sha256Hex(input: string): Promise<string> {
  if (!input || typeof input !== 'string') {
    throw new TypeError('SHA256 input must be a non-empty string');
  }

  let hexDigest = '';
  if (typeof Crypto.digestStringAsync === 'function') {
    hexDigest =
      (await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        input,
        { encoding: Crypto.CryptoEncoding.HEX }
      )) || '';
  }
  if (!hexDigest && typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(hashBuffer)).toLowerCase();
  }

  // Apple binds the credential to whatever nonce we hand it; an empty digest
  // here would ship a credential nobody can verify against the raw nonce.
  if (!hexDigest) {
    throw new Error('No SHA-256 implementation is available to compute the Apple nonce challenge');
  }

  return hexDigest.toLowerCase();
}
