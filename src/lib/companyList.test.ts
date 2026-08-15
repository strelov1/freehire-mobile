import { companyListParams, DEFAULT_COMPANY_SORT, nextCompanyOffset } from './companyList';

describe('nextCompanyOffset', () => {
  const page = (offset: number, count: number, total: number) => ({
    data: Array.from({ length: count }, (_, i) => ({ slug: `c${offset + i}` })),
    meta: { limit: 20, offset, total },
  });

  it('points at the row after the ones already loaded', () => {
    expect(nextCompanyOffset(page(0, 20, 57))).toBe(20);
    expect(nextCompanyOffset(page(20, 20, 57))).toBe(40);
  });

  it('stops once the loaded rows reach the total', () => {
    expect(nextCompanyOffset(page(40, 17, 57))).toBeUndefined();
  });

  it('stops on an empty catalog rather than asking for offset 0 forever', () => {
    expect(nextCompanyOffset(page(0, 0, 0))).toBeUndefined();
  });

  it('stops when a short page arrives before the advertised total', () => {
    // The catalog shrank between pages; without this the query would keep
    // requesting the same offset because loaded never reaches total.
    expect(nextCompanyOffset(page(20, 0, 57))).toBeUndefined();
  });
});

describe('companyListParams', () => {
  it('always carries the page window', () => {
    const p = companyListParams('', DEFAULT_COMPANY_SORT, 20, 40);
    expect(p.get('limit')).toBe('20');
    expect(p.get('offset')).toBe('40');
  });

  it('omits sort for the default order, so the backend keeps owning the default', () => {
    expect(companyListParams('', DEFAULT_COMPANY_SORT, 20, 0).has('sort')).toBe(false);
  });

  it('sends sort=rating for the highest-rated order', () => {
    expect(companyListParams('', 'rating', 20, 0).get('sort')).toBe('rating');
  });

  it('omits q when the search is empty', () => {
    expect(companyListParams('', DEFAULT_COMPANY_SORT, 20, 0).has('q')).toBe(false);
  });

  it('omits q when the search is whitespace only', () => {
    expect(companyListParams('   ', DEFAULT_COMPANY_SORT, 20, 0).has('q')).toBe(false);
  });

  it('trims the search text it does send', () => {
    expect(companyListParams('  stripe  ', DEFAULT_COMPANY_SORT, 20, 0).get('q')).toBe('stripe');
  });

  it('combines a search with a non-default sort', () => {
    expect(companyListParams('stripe', 'rating', 20, 0).toString()).toBe(
      'q=stripe&sort=rating&limit=20&offset=0',
    );
  });
});
