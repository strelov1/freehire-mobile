import { confirmPurchase } from './confirm';

const live = { plan: 'pro', resets_at: '2099-01-01T00:00:00Z', pro_until: '2099-01-01T00:00:00Z' };
const free = { plan: 'free', resets_at: '2099-01-01T00:00:00Z' };

/** A plan reader that answers with each item in turn, then repeats the last. */
function reader(answers: (typeof free)[]) {
  let i = 0;
  return {
    read: async () => answers[Math.min(i++, answers.length - 1)] ?? free,
    calls: () => i,
  };
}

describe('confirmPurchase', () => {
  it('reports Pro as soon as the server agrees', async () => {
    const plans = reader([live]);
    const result = await confirmPurchase({ sync: async () => 'synced', readPlan: plans.read, wait: async () => {} });

    expect(result).toBe('confirmed');
    expect(plans.calls()).toBe(1);
  });

  // The purchase is complete on the device before the webhook reaches the server, so the
  // first read can legitimately still say free. Retrying is what turns that into a wait of
  // seconds rather than an hour.
  it('retries until the server catches up', async () => {
    const plans = reader([free, free, live]);
    const result = await confirmPurchase({ sync: async () => 'synced', readPlan: plans.read, wait: async () => {} });

    expect(result).toBe('confirmed');
    expect(plans.calls()).toBe(3);
  });

  // Bounded: money was taken, so the screen must say so plainly rather than spin. The
  // reconciler finishes the job within the hour.
  it('gives up after the bounded attempts and says the payment is pending', async () => {
    const plans = reader([free]);
    const result = await confirmPurchase({ sync: async () => 'synced', readPlan: plans.read, wait: async () => {} });

    expect(result).toBe('pending');
  });

  // A sync that cannot reach the provider is not a failed purchase — the store has the money
  // and the server will find it — so the plan is still read before giving up.
  it('still reads the plan when the sync itself fails', async () => {
    const plans = reader([live]);
    const result = await confirmPurchase({
      sync: async () => {
        throw new Error('provider unreachable');
      },
      readPlan: plans.read,
      wait: async () => {},
    });

    expect(result).toBe('confirmed');
  });

  // "RevenueCat holds nothing for you" right after a purchase means the store has not told
  // them yet. It is the ordinary racing case, not an answer to stop on.
  it('keeps trying when the provider reports no subscription yet', async () => {
    const plans = reader([free, live]);
    const result = await confirmPurchase({
      sync: async () => 'no_subscription',
      readPlan: plans.read,
      wait: async () => {},
    });

    expect(result).toBe('confirmed');
  });

  it('reports a plan it could not read at all rather than claiming success', async () => {
    const result = await confirmPurchase({
      sync: async () => 'synced',
      readPlan: async () => {
        throw new Error('offline');
      },
      wait: async () => {},
    });

    expect(result).toBe('pending');
  });

  it('backs off between attempts instead of hammering', async () => {
    const waits: number[] = [];
    await confirmPurchase({
      sync: async () => 'synced',
      readPlan: async () => free,
      wait: async (ms) => {
        waits.push(ms);
      },
    });

    expect(waits.length).toBeGreaterThan(1);
    expect(waits).toEqual([...waits].sort((a, b) => a - b));
    expect(new Set(waits).size).toBeGreaterThan(1);
  });
});
