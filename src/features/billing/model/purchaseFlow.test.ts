import { buyPackage, restorePurchases, type StoreLike } from './purchaseFlow';

const aPackage = { identifier: '$rc_monthly' };

function store(over: Partial<StoreLike> = {}): StoreLike {
  return {
    getOfferings: async () => ({ current: { availablePackages: [aPackage] } }),
    purchasePackage: async () => ({}),
    restorePurchases: async () => ({ entitlements: { active: { pro: {} } } }),
    ...over,
  };
}

const confirmed = async () => 'confirmed' as const;
const pending = async () => 'pending' as const;

describe('buyPackage', () => {
  it('reports what the SERVER concluded, not what the store said', async () => {
    await expect(buyPackage(store(), '$rc_monthly', confirmed)).resolves.toEqual({ kind: 'confirmed' });
    await expect(buyPackage(store(), '$rc_monthly', pending)).resolves.toEqual({ kind: 'pending' });
  });

  // The most common outcome of opening a paywall. Shown as a failure it would read as "your
  // payment broke" to somebody who simply changed their mind.
  it('reads a dismissed store sheet as a cancellation, not a failure', async () => {
    const s = store({
      purchasePackage: async () => {
        throw { userCancelled: true, message: 'User cancelled' };
      },
    });
    await expect(buyPackage(s, '$rc_monthly', confirmed)).resolves.toEqual({ kind: 'cancelled' });
  });

  it("carries the store's own words when it fails", async () => {
    const s = store({
      purchasePackage: async () => {
        throw { message: 'Your card was declined.' };
      },
    });
    await expect(buyPackage(s, '$rc_monthly', confirmed)).resolves.toEqual({
      kind: 'failed',
      message: 'Your card was declined.',
    });
  });

  it('has something to say when the store says nothing', async () => {
    const s = store({
      purchasePackage: async () => {
        throw new Error('');
      },
    });
    const outcome = await buyPackage(s, '$rc_monthly', confirmed);
    expect(outcome).toEqual({ kind: 'failed', message: 'The purchase could not be completed.' });
  });

  // Remote configuration can drop a package between the screen rendering and the tap.
  it('refuses a package the offering no longer lists, without charging anybody', async () => {
    let charged = false;
    const s = store({
      purchasePackage: async () => {
        charged = true;
        return {};
      },
    });
    expect((await buyPackage(s, '$rc_gone', confirmed)).kind).toBe('failed');
    expect(charged).toBe(false);
  });

  it('survives an offering with nothing in it', async () => {
    const s = store({ getOfferings: async () => ({ current: null }) });
    expect((await buyPackage(s, '$rc_monthly', confirmed)).kind).toBe('failed');
  });
});

describe('restorePurchases', () => {
  it('confirms a restored subscription against the server', async () => {
    await expect(restorePurchases(store(), confirmed)).resolves.toEqual({ kind: 'confirmed' });
  });

  // The regression this exists for: a restore the server has not caught up with was reported
  // as "nothing to restore", which tells a paying subscriber they own nothing — and that is
  // precisely the case the sync route was built to serve.
  it('does not call a lagging server "nothing to restore"', async () => {
    await expect(restorePurchases(store(), pending)).resolves.toEqual({ kind: 'pending' });
  });

  it('says nothing to restore only when the store hands back nothing', async () => {
    let asked = false;
    const s = store({ restorePurchases: async () => ({ entitlements: { active: {} } }) });
    const outcome = await restorePurchases(s, async () => {
      asked = true;
      return 'confirmed';
    });
    expect(outcome).toEqual({ kind: 'nothing_to_restore' });
    expect(asked).toBe(false);
  });

  it('treats a shape it cannot read as nothing restored', async () => {
    const s = store({ restorePurchases: async () => null });
    await expect(restorePurchases(s, confirmed)).resolves.toEqual({ kind: 'nothing_to_restore' });
  });

  it('reads a dismissed restore as a cancellation', async () => {
    const s = store({
      restorePurchases: async () => {
        throw { userCancelled: true };
      },
    });
    await expect(restorePurchases(s, confirmed)).resolves.toEqual({ kind: 'cancelled' });
  });
});
