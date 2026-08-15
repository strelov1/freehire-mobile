/**
 * The company directory's request shape, kept apart from the transport so the
 * rules worth testing — which parameters are sent at all — are testable without
 * a fetch mock. Mirrors `hire/web`'s `companyFacetModel.ts`, minus the facets
 * the mobile directory doesn't offer.
 */

/** 'job_count' is the backend's own ordering (most open roles first); 'rating'
 *  asks for `feedback_rating_avg` descending. Same vocabulary as the web
 *  catalog's sort control. */
export type CompanySort = 'job_count' | 'rating';

/** Never written into a request: sending it would pin a default the server
 *  owns, so a change there would silently stop reaching this client. */
export const DEFAULT_COMPANY_SORT: CompanySort = 'job_count';

export const COMPANY_PAGE_SIZE = 20;

/** Serialize one page request for `GET /api/v1/companies`. A blank search and
 *  the default sort are left out rather than sent empty. */
export function companyListParams(
  q: string,
  sort: CompanySort,
  limit: number,
  offset: number,
): URLSearchParams {
  const params = new URLSearchParams();
  const search = q.trim();
  if (search) params.set('q', search);
  if (sort !== DEFAULT_COMPANY_SORT) params.set('sort', sort);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return params;
}

/** Where the next page starts, or `undefined` when there is nothing left to
 *  fetch. Typed on the pagination envelope alone — the rows themselves play no
 *  part in the arithmetic.
 *
 *  An empty page ends the walk even when `total` claims more: `total` is an
 *  estimate on the search path and the catalog can shrink between pages, and
 *  without this guard `offset` would stall on the page that returned nothing
 *  and the query would ask for it again on every scroll. */
export function nextCompanyOffset(page: {
  data: readonly unknown[];
  meta: { offset: number; total: number };
}): number | undefined {
  if (page.data.length === 0) return undefined;
  const loaded = page.meta.offset + page.data.length;
  return loaded < page.meta.total ? loaded : undefined;
}
