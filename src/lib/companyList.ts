/**
 * The company directory's request shape, kept apart from the transport so the
 * rules worth testing — which parameters are sent at all — are testable without
 * a fetch mock. Mirrors `hire/web`'s `companyFacetModel.ts`, minus the facets
 * and the sort control the mobile directory doesn't offer.
 */

export const COMPANY_PAGE_SIZE = 20;

/** Serialize one page request for `GET /api/v1/companies`. A blank search is
 *  left out rather than sent empty, and no `sort` is ever sent: the ordering is
 *  the backend's own default (most open roles first), so a change there reaches
 *  this client instead of being pinned by an explicit parameter. */
export function companyListParams(q: string, limit: number, offset: number): URLSearchParams {
  const params = new URLSearchParams();
  const search = q.trim();
  if (search) params.set('q', search);
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
