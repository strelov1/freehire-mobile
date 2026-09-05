import { normalizeApiBase, normalizeRevenueCatKeys } from './app.config';

describe('release API configuration', () => {
  it('normalizes a valid origin', () => {
    expect(normalizeApiBase('https://freehire.me/', false)).toBe('https://freehire.me');
  });

  it('fails a release config before build when the API base is missing', () => {
    expect(() => normalizeApiBase(undefined, false)).toThrow('required');
  });

  it.each([
    'https://user:pass@freehire.me',
    'https://freehire.me/api',
    'https://freehire.me?x=1',
    'https://freehire.me/#fragment',
    'http://freehire.me',
  ])('rejects a non-origin or insecure release value: %s', (value) => {
    expect(() => normalizeApiBase(value, false)).toThrow();
  });

  it('allows explicit localhost and Android emulator host HTTP during development', () => {
    expect(normalizeApiBase('http://localhost:8080/', true)).toBe('http://localhost:8080');
    expect(normalizeApiBase('http://10.0.2.2:8080/', true)).toBe('http://10.0.2.2:8080');
    expect(() => normalizeApiBase('http://example.test', true)).toThrow();
  });
});

describe('release purchase configuration', () => {
  const keys = { ios: 'appl_abc123', android: 'goog_xyz789' };

  it('accepts a matched pair of platform keys', () => {
    expect(normalizeRevenueCatKeys(keys.ios, keys.android, true)).toEqual(keys);
  });

  it('trims surrounding whitespace, which a copied dashboard value carries', () => {
    expect(normalizeRevenueCatKeys(`  ${keys.ios} `, `\n${keys.android}`, true)).toEqual(keys);
  });

  it('fails a release config before build when a key is missing', () => {
    expect(() => normalizeRevenueCatKeys(undefined, keys.android, true)).toThrow('required');
    expect(() => normalizeRevenueCatKeys(keys.ios, '', true)).toThrow('required');
  });

  // The two keys are interchangeable strings to a human and not to RevenueCat, so swapping
  // them builds cleanly and then fails every purchase on both platforms — in the store, where
  // it costs a review cycle to find out.
  it('rejects keys given for the wrong platform', () => {
    expect(() => normalizeRevenueCatKeys(keys.android, keys.ios, true)).toThrow('appl_');
  });

  it.each(['sk_secret_key', 'appl', 'rcb_public', '12345'])(
    'rejects a value that is not a platform key: %s',
    (value) => {
      expect(() => normalizeRevenueCatKeys(value, keys.android, true)).toThrow();
    },
  );

  // Development builds run without them and simply cannot sell. Demanding them there would
  // make a checkout of this repository unusable to anyone who is not selling anything.
  it('permits absent keys outside a release build', () => {
    expect(normalizeRevenueCatKeys(undefined, undefined, false)).toEqual({ ios: '', android: '' });
  });

  // A key present but wrong is a mistake in every profile, so it is refused everywhere.
  it('still rejects a malformed key outside a release build', () => {
    expect(() => normalizeRevenueCatKeys('sk_oops', undefined, false)).toThrow();
  });
});
