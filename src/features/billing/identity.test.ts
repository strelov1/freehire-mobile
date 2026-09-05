// The `mock` prefix is not decoration: jest hoists `jest.mock` above the imports, and its
// factory may only close over names beginning with it.
const mockLogIn = jest.fn(async () => {});
const mockLogOut = jest.fn(async () => {});
const mockConfigure = jest.fn();

jest.mock('./purchases', () => ({
  isPurchasingSupported: true,
  purchaseKey: 'appl_test',
  getPurchases: () => ({ configure: mockConfigure, logIn: mockLogIn, logOut: mockLogOut }),
}));

/**
 * A fresh copy of the module for each test.
 *
 * Who the SDK is serving is module state, because the SDK is a process-wide singleton and the
 * question outlives every screen. Resetting it needs a fresh module rather than an exported
 * reset function: a test seam exported from production code is a hole in the API for the
 * benefit of nobody outside it, and `jest.resetModules` already does the job.
 */
function loadIdentity() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./identity') as typeof import('./identity');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncPurchaseIdentity', () => {
  it('identifies the buyer with their own account id', async () => {
    const { syncPurchaseIdentity } = loadIdentity();
    await syncPurchaseIdentity(7);
    expect(mockLogIn).toHaveBeenCalledWith('7');
  });

  it('configures the SDK once, on the first identity rather than at import', async () => {
    const { syncPurchaseIdentity } = loadIdentity();
    await syncPurchaseIdentity(7);
    await syncPurchaseIdentity(null);
    await syncPurchaseIdentity(9);
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });

  it('clears the identity when the session ends', async () => {
    const { syncPurchaseIdentity } = loadIdentity();
    await syncPurchaseIdentity(7);
    await syncPurchaseIdentity(null);
    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });

  // One device, two people. Without this, everything the second buys is attached to the first
  // at RevenueCat — permanently, because the provider holds the attribution and we do not.
  it('does not let a second account inherit the first', async () => {
    const { syncPurchaseIdentity } = loadIdentity();
    await syncPurchaseIdentity(7);
    await syncPurchaseIdentity(null);
    mockLogIn.mockClear();

    await syncPurchaseIdentity(9);
    expect(mockLogIn).toHaveBeenCalledWith('9');
    expect(mockLogIn).toHaveBeenCalledTimes(1);
  });

  // Session state changes for reasons that are not identity changes — a refresh, a recovered
  // connection — and each would otherwise be a call into the SDK.
  it('says nothing to the SDK when the identity has not moved', async () => {
    const { syncPurchaseIdentity } = loadIdentity();
    await syncPurchaseIdentity(7);
    mockLogIn.mockClear();

    await syncPurchaseIdentity(7);
    expect(mockLogIn).not.toHaveBeenCalled();
  });

  // The session transition also clears the previous account's cached data, and that must
  // happen whatever the payments SDK does.
  it('never throws, so it cannot take the session transition down', async () => {
    const { syncPurchaseIdentity } = loadIdentity();
    mockLogIn.mockRejectedValueOnce(new Error('network'));
    await expect(syncPurchaseIdentity(7)).resolves.toBeUndefined();
  });

  // And a failure must not be remembered as success: the next attempt has to try again, or
  // the device keeps buying for nobody.
  it('retries after a failure instead of believing it succeeded', async () => {
    const { syncPurchaseIdentity } = loadIdentity();
    mockLogIn.mockRejectedValueOnce(new Error('network'));
    await syncPurchaseIdentity(7);
    mockLogIn.mockClear();

    await syncPurchaseIdentity(7);
    expect(mockLogIn).toHaveBeenCalledWith('7');
  });
});
