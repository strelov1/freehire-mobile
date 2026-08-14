import * as Crypto from 'expo-crypto';

import { secureRandomBytes } from './secureRandom';

jest.mock('expo-crypto', () => ({}));

describe('secureRandomBytes', () => {
  const realCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
  });

  it('uses expo-crypto when the native module is present', () => {
    const getRandomBytes = jest.fn(() => new Uint8Array([1, 2, 3]));
    (Crypto as unknown as { getRandomBytes: unknown }).getRandomBytes = getRandomBytes;

    expect(secureRandomBytes(3)).toEqual(new Uint8Array([1, 2, 3]));
    expect(getRandomBytes).toHaveBeenCalledWith(3);

    delete (Crypto as unknown as { getRandomBytes?: unknown }).getRandomBytes;
  });

  it('falls back to WebCrypto when expo-crypto is unavailable', () => {
    expect(secureRandomBytes(8)).toHaveLength(8);
  });

  it('throws rather than degrading to a predictable source', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

    expect(() => secureRandomBytes(32)).toThrow('secure random');
  });
});
