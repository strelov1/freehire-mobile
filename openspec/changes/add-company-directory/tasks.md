## 1. Request shape

- [x] 1.1 Add `src/lib/companyList.ts`: a `CompanySort` union (`'job_count' | 'rating'`), `DEFAULT_COMPANY_SORT`, `COMPANY_PAGE_SIZE`, and a pure `companyListParams(q, sort, limit, offset): URLSearchParams` that omits `q` when blank and omits `sort` when it is the default (design decisions 2 and 3).
- [x] 1.2 Add `CompanyListItem` to `src/lib/types.ts`, mirroring the backend's `companyListItem` projection: `slug`, `name`, `job_count`, `tagline`, `industries`, `hq_country`, `collections`, `feedback_count`, `feedback_rating_avg` (design decision 1).
- [x] 1.3 Add `listCompanies(q, sort, limit, offset, signal): Promise<Page<CompanyListItem>>` to `src/lib/api.ts`, building its query with `companyListParams` and reading through the public transport path like `searchJobs`.

## 2. Query layer

- [x] 2.1 Add `publicKeys.companies.search(q, sort)` to `src/lib/queryKeys.ts`.
- [x] 2.2 Add `src/lib/useCompanySearch.ts`: a `useInfiniteQuery` over `listCompanies`, keyed on the settled query and sort, advancing `offset` while `meta.offset + data.length < meta.total` (design decision 5).

## 3. Company card

- [x] 3.1 Add `src/components/CompanyCard.tsx`: logo, name, rating, open-role count, tagline, first industry, HQ country — each optional field omitted when absent, count pluralized, HQ country uppercased (design decision 6).
- [x] 3.2 Make the card navigate to `/companies/<slug>` on press.

## 4. Directory screen

- [x] 4.1 Replace the placeholder in `src/app/(tabs)/companies.tsx` with the pinned header: search field (debounced via `useDebounced`), clear button, total count, and the two sort chips (design decision 4).
- [x] 4.2 Render the tri-state body — loading, error with retry, empty with a clear-search affordance when a search is active — following the job feed's states.
- [x] 4.3 Render the results as a `FlashList` of `CompanyCard`s with infinite scroll, a next-page footer indicator, pull-to-refresh, and the tab-bar bottom inset the feed uses.

## 5. Verification

- [x] 5.1 `npm run lint` and `npx tsc --noEmit` clean; `npm test` green.
- [x] 5.2 Manually verify on a simulator: the tab lists companies, search narrows them, both sort orders work, scrolling pages in, a card opens the company screen, and a sparse company renders without empty rows.
