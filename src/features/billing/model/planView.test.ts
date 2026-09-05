import { planView } from './planView';
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

  it('reads a pro plan carrying no expiry as free', () => {
    const view = planView({ plan: { plan: 'pro', resets_at: future }, canPurchase: true });
    expect(view.kind).toBe('free');
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

  it('ignores an expiry it cannot read', () => {
    const view = planView({ plan: plan({ pro_until: 'whenever' }), canPurchase: true });
    expect(view.kind).toBe('free');
  });
});
