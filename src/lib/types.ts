/**
 * Wire shapes for the freehire public API. This is a deliberate subset of the
 * server's full Job model — only the fields the feed card reads. Everything is
 * optional/nullable-tolerant because the API omits absent fields entirely
 * (e.g. a job with no salary has no `salary_min` key at all).
 */

/** AI enrichment: controlled-vocabulary facets plus optional compensation. */
export type Enrichment = {
  employment_type?: string; // e.g. "full_time"
  category?: string; // e.g. "sales", "software_engineering"
  work_mode?: string; // e.g. "remote", "hybrid", "onsite"
  seniority?: string;
  summary?: string; // clean model-written one-liner (tech jobs only)
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string; // "USD" | "EUR" | "GBP"
  salary_period?: string; // "year" | "month" | "day" | "hour"
  // --- Extra facets the detail view reads (absent on the feed subset) ---------
  experience_years_min?: number;
  english_level?: string; // "none" sentinel means "unspecified" — hide it
  relocation?: string;
  visa_sponsorship?: boolean;
  company_type?: string; // e.g. "agency", "startup"
  company_size?: string; // e.g. "11-50"
  domains?: string[]; // industry domains
  skills?: string[]; // enrichment may carry its own skill list
};

/**
 * The job-reality trust signal. The single-job endpoint returns this as an
 * OBJECT of observable facts (the feed omits it). `class` drives the badge:
 * "fresh" shows nothing; "stale" a muted age chip; "likely-evergreen" an amber
 * warning. The counts are the evidence rendered beside the chip.
 */
export type Reality = {
  class: string; // "fresh" | "stale" | "likely-evergreen" | ...
  age_days: number;
  repost_count: number;
  mass_posting_count: number;
  fake_freshness: boolean;
};

export type Job = {
  public_slug: string;
  title: string;
  company: string;
  company_slug?: string;
  location?: string | null;
  description?: string | null; // raw HTML
  url?: string;
  source?: string;
  reality?: Reality | null; // trust signal (object; detail endpoint only)
  work_mode?: string | null; // top-level on the detail read (mirrors enrichment)
  regions?: string[];
  countries?: string[];
  cities?: string[];
  skills?: string[]; // served dictionary facet
  posted_at?: string | null; // ISO timestamp
  created_at?: string | null;
  closed_at?: string | null; // set when the position stops accepting applications
  view_count?: number; // distinct signed-in viewers
  applied_count?: number; // distinct applicants
  manually_added?: boolean;
  enrichment?: Enrichment | null;
};

/** The authenticated account, as returned by register/login/me. The password
 *  hash never crosses the wire; `role` is a UI affordance the server re-checks. */
export type User = {
  id: number;
  email: string;
  role: string;
  beta_tester: boolean;
  email_verified?: boolean;
  has_password?: boolean;
  created_at?: string | null;
};

/** "Where & how I want to work" — a deliberate subset of the server's
 *  LocationPreferences (mirrors the web app's type of the same name): only the
 *  parts `filtersFromProfile` reads. `base` is where the user LIVES (not
 *  necessarily where they want the work); `relocation.open` gates whether its
 *  targets count at all. */
export type LocationPreferences = {
  work_modes?: string[];
  remote?: { regions?: string[]; countries?: string[] };
  base?: { country?: string; city?: string };
  relocation: { open: boolean; regions?: string[]; countries?: string[] };
};

/**
 * The signed-in user's saved profile, as returned by `GET /api/v1/me/profile`
 * (null when they haven't saved one).
 *
 * Every WRITABLE field the server holds is here, and that is deliberate:
 * `PUT /me/profile` replaces the whole row, so a type carrying a subset of it
 * would build a write that silently drops whatever it left out — `seniorities`,
 * the desired levels a user may have set on the web, above all. The read-only
 * extras the response also carries (`cv`, `derived_location`, timestamps) are
 * omitted, since no write can drop what no write can set.
 */
export type UserProfile = {
  specializations: string[];
  skills: string[];
  /** Desired levels. Not edited by the mobile editor — only preserved by it. */
  seniorities: string[];
  excluded_skills: string[];
  location_preferences: LocationPreferences | null;
};

/** One skill the viewer doesn't hold outright but has a neighbour of, per the
 *  server's curated adjacency dictionary. `via` is the held skill that satisfied
 *  it — `{name: "aws", via: "gcp"}` reads as "close: you have gcp". */
export type AdjacentSkill = {
  name: string;
  via: string;
};

/**
 * The per-job profile match from `GET /api/v1/jobs/:slug/match`. `matched`,
 * `adjacent` and `missing` preserve the job's own skill order within each group.
 * `coverage_percent` weighs an exact match as 1 and an adjacent one as one half,
 * which is the same weighting `matchBarSegments` draws — see `lib/jobMatch.ts`.
 *
 * Unlike `computeClientMatch`, this is the server's classification: the adjacency
 * dictionary lives on the backend, so `adjacent` is the part of the signal the
 * device cannot derive for itself.
 */
export type JobMatch = {
  total: number;
  exact_count: number;
  adjacent_count: number;
  coverage_percent: number;
  matched: string[];
  adjacent: AdjacentSkill[];
  missing: string[];
};

/** One deterministic hard-constraint check (years, education, language, work
 *  authorization, location/work mode, certification) served beside the skill
 *  coverage. Advisory only — a blocker never hides or downranks a job. */
export type Blocker = {
  category: string; // "experience" | "education" | "language" | "work_authorization" | ...
  severity: string; // "hard" | "medium" | "soft"
  score_cap: number; // the lower the cap, the harder the blocker
  reason: string;
  action: string;
  met: boolean;
};

/** The match endpoint's full payload. `blockers` is always present — empty when
 *  the caller has no structured résumé, so the result degrades to skill coverage
 *  rather than erroring. Nothing renders it yet; typing half a payload would
 *  misdescribe it. */
export type JobMatchResult = JobMatch & {
  blockers: Blocker[];
};

/** A user's interaction with one job. Returned by save/apply/track endpoints. */
export type UserJob = {
  job_id?: number;
  viewed_at?: string | null;
  saved_at: string | null;
  applied_at: string | null;
  dismissed_at?: string | null;
  stage?: string | null;
  notes?: string | null;
};

/**
 * Compact list-row projection of a job for tracking (mirrors backend's jobview.Card).
 * Subset of Job fields with descriptions omitted for performance.
 */
export type TrackerJobCard = {
  public_slug: string;
  title: string;
  company: string;
  closed_at?: string | null;
  work_mode?: string;
  seniority?: string;
  employment_type?: string;
  countries?: string[];
  regions?: string[];
  skills?: string[];
  collections?: string[];
  posted_at?: string | null;
  blurb?: string;
};

/**
 * One item in the tracking listing (mirrors backend's myJobResponse).
 * ID is the row id (either a posting slug, or a<id> when pruned).
 * job is null when the posting has been pruned from catalogue.
 */
export type TrackedJob = {
  id: string;
  company_slug: string;
  role_title: string;
  job: TrackerJobCard | null;
  viewed_at: string | null;
  saved_at: string | null;
  applied_at: string | null;
  stage: string | null;
  notes: string | null;
  email_count: number;
  last_activity_at: string | null;
  days_silent: number | null;
  silence_state: string | null;
  followed_up_at: string | null;
  cv_opened_at: string | null;
};

/** The per-filter counts for the tracking tabs/chips. */
export type TrackingCounts = {
  all: number;
  viewed: number;
  saved: number;
  applied: number;
  board: number;
  dismissed: number;
};

/** The tracking listing envelope returned by GET /api/v1/me/tracking. */
export type TrackingPage = {
  data: TrackedJob[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    counts: TrackingCounts;
  };
};

/** Pipeline snapshot returned by GET /api/v1/me/tracking/pipeline. */
export type PipelineStats = {
  total: number;
  stages: Record<string, number>;
};


/** One device registered to receive push notifications. `token` is this app
 *  install's Expo push token — the only field that identifies *which* device a
 *  row is, and so the only way this app can recognize itself in the list. */
export type PushDevice = {
  token: string;
  platform: string;
  created_at: string | null;
  last_seen_at: string | null;
};

/**
 * What a test push actually did, per registered device. The four counts are the
 * point: a `200` with `devices: 0` sent nothing, and `pruned` means the token
 * was dead and the backend has just removed it — a successful call that
 * delivered nothing and needs the user to re-register. `sent + pruned + failed`
 * equals `devices`.
 */
export type TestPushResult = {
  devices: number;
  sent: number;
  pruned: number;
  failed: number;
};

/** The lower-coverage extras stored in the company's `company_info` JSONB
 *  (mirrors `hire/web`'s `CompanyInfo`, trimmed to what the read-only company
 *  screen renders). Every field is optional — absent when the source didn't
 *  provide it. */
export type CompanyInfo = {
  description?: string;
  website?: string;
  linkedin?: string;
  yc_url?: string;
  stage?: string;
  top_company?: boolean;
  is_hiring?: boolean;
  funding?: {
    type?: string;
    amount?: number;
    year?: number;
    investors?: string[];
  };
  stock?: {
    symbol?: string;
    exchange?: string;
  };
  logo?: string;
  homepage?: string;
};

/** A company, as returned by the company-detail endpoint (mirrors `hire/web`'s
 *  `Company`, trimmed to what mobile's read-only company screen renders — no
 *  `my_vote`/`collections`/directory-hierarchy fields since there's no voting
 *  or collection UI here). */
export type Company = {
  slug: string;
  name: string;
  industries?: string[];
  year_founded?: number | null;
  employee_count?: number | null;
  hq_country?: string | null;
  organization_type?: string | null;
  tagline?: string | null;
  company_info?: CompanyInfo;
  upvote_count: number;
  downvote_count: number;
  feedback_count: number;
  feedback_rating_avg: number | null;
};

/** One row of the company directory, as returned by the company LIST endpoint.
 *  Deliberately not the same type as `Company`: the two endpoints serve
 *  different projections — the list carries `job_count` and `collections`,
 *  which the detail payload has no notion of, and omits everything under
 *  `company_info`. The backend keeps them apart for the same reason (see
 *  `companyListItem` in `hire/internal/handler/companies.go`), so folding both
 *  into one optional-riddled type here would only lose that guarantee. */
export type CompanyListItem = {
  slug: string;
  name: string;
  job_count: number;
  tagline?: string | null;
  industries?: string[] | null;
  hq_country?: string | null;
  collections?: string[] | null;
  feedback_count: number;
  feedback_rating_avg: number | null;
};

/** The company-detail endpoint's payload: the company plus its job list and
 *  whether a referral is available for it. */
export type CompanyPage = {
  company: Company;
  jobs: Job[];
  referral_available: boolean;
};

/** The list envelope every paginated read returns. */
export type Page<T> = {
  data: T[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
};

/**
 * One row in the notification center — a durable, readable-by-the-owner
 * record of a delivery event from the digest/reminder/nudge engines,
 * independent of which channel(s) carried it. `public_slug` is null when the
 * event concerns no single job (e.g. a multi-job subscription digest), so a
 * card with no slug has no navigation target. `read_at` is null until the
 * user marks it read (opening the list does not mark anything read).
 */
export type NotificationItem = {
  id: number;
  kind: string; // "subscription_digest" | "reminder" | "nudge_follow_up" | "nudge_interview_prep" | "nudge_job_closed"
  title: string;
  body: string;
  public_slug: string | null;
  /** A multi-job subscription digest's matched-jobs snapshot as of delivery
   *  (not a live re-run of the saved search) — present only for that one case;
   *  absent/null for every other kind and for a single-job digest, which uses
   *  `public_slug` instead. */
  jobs?: NotificationDigestJob[] | null;
  created_at: string;
  read_at: string | null;
};

/** One matched job as recorded into a multi-job digest's `jobs` snapshot. */
export type NotificationDigestJob = {
  title: string;
  company: string;
  slug: string;
};

/** The notification list envelope: `Page<NotificationItem>` plus the caller's
 *  total unread count, cheap to include (one `COUNT(*) FILTER` on the same
 *  query the page already runs) — see `GET /me/notifications`. */
export type NotificationsPage = {
  data: NotificationItem[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    unread_count: number;
  };
};

/**
 * The facets endpoint's payload: an estimated matching `total`, per-value counts
 * keyed by the same param name used to filter (`facets.regions.eu = 1234`), and
 * numeric ranges for slider facets. `facets`/`stats` may be absent — the client
 * normalizes them to `{}`. Drives the live "Show N jobs" count and the
 * data-driven country options.
 */
export type FacetCounts = {
  total: number;
  facets: Record<string, Record<string, number>>;
  stats: Record<string, { min: number; max: number }>;
};
