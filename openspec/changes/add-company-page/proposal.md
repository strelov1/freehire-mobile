## Why

The mobile app has no company page: `Job.company_slug` is fetched from the API but never used, so tapping a company name does nothing. Company logos are also just single-letter monograms — the app never loads a real logo image, even though the sibling web app (`hire/web`) already renders one via `https://logo.freehire.me/<name>`. Users can't learn more about a company from the app the way they can on the web.

## What Changes

- Company name in the JD screen (`src/app/jobs/[slug].tsx`) becomes tappable and navigates to a new in-app company screen using `job.company_slug`.
- New company screen (`src/app/companies/[slug].tsx`) fetches `GET /api/v1/companies/{slug}` and renders company details read-only: logo, name, tagline/description, industries, year founded, employee count, HQ country, organization type, funding, stock, top_company/is_hiring badges, website/LinkedIn/YC links, rating/feedback_count (as text, no voting), and the company's job list (reusing `JobCard`).
- `CompanyLogo` (`src/components/CompanyLogo.tsx`) attempts to load `https://logo.freehire.me/<encodeURIComponent(name)>` as a real image, falling back to the existing monogram on load error — mirroring `hire/web/src/lib/logo.ts` + `CompanyLogo.svelte`.
- Logo size increases: `JobCard` (job list) from 26px to 40px, JD screen from 26px to 48px; the new company screen uses the same large size as JD.
- New `Company` type in `src/lib/types.ts` and a `getCompany(slug)` function in `src/lib/api.ts`, following the existing `getJob` pattern.
- New `Stack.Screen` registration for `companies/[slug]` in `src/app/_layout.tsx`.

**Out of scope**: interactive voting/feedback submission, a company search/listing screen. Only navigation from a JD's company name into the read-only company page.

## Capabilities

### New Capabilities
- `company-page`: fetching and displaying a single company's details and job list in the mobile app, reached by tapping a company name on the JD screen.

### Modified Capabilities
- none (no existing specs in `openspec/specs/` yet; company logo rendering has no prior spec, it's part of `company-page`'s supporting behavior since it changes visibly wherever `CompanyLogo` is used)

## Impact

- `src/app/jobs/[slug].tsx` — company name becomes pressable/link, logo size 48px.
- `src/components/JobCard.tsx` — logo size 40px, company name pressable.
- `src/components/CompanyLogo.tsx` — real image fetch + fallback, size prop usage.
- `src/lib/types.ts` — new `Company`/`CompanyInfo` types.
- `src/lib/api.ts` — new `getCompany(slug)` function.
- `src/app/companies/[slug].tsx` — new screen (new file).
- `src/app/_layout.tsx` — new `Stack.Screen` registration.
- No backend changes; consumes existing `https://freehire.dev` API (`GET /api/v1/companies/{slug}`) already used by `hire/web`.
