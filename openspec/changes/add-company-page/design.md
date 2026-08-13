## Context

The mobile app (Expo/expo-router, `src/app/`) already fetches jobs via `src/lib/api.ts`'s `getJSON`/`send` helpers and renders them with `JobCard` (feed) and `jobs/[slug].tsx` (detail). `Job.company_slug` exists on the wire type but is unused. `CompanyLogo` renders only a hashed-color monogram; there is no company screen, `Company` type, or company API call anywhere in the mobile codebase.

The sibling web app (`hire/web`, SvelteKit) already has the target behavior: `CompanyLogo.svelte` loads a real `<img>` from `https://logo.freehire.me/<name>` with a monogram fallback (`hire/web/src/lib/logo.ts`), and `routes/companies/[slug]/+page.svelte` renders `CompanyView.svelte` from data fetched via `client.getCompany(slug, limit, offset)` → `GET /api/v1/companies/{slug}?limit=&offset=`, returning `{ company: Company, jobs: Job[], referral_available: boolean }`. The mobile app is described in its own comments as "ported from" this web app, so the natural approach is to port the same data shape and the same logo-loading behavior rather than invent a new one.

## Goals / Non-Goals

**Goals:**
- Tapping the company name on the JD screen navigates to a new in-app company screen (`src/app/companies/[slug].tsx`) via `job.company_slug`.
- The company screen shows the full read-only `Company`/`CompanyInfo` data set (matching web) plus the company's own job list.
- `CompanyLogo` loads a real logo image from `https://logo.freehire.me/<name>` everywhere it's used, falling back to the existing monogram on load failure.
- Logo size increases: JobCard 28px → 40px, JD screen 26px → 48px, company screen uses 48px (same as JD).

**Non-Goals:**
- No voting/feedback submission UI or API calls (`my_vote`, upvote/downvote, `CompanyFeedback` are read-only display only — rating/feedback_count as text, no buttons).
- No company search/listing screen (`/companies` catalog). The only entry point is tapping a company name from a JD.
- No backend changes — this only consumes the existing public `GET /api/v1/companies/{slug}` endpoint already used by web.

## Decisions

**1. `getCompany` follows the `getJob` pattern, not the authenticated `send` pattern.**
`GET /api/v1/companies/{slug}` is a public, unauthenticated read (same class as `getJob`/`searchJobs`), so `getCompany` uses the plain `getJSON` helper, unwrapping `{ data: { company, jobs, referral_available } }`. Rationale: matches the existing convention in `src/lib/api.ts` where public reads use `getJSON` and only session-scoped writes/reads use `send`/`ApiError`. Alternative considered: reusing `send` for consistency with error-shape handling — rejected because that pattern exists specifically for auth-aware endpoints, and adding `ApiError` handling here would be dead complexity with no login-gated behavior to report.

**2. `Company`/`CompanyInfo` types are copied field-for-field from `hire/web/src/lib/types.ts`, trimmed to what's used.**
Include everything the read-only screen renders: `slug`, `name`, `industries`, `year_founded`, `employee_count`, `hq_country`, `organization_type`, `tagline`, `company_info` (`description`, `website`, `linkedin`, `yc_url`, `stage`, `top_company`, `is_hiring`, `funding`, `stock`, `logo`, `homepage`), `upvote_count`, `downvote_count`, `feedback_count`, `feedback_rating_avg`. Omit `my_vote`, `collections`, `created_at`/`updated_at`, `parent`/`subsidiaries`/`activities` — not rendered in v1's read-only view (no voting, no curated-collection UI, no directory-hierarchy UI). Rationale: keep the mobile type minimal but wire-compatible; nothing stops adding fields later since it's additive.

**3. Logo loading: `expo-image`'s `<Image>` with `onError` fallback to the current `View`-based monogram.**
`expo-image` is already a project dependency (used in `animated-icon.tsx`, `web-badge.tsx`), so `CompanyLogo` reuses it rather than React Native's core `Image` — free disk/memory caching and no new dependency. `CompanyLogo` gains an internal `failed` boolean (`useState`, reset when `name` changes). It renders `<Image source={{ uri: companyLogoUrl(name) }} onError={() => setFailed(true)} style={...} contentFit="contain" />` when a logo URL exists and hasn't failed, else the existing monogram `View`. Alternative considered: React Native core `Image` — rejected since `expo-image` is already in the dependency tree and used elsewhere in this codebase for the same "remote/local image" job.
`companyLogoUrl(name)` is a small pure helper (new file or inline in `CompanyLogo.tsx`) mirroring `hire/web/src/lib/logo.ts`: `` `https://logo.freehire.me/${encodeURIComponent(name)}` ``, returning `null` for an empty name (monogram-only in that case, same as today).

**4. Company screen is a new expo-router route `src/app/companies/[slug].tsx`, registered as a `Stack.Screen` in `src/app/_layout.tsx`, following the exact pattern of `jobs/[slug].tsx`.**
Uses `useLocalSearchParams` for the slug and a new `useCompany(slug)` hook (`src/lib/useCompany.ts`, a thin `useQuery` wrapper around `getCompany` keyed `['companies', 'detail', slug]`) — mirrors `useJob`, the existing convention for screen-level data fetching in this codebase, rather than a raw `useEffect`. Loading/error states follow the same pattern `jobs/[slug].tsx` already renders. Job list within the screen reuses `JobCard` unmodified (it already renders full job cards; the company's `jobs` array from the API response feeds it directly, no separate fetch needed).

**5. Company name becomes a `Pressable` (not `expo-router`'s `Link`) in both `jobs/[slug].tsx` and `JobCard.tsx`, calling `router.push` on tap — mirroring how `JobCard` already navigates to job detail.**
Rationale: consistency with the existing navigation idiom already in the codebase (`JobCard`'s `open()` function uses `router.push`, not `<Link>`). If `job.company_slug` is missing/empty, the company name renders as plain non-interactive text (no dead-end taps) — same defensive pattern the web version uses (`{#if job.company_slug}` link vs plain text).

## Risks / Trade-offs

- **[Risk]** `logo.freehire.me` may not resolve or may rate-limit from a mobile client the way the code comment in `CompanyLogo.tsx` (now stale) worried about for `logo.dev`. → **Mitigation**: the `onError` fallback to the monogram makes this a pure visual degradation, not a crash or broken UI; worth a quick manual check against a real device/simulator during implementation before considering the task done.
- **[Risk]** Some companies may have sparse `company_info` (most fields absent) — a company screen with mostly-empty sections could look broken. → **Mitigation**: every optional field/section is conditionally rendered (`{field ? ... : null}`), same defensive pattern already used throughout `jobs/[slug].tsx` and `JobCard.tsx` for optional job fields.
- **[Trade-off]** Read-only voting/feedback display (no interaction) means `upvote_count`/`downvote_count`/`feedback_rating_avg` are shown as static numbers only — acceptable per explicit user decision, revisit if a future change adds mobile auth-gated voting.
