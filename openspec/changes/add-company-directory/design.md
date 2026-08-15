## Context

The Companies tab is a placeholder. The pieces around it already exist:

- **The endpoint.** `GET /api/v1/companies` (`hire/internal/handler/companies.go`) takes `q`, `sort`, `limit`, `offset` plus 13 facet params, and returns the standard list envelope `{ data: [...], meta: { limit, offset, total } }`. Its rows come from `companyListItem`, a deliberate public projection: `slug`, `name`, `job_count`, `tagline`, `industries`, `hq_country`, `collections`, `feedback_count`, `feedback_rating_avg`.
- **The destination.** `src/app/companies/[slug].tsx` (from `add-company-page`) already renders a company read-only, with `useCompany`, `CompanyLogo` and the `companyFacts`/`companyRating` formatters.
- **The screen pattern.** `src/app/(tabs)/index.tsx` is a worked example of exactly this shape: pinned search header, `FlashList`, `useInfiniteQuery` walking `offset` to `meta.total`, `RefreshControl`, and a loading/error/empty tri-state around the list.
- **The reference implementation.** `hire/web`'s `CompaniesView.svelte` is the same feature on the web, so the card's field selection is ported rather than invented.

The web catalog carries machinery that has no mobile counterpart: filters live in the URL (`UrlSyncedState`, `syncOnNavigation`) so a filtered view can be shared, deep-linked and server-rendered, and the page emits `CollectionPage`/`BreadcrumbList` JSON-LD. A native screen has no URL and no crawler, so none of that ports.

## Goals / Non-Goals

**Goals:**

- The Companies tab lists real companies, newest data first page, paginated by scroll.
- Free-text search over companies, debounced so typing does not issue a request per keystroke.
- Tapping a row opens the existing company screen.
- Loading / error / empty states consistent with the job feed.

**Non-Goals:**

- No facet filters and no companies filter screen. The job feed's filter machinery (`filterStore`, `jobFilters`, `src/app/filters/`) is job-shaped; company facets would need a parallel store, a facet-value vocabulary and a second filter screen. Deferred until the plain directory proves it is wanted.
- No collection/backer badges on the card. `collections` is on the wire and unused here; the badge vocabulary is a web-side concept with no mobile component yet.
- No country flags or country display names. Mobile has no country dictionary.
- No backend change of any kind.

## Decisions

**1. A separate `CompanyListItem` type, not a widened `Company`.**

`Company` (from `add-company-page`) models the *detail* payload: `company_info`, vote counters, founding year. The list row is a different projection — it carries `job_count` and `collections`, which detail does not, and omits nearly everything detail has. Backend-side these are two distinct Go types on purpose (`companyListItem` exists precisely so the list contract is owned by the handler); making one optional-riddled TypeScript type span both would erase that distinction and make every list field nullable at the use site. Two types, each honest about its endpoint.

**2. Query-param building is a pure module (`src/lib/companyList.ts`), separate from the transport.**

`companyListParams(q, limit, offset)` returns a `URLSearchParams`; `listCompanies` in `api.ts` only appends it to the path and unwraps the envelope. This mirrors `hire/web`, where `companyFacetModel.ts` is a `$app`-free pure module tested in plain Node while the reactive store wraps it. Here it buys the same thing: the rules worth testing — which parameters are sent at all — are testable with no fetch mock, matching how `jobFilters.ts` and `format.ts` are already tested in this repo.

**3. No `sort` parameter is ever sent.**

The screen offers no sort control, so the ordering is whatever the endpoint does by default — most open roles first. Sending `sort=job_count` explicitly would name that default from the client and quietly pin it: a server-side change to the ordering would then stop reaching mobile. Omitting it is also what the web catalog does for its own default (`DEFAULT_COMPANY_SORT` in `companyFacetModel.ts`), so the two clients' default requests stay identical.

**4. No sort control at all.**

The web catalog offers "Most active" / "Highest rated". On mobile that control was dropped: a second ordering is a second thing to explain in a header that also has to hold search, and the default order already answers the question the tab exists for — who is hiring the most. The plumbing is gone too, not just the buttons: no `CompanySort` type, no `sort` in the query key, none in the request. Reinstating it later is a small, additive change; keeping a parameter threaded through four modules for a control nobody can reach is not.

**5. Search debounces at 300 ms, and the debounced value is what keys the cache.**

`useDebounced` already exists for this. The query key is `['public', 'companies', 'search', q]`, so a changed settled text swaps to a different cache entry and pagination resets cleanly — the same contract `useJobSearch` relies on. The raw text drives the `TextInput`, so typing stays responsive while only the settled value reaches the network.

**6. HQ country renders as an uppercase code (`US`), not a flag or a display name.**

The web card shows a flag plus a localized country name from its `COUNTRY` dictionary. Mobile has no such dictionary, and the JD screen already prints raw uppercase codes for the same data (`format.ts`'s `Country` row). Following the app's existing convention costs nothing; importing a country dictionary for one badge is infrastructure ahead of need.

**7. The screen is written out, not extracted into a shared "search list screen" with the job feed.**

The two screens will share a skeleton (pinned header, tri-state body, `FlashList`, `RefreshControl`) but differ in the header: the feed's has a region shortcut, a filters button and an active-filter badge; this one has only a field and a count. Abstracting over two instances with divergent headers would produce a component configured mostly by props for its differences. The seam is noted: if a third list screen appears, or when company facets arrive and the headers converge, that is the moment to extract it.

## Risks / Trade-offs

- **[Trade-off]** Without a rating sort, a company's rating is visible on a card but cannot be sorted or filtered by, so the highly-rated small company is unreachable unless the user already knows its name. Accepted for now: rating coverage is thin (most companies have none), which is exactly what makes a rating-first ordering read as arbitrary.
- **[Trade-off]** No facets means a user who wants "YC companies in the EU" still has to use the web. Accepted: the tab currently offers nothing at all, and a plain searchable directory is the smallest thing that makes it useful.
