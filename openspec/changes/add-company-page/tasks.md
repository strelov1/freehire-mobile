## 1. Company data layer

- [x] 1.1 Add `Company` and `CompanyInfo` types to `src/lib/types.ts` (fields per design.md decision 2: slug, name, industries, year_founded, employee_count, hq_country, organization_type, tagline, company_info{description, website, linkedin, yc_url, stage, top_company, is_hiring, funding, stock, logo, homepage}, upvote_count, downvote_count, feedback_count, feedback_rating_avg), plus a `CompanyPage` type for the `{ company, jobs, referral_available }` envelope.
- [x] 1.2 Add `getCompany(slug: string, limit?: number, offset?: number): Promise<CompanyPage>` to `src/lib/api.ts` using the `getJSON` pattern (mirrors `getJob`), hitting `GET /api/v1/companies/{slug}` with optional `limit`/`offset` query params.

## 2. Logo image loading

- [x] 2.1 Add a `companyLogoUrl(name: string): string | null` helper (in `CompanyLogo.tsx` or a small new file) returning `` `https://logo.freehire.me/${encodeURIComponent(name)}` `` for a non-empty trimmed name, `null` otherwise.
- [x] 2.2 Update `CompanyLogo` to render `<Image source={{ uri }} onError={...} />` when a logo URL is available and hasn't failed to load, falling back to the existing monogram `View` on error or when there's no URL — preserving the current `size` prop behavior for both paths.

## 3. Logo sizing

- [x] 3.1 Bump `JobCard`'s `CompanyLogo` size from 28 to 40 (`src/components/JobCard.tsx`).
- [x] 3.2 Bump the JD screen's `CompanyLogo` size from 26 to 48 (`src/app/jobs/[slug].tsx`).

## 4. Company screen

- [x] 4.1 Create `src/app/companies/[slug].tsx`: read the slug via `useLocalSearchParams`, fetch via `getCompany` in a `useEffect`, and render loading/error states following the existing pattern in `src/app/jobs/[slug].tsx`.
- [x] 4.2 Render the company header: `CompanyLogo` at size 48, name, tagline, top_company/is_hiring badges.
- [x] 4.3 Render company facts section: industries, year_founded, employee_count, hq_country, organization_type — each conditionally shown only when present.
- [x] 4.4 Render `company_info` extras: description, funding, stock, website/linkedin/yc_url as tappable links (reuse `ExternalLink` / existing `WebBrowser.openBrowserAsync` pattern from `jobs/[slug].tsx`).
- [x] 4.5 Render feedback/rating as static read-only text (`feedback_rating_avg` + `feedback_count`, `upvote_count`/`downvote_count`) — no buttons or tap handlers.
- [x] 4.6 Render the company's job list (`jobs` from the fetch response) using the existing `JobCard` component, unmodified.
- [x] 4.7 Register the new route as a `Stack.Screen` in `src/app/_layout.tsx`, following the existing screen registrations.

## 5. Navigation from job name to company screen

- [x] 5.1 In `src/app/jobs/[slug].tsx`, make the company name a `Pressable` that calls `router.push('/companies/' + job.company_slug)` when `job.company_slug` is present; render plain `Text` (current behavior) when it's absent.
- [x] 5.2 In `src/components/JobCard.tsx`, make the company name a `Pressable` (nested inside the card's own `Pressable`, with `onPress` navigating to the company screen and not bubbling to the card's job-detail navigation) when `job.company_slug` is present; keep plain `Text` when absent.

## 6. Verification

- [x] 6.1 Run `npm run lint` and `npx tsc --noEmit` — both must pass clean per this repo's CI gate.
- [ ] 6.2 Manually verify on a simulator/device: tapping a company name from the feed and from JD opens the company screen; a company with sparse `company_info` renders without empty/broken sections; a logo that fails to load falls back to the monogram; logo sizes are visibly larger in the feed and JD.
