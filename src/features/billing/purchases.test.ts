import { resolvePurchaseKey } from './purchases';

const keys = { ios: 'appl_abc', android: 'goog_xyz' };

describe('resolvePurchaseKey', () => {
  it('gives each platform its own key', () => {
    expect(resolvePurchaseKey(keys, 'ios')).toBe(keys.ios);
    expect(resolvePurchaseKey(keys, 'android')).toBe(keys.android);
  });

  // The web build has no store to buy from, and RevenueCat's native module is not there. A
  // key returned here would only mean the purchase surface renders and then fails.
  it('gives web nothing', () => {
    expect(resolvePurchaseKey(keys, 'web')).toBe('');
  });

  // A development build runs without keys and simply cannot sell — app.config.ts already
  // refuses that state for preview and production, so reaching here means development.
  it('reports no key when the config carries none', () => {
    expect(resolvePurchaseKey({ ios: '', android: '' }, 'ios')).toBe('');
    expect(resolvePurchaseKey(undefined, 'ios')).toBe('');
  });

  // The config is read at runtime out of `extra`, which is plain JSON by the time it arrives,
  // so its shape is an assumption rather than a guarantee. A malformed one disables the
  // surface instead of crashing the screen that reads it.
  it('survives a config of the wrong shape', () => {
    expect(resolvePurchaseKey({ ios: 42 } as never, 'ios')).toBe('');
    expect(resolvePurchaseKey('nope' as never, 'ios')).toBe('');
  });
});
