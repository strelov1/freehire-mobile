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

/** The signed-in user's saved profile, as returned by `GET /api/v1/me/profile`
 *  (null when they haven't saved one). A deliberate subset of the server's full
 *  model — mobile has no profile-editing screen, so it only reads the fields
 *  `filtersFromProfile` seeds the job filters from. */
export type UserProfile = {
  specializations: string[];
  skills: string[];
  excluded_skills: string[];
  location_preferences: LocationPreferences | null;
};

/** A user's interaction with one job. Returned by the save endpoints; `saved_at`
 *  is set when saved and null once cleared. */
export type UserJob = {
  saved_at: string | null;
  applied_at: string | null;
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
