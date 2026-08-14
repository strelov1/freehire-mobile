import * as Crypto from 'expo-crypto';

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
  let bytes: Uint8Array;
  if (typeof Crypto.getRandomBytes === 'function') {
    bytes = Crypto.getRandomBytes(32);
  } else if (typeof globalThis.crypto?.getRandomValues === 'function') {
    bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  } else {
    bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
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
    hexDigest = bytesToHex(new Uint8Array(hashBuffer));
    return hexDigest.toLowerCase();
  }

  return hexDigest.toLowerCase();
}
