import { isProLive, planHeadline, planView } from './planView';
import type { Plan } from '../api/planApi';

const future = '2099-01-01T00:00:00Z';
const past = '2020-01-01T00:00:00Z';

function plan(over: Partial<Plan> = {}): Plan {
  return { plan: 'pro', resets_at: future, pro_until: future, pro_source: 'revenuecat', ...over };
}

describe('planView', () => {
  it('offers the purchase to a free account', () => {
    const view = planView({ plan: { plan: 'free', resets_at: future }, canPurchase: true });
    expect(view.kind).toBe('free');
    expect(view.offersPurchase).toBe(true);
  });

  // Selling Pro to somebody already paying through Stripe charges them twice for one plan,
  // and RevenueCat would take the second payment without complaint.
  it('never offers a purchase to a web subscriber', () => {
    const view = planView({ plan: plan({ pro_source: 'stripe' }), canPurchase: true });
    expect(view.kind).toBe('pro');
    expect(view.offersPurchase).toBe(false);
    expect(view.manageAt).toBe('web');
  });

  // Apple forbids directing an in-app subscriber to a web page to cancel.
  it('sends a store subscriber to their own store to manage it', () => {
    const view = planView({ plan: plan({ pro_source: 'revenuecat' }), canPurchase: true });
    expect(view.offersPurchase).toBe(false);
    expect(view.manageAt).toBe('store');
  });

  it('offers a granted plan nothing to buy or cancel', () => {
    const view = planView({ plan: plan({ pro_source: 'granted' }), canPurchase: true });
    expect(view.kind).toBe('pro');
    expect(view.offersPurchase).toBe(false);
    expect(view.manageAt).toBe('nowhere');
  });

  // An origin this build does not know is still an origin: it must not read as free, and it
  // must not be sold over. Where to cancel is genuinely unknown, so the screen says nothing.
  it('treats an unfamiliar origin as a plan it did not sell', () => {
    const view = planView({ plan: plan({ pro_source: 'paypal_2027' }), canPurchase: true });
    expect(view.kind).toBe('pro');
    expect(view.offersPurchase).toBe(false);
    expect(view.manageAt).toBe('nowhere');
  });

  // The server omits pro_until once a plan has ended, but a stale response held in cache can
  // still carry one — so the date is checked rather than trusted for its presence.
  it('reads a lapsed plan as free', () => {
    const view = planView({ plan: plan({ plan: 'pro', pro_until: past }), canPurchase: true });
    expect(view.kind).toBe('free');
    expect(view.offersPurchase).toBe(true);
  });

  // Was "reads a pro plan carrying no expiry as free", which enshrined a double-sell: the
  // server can name the tier without a date when its two queries disagree, and the free branch
  // offers the purchase.
  it('reads a pro plan carrying no expiry as pro, not as free', () => {
    const view = planView({ plan: { plan: 'pro', resets_at: future }, canPurchase: true });
    expect(view.kind).toBe('pro');
    expect(view.offersPurchase).toBe(false);
  });

  // A build with no keys, or the web build. There is a plan to show and no way to sell one.
  it('shows the plan but offers nothing where this build cannot sell', () => {
    const free = planView({ plan: { plan: 'free', resets_at: future }, canPurchase: false });
    expect(free.kind).toBe('free');
    expect(free.offersPurchase).toBe(false);

    const pro = planView({ plan: plan(), canPurchase: false });
    expect(pro.kind).toBe('pro');
    expect(pro.manageAt).toBe('store');
  });

  it('is loading before the plan arrives and unavailable when it will not', () => {
    expect(planView({ plan: undefined, canPurchase: true }).kind).toBe('loading');
    expect(planView({ plan: undefined, canPurchase: true, failed: true }).kind).toBe('unavailable');
  });

  // Reached by deep link, which the profile row's own gating cannot prevent. Without this the
  // screen reads "no plan yet, still fetching" forever: the request is never made for a
  // signed-out visitor, so it never arrives and never fails.
  it('says nobody is signed in rather than waiting for a plan that will never load', () => {
    const view = planView({ plan: undefined, canPurchase: true, signedIn: false });
    expect(view.kind).toBe('signed_out');
  });

  // And it must offer nothing. A restore without an identity attaches the purchase to an
  // anonymous provider user — the attribution failure this whole feature is built to avoid.
  it('offers nothing at all to a signed-out visitor', () => {
    const view = planView({ plan: undefined, canPurchase: true, signedIn: false });
    expect(view.offersPurchase).toBe(false);
    expect(view.offersRestore).toBe(false);
    expect(view.manageAt).toBe('nowhere');
  });

  it('offers restore to a signed-in user whether or not they are on Pro', () => {
    // A second device, or a reinstall: somebody already paying has nothing to buy and every
    // reason to restore.
    expect(planView({ plan: plan(), canPurchase: true }).offersRestore).toBe(true);
    expect(planView({ plan: { plan: 'free', resets_at: future }, canPurchase: true }).offersRestore).toBe(true);
  });

  it('offers no restore where this build cannot sell', () => {
    expect(planView({ plan: plan(), canPurchase: false }).offersRestore).toBe(false);
  });

  // Neither of those states may offer a purchase: selling against a plan we could not read is
  // how a subscriber gets charged twice.
  it('offers no purchase while the plan is unknown', () => {
    expect(planView({ plan: undefined, canPurchase: true }).offersPurchase).toBe(false);
    expect(planView({ plan: undefined, canPurchase: true, failed: true }).offersPurchase).toBe(false);
  });

  it('carries the expiry through for a live plan', () => {
    expect(planView({ plan: plan(), canPurchase: true }).proUntil?.toISOString()).toBe(
      new Date(future).toISOString(),
    );
  });

  // An unreadable date falls back to the tier rather than to "free", for the same reason.
  it('falls back to the tier when the expiry cannot be read', () => {
    expect(planView({ plan: plan({ pro_until: 'whenever' }), canPurchase: true }).kind).toBe('pro');
    expect(
      planView({ plan: { plan: 'free', resets_at: future, pro_until: 'whenever' }, canPurchase: true }).kind,
    ).toBe('free');
  });
});

describe('planHeadline', () => {
  it('names the plan and when it runs out', () => {
    const view = planView({ plan: plan(), canPurchase: false });
    expect(planHeadline(view).title).toBe('freehire Pro');
    expect(planHeadline(view).detail).toMatch(/^Active until /);
  });

  // Every state has words. A kind with none would render an empty card, and the switch is
  // exhaustive precisely so a new kind cannot be added without deciding what it says.
  it('has something to say in every state', () => {
    const cases = [
      planView({ plan: undefined, canPurchase: false, signedIn: false }),
      planView({ plan: undefined, canPurchase: false }),
      planView({ plan: undefined, canPurchase: false, failed: true }),
      planView({ plan: { plan: 'free', resets_at: future }, canPurchase: false }),
      planView({ plan: plan(), canPurchase: false }),
    ];
    for (const view of cases) {
      const { title, detail } = planHeadline(view);
      expect(title.length).toBeGreaterThan(0);
      expect(detail.length).toBeGreaterThan(0);
    }
    expect(new Set(cases.map((v) => planHeadline(v).title)).size).toBe(cases.length);
  });

  // The two surfaces described one account differently before this existed — "Free plan" on
  // the profile row against "Free" on the plan screen, each through its own ternaries.
  it('gives both surfaces the same words for the same plan', () => {
    const view = planView({ plan: { plan: 'free', resets_at: future }, canPurchase: true });
    const other = planView({ plan: { plan: 'free', resets_at: future }, canPurchase: false });
    expect(planHeadline(view)).toEqual(planHeadline(other));
  });
});

describe('isProLive', () => {
  // The server names the tier and the dates through different queries, and the second can fail
  // on its own — answering `plan: "pro"` with no expiry. Reading only the date turns a paying
  // subscriber into a free one, and a free-looking subscriber is sold the plan they own.
  it('believes the tier when there is no readable date', () => {
    expect(isProLive({ plan: 'pro', resets_at: future })).toBe(true);
    expect(isProLive({ plan: 'pro', resets_at: future, pro_until: 'whenever' })).toBe(true);
  });

  // The other direction, and the reason the date outranks the tier: a response held in cache
  // across the instant it expired still says "pro". Believing that would leave somebody unable
  // to buy again, because the app insists they already have it.
  it('lets a readable date overrule the tier, in both directions', () => {
    expect(isProLive({ plan: 'pro', resets_at: future, pro_until: past })).toBe(false);
    expect(isProLive({ plan: 'free', resets_at: future, pro_until: future })).toBe(true);
  });

  it('believes a live date whatever the tier says', () => {
    expect(isProLive({ plan: 'free', resets_at: future, pro_until: future })).toBe(true);
  });

  it('is false for a free plan and for no plan at all', () => {
    expect(isProLive({ plan: 'free', resets_at: future })).toBe(false);
    expect(isProLive({ plan: 'free', resets_at: future, pro_until: past })).toBe(false);
    expect(isProLive(undefined)).toBe(false);
  });
});

describe('planView on a dateless pro plan', () => {
  const dateless = { plan: 'pro', resets_at: future, pro_source: 'stripe' } as const;

  // The double-sell this exists to prevent: before, a plan the server called "pro" but could
  // not date read as free, and the free branch offers the purchase.
  it('does not offer a purchase', () => {
    const view = planView({ plan: dateless, canPurchase: true });
    expect(view.kind).toBe('pro');
    expect(view.offersPurchase).toBe(false);
    expect(view.manageAt).toBe('web');
  });

  it('says nothing about when it runs out, rather than inventing a day', () => {
    expect(planView({ plan: dateless, canPurchase: true }).proUntil).toBeUndefined();
    expect(planHeadline(planView({ plan: dateless, canPurchase: true })).detail).toBe('Active');
  });
});
