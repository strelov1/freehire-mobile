/**
 * Turning a RevenueCat offering into what the paywall renders.
 *
 * Deliberately free of the SDK: it takes the shape rather than the type, so this file — and
 * its tests — run without a native module. That is the same arrangement `src/lib/push.ts`
 * uses to keep notification handling testable, and it is why the offering rules live here
 * rather than inside the screen.
 */

/** The billing period, as the screen groups packages by. */
export type PurchasePeriod = 'monthly' | 'annual' | 'other';

/** One thing the paywall can sell. */
export type PurchaseOption = {
  /** The package identifier, handed straight back to the SDK to buy. */
  id: string;
  period: PurchasePeriod;
  /**
   * The price as the STORE formatted it, for the buyer's own storefront. Never composed
   * here: nothing on the device can reconstruct the currency, the separators and the
   * placement of the symbol from a number, and a price shown wrongly is a price the buyer
   * can hold us to.
   */
  priceLabel: string;
  /**
   * How much cheaper a year is than twelve months, rounded down, when both are on sale and
   * the year is genuinely cheaper. Absent otherwise — a discount we cannot substantiate is
   * one we must not claim.
   */
  savingPercent?: number;
};

/** The parts of an offering this module reads. */
export type OfferingLike = { availablePackages: unknown[] } | null | undefined;

type PackageLike = {
  identifier?: unknown;
  packageType?: unknown;
  product?: { price?: unknown; priceString?: unknown };
};

/** Monthly first: it is the lower commitment, and the annual option reads as the upsell. */
const PERIOD_ORDER: Record<PurchasePeriod, number> = { monthly: 0, annual: 1, other: 2 };

const MONTHS_IN_YEAR = 12;

export function purchaseOptions(offering: OfferingLike): PurchaseOption[] {
  const packages = offering?.availablePackages;
  if (!Array.isArray(packages)) return [];

  const priced = packages.flatMap((raw) => {
    const parsed = readPackage(raw);
    return parsed ? [parsed] : [];
  });

  const monthly = priced.find((p) => p.period === 'monthly');

  return priced
    .map<PurchaseOption>((p) => ({
      id: p.id,
      period: p.period,
      priceLabel: p.priceLabel,
      savingPercent: p.period === 'annual' ? savingAgainst(monthly?.price, p.price) : undefined,
    }))
    .sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]);
}

type ParsedPackage = { id: string; period: PurchasePeriod; priceLabel: string; price: number };

/**
 * Reads one package, or nothing.
 *
 * A package missing an identifier or a price is dropped rather than defaulted: the offering
 * is remote configuration and arrives as plain JSON, so a shape we do not understand is
 * possible — and a purchase button with no price is worse than one package fewer.
 */
function readPackage(raw: unknown): ParsedPackage | null {
  if (!raw || typeof raw !== 'object') return null;
  const pkg = raw as PackageLike;

  const id = typeof pkg.identifier === 'string' ? pkg.identifier : '';
  const priceLabel = typeof pkg.product?.priceString === 'string' ? pkg.product.priceString : '';
  const price = typeof pkg.product?.price === 'number' ? pkg.product.price : NaN;

  if (!id || !priceLabel || !Number.isFinite(price)) return null;
  return { id, period: readPeriod(pkg.packageType), priceLabel, price };
}

/**
 * A period we do not recognise is carried as `other` rather than dropped. Somebody can add a
 * weekly package in the dashboard tomorrow, and the screen deciding that means "no packages"
 * would be a remote configuration change taking the paywall down.
 */
function readPeriod(packageType: unknown): PurchasePeriod {
  if (packageType === 'MONTHLY') return 'monthly';
  if (packageType === 'ANNUAL') return 'annual';
  return 'other';
}

/** The saving, only when there is a baseline and the year really is the cheaper way to buy. */
function savingAgainst(monthlyPrice: number | undefined, annualPrice: number): number | undefined {
  if (monthlyPrice === undefined || monthlyPrice <= 0) return undefined;

  const twelveMonths = monthlyPrice * MONTHS_IN_YEAR;
  if (annualPrice >= twelveMonths) return undefined;

  return Math.floor(((twelveMonths - annualPrice) / twelveMonths) * 100);
}
