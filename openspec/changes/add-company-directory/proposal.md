## Why

The Companies tab is a static "Coming soon" placeholder (`src/app/(tabs)/companies.tsx`). One of the app's four tabs has been dead since the tab bar shipped, so a company can only be reached sideways — by tapping a company name on a job card or job detail screen. There is no way to browse or search companies at all.

The placeholder's own comment explains the tab as blocked on a missing API: "no company list/search API exists yet (only a per-company detail route)". That is no longer true, and the sibling web app proves it: `GET /api/v1/companies?q=&sort=&limit=&offset=` backs `hire/web`'s `/companies` catalog and returns exactly the fields a list row needs. The blocker is stale, not real.

## What Changes

- The Companies tab (`src/app/(tabs)/companies.tsx`) becomes a real, paginated company directory: a pinned search field, a result count, a sort toggle, and an infinitely-scrolling list of company cards with pull-to-refresh — the same screen skeleton the job feed (`src/app/(tabs)/index.tsx`) already uses.
- New `CompanyCard` (`src/components/CompanyCard.tsx`) renders one directory row: logo, name, rating, open-role count, tagline, industry and HQ country. Tapping it opens the existing company screen at `companies/[slug]`.
- New `CompanyListItem` wire type (`src/lib/types.ts`), a `listCompanies` reader (`src/lib/api.ts`), a pure query-param builder (`src/lib/companyList.ts`), a `useCompanySearch` infinite query (`src/lib/useCompanySearch.ts`), and a `publicKeys.companies.search` cache key (`src/lib/queryKeys.ts`).
- Search text is debounced before it reaches the network, reusing the existing `useDebounced` hook.

**Out of scope**: company facet filters and a companies filter screen (the web catalog's 13 facets); the web catalog's SEO/JSON-LD concerns, which have no mobile analogue; backer/collection badges on the card; any backend change.

## Capabilities

### New Capabilities

- `company-directory`: browsing, searching and sorting the company catalog from the Companies tab, and opening a company from it.

### Modified Capabilities

- none. `company-page` (`openspec/changes/add-company-page`) declared a company listing screen out of scope and is untouched by this change — the directory only navigates into the screen that change built.

## Impact

- `src/app/(tabs)/companies.tsx` — placeholder replaced with the directory screen.
- `src/components/CompanyCard.tsx` — new file.
- `src/lib/companyList.ts` — new file (pure query-param builder + its sort vocabulary).
- `src/lib/useCompanySearch.ts` — new file.
- `src/lib/types.ts` — new `CompanyListItem` type.
- `src/lib/api.ts` — new `listCompanies` reader.
- `src/lib/queryKeys.ts` — new `publicKeys.companies.search` key.
- No backend changes: consumes the existing public `GET /api/v1/companies` already serving `hire/web`.
