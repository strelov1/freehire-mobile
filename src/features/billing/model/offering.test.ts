import { purchaseOptions, type OfferingLike } from './offering';

/** A package as RevenueCat hands it over, trimmed to what the screen reads. */
function pkg(identifier: string, type: string, price: number, priceString: string) {
  return {
    identifier,
    packageType: type,
    product: { identifier: `${identifier}.product`, price, priceString },
  };
}

const monthly = pkg('$rc_monthly', 'MONTHLY', 4.99, '$4.99');
const annual = pkg('$rc_annual', 'ANNUAL', 39.99, '$39.99');

function offering(packages: unknown[]): OfferingLike {
  return { availablePackages: packages } as OfferingLike;
}

describe('purchaseOptions', () => {
  it('puts the monthly package first', () => {
    const options = purchaseOptions(offering([annual, monthly]));
    expect(options.map((o) => o.period)).toEqual(['monthly', 'annual']);
  });

  // The price shown is the store's own string, never one composed here: it carries the
  // currency and the formatting of the buyer's own storefront, which nothing on the device
  // can reconstruct from a number.
  it('shows the store price string as given', () => {
    const [first] = purchaseOptions(offering([monthly]));
    expect(first?.priceLabel).toBe('$4.99');
  });

  it('states the saving on the annual package against twelve months', () => {
    const options = purchaseOptions(offering([monthly, annual]));
    // 39.99 against 59.88 is a third off.
    expect(options[1]?.savingPercent).toBe(33);
  });

  // Without a monthly package there is nothing to compare against, and an invented baseline
  // would be a discount claim we cannot support.
  it('claims no saving when there is nothing to compare against', () => {
    const [only] = purchaseOptions(offering([annual]));
    expect(only?.savingPercent).toBeUndefined();
  });

  it('claims no saving when the annual package is not actually cheaper', () => {
    const dearAnnual = pkg('$rc_annual', 'ANNUAL', 80, '$80.00');
    const options = purchaseOptions(offering([monthly, dearAnnual]));
    expect(options[1]?.savingPercent).toBeUndefined();
  });

  // The offering is remote configuration: somebody can add a weekly package in a dashboard
  // tomorrow, and the screen must not decide that means "no packages".
  it('carries a period it does not recognise rather than dropping it', () => {
    const weekly = pkg('$rc_weekly', 'WEEKLY', 1.99, '$1.99');
    const options = purchaseOptions(offering([weekly]));
    expect(options).toHaveLength(1);
    expect(options[0]?.period).toBe('other');
  });

  it('is empty for an absent or empty offering', () => {
    expect(purchaseOptions(null)).toEqual([]);
    expect(purchaseOptions(offering([]))).toEqual([]);
  });

  // `extra` and the SDK's own payloads arrive as plain JSON, so a package missing the fields
  // the screen needs is possible. Dropping it beats rendering a button with no price.
  it('drops a package it cannot price', () => {
    const broken = { identifier: '$rc_monthly', packageType: 'MONTHLY', product: {} };
    expect(purchaseOptions(offering([broken, monthly]))).toHaveLength(1);
  });
});
