/**
 * The only module that knows the API base URL and wire shapes. Screens call the
 * typed functions here; they never touch fetch or URLs directly. Mirrors the
 * web client's contract (see hire/web/src/lib/api.ts) against the same public
 * endpoints, so the mobile feed and the website read identical data.
 */

import type {
  CompanyPage,
  FacetCounts,
  Job,
  NotificationItem,
  NotificationsPage,
  Page,
  PushDevice,
  TestPushResult,
  User,
  UserJob,
  UserProfile,
} from './types';

/** Production API. Public, unauthenticated reads — no key needed for the feed. */
export const API_BASE = 'https://freehire.dev';

/**
 * A failed API call, carrying the HTTP status and the server's `{"error": …}`
 * message so callers (and `authMessage`) can turn it into friendly copy. The
 * session rides the native cookie jar — React Native's fetch stores the
 * `hire_token` cookie from login and re-sends it automatically, so no request
 * here attaches auth explicitly.
 */
export class ApiError extends Error {
  status: number;
  serverError?: string;
  constructor(status: number, serverError?: string) {
    super(serverError ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.serverError = serverError;
  }
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`freehire API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

/** Send a JSON request that participates in auth (cookie ride-along), throwing
 *  an `ApiError` with the server message on failure. Returns undefined for 204. */
async function send<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    let serverError: string | undefined;
    try {
      serverError = (await res.json())?.error;
    } catch {
      // non-JSON error body — fall back to the status alone
    }
    throw new ApiError(res.status, serverError);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Auth -------------------------------------------------------------------

/** Turn an auth failure into user-facing copy: prefer the server's own message
 *  (capitalized), else a status-based fallback. Pure — unit-tested. */
export function authMessage(status: number, serverError?: string): string {
  const msg = serverError?.trim();
  if (msg) return msg.charAt(0).toUpperCase() + msg.slice(1);
  switch (status) {
    case 400:
      return 'Please check your email and password.';
    case 401:
      return 'Invalid email or password.';
    case 409:
      return 'That email is already registered.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

const jsonBody = (email: string, password: string) => JSON.stringify({ email, password });

/** Create an account and start a session (the response sets the auth cookie). */
export async function register(email: string, password: string): Promise<User> {
  const { data } = await send<{ data: User }>('/api/v1/auth/register', {
    method: 'POST',
    body: jsonBody(email, password),
  });
  return data;
}

/** Verify credentials and start a session. */
export async function login(email: string, password: string): Promise<User> {
  const { data } = await send<{ data: User }>('/api/v1/auth/login', {
    method: 'POST',
    body: jsonBody(email, password),
  });
  return data;
}

/** Clear the session cookie server-side. Idempotent. */
export async function logout(): Promise<void> {
  await send<void>('/api/v1/auth/logout', { method: 'POST' });
}

/** The current user, or throws `ApiError(401)` when signed out. */
export async function me(): Promise<User> {
  const { data } = await send<{ data: User }>('/api/v1/auth/me', { method: 'GET' });
  return data;
}

/** The signed-in user's saved profile, or null when they haven't saved one.
 *  Powers the Filters screen's "Apply profile" button. Throws `ApiError(401)`
 *  when signed out — callers gate this behind `useAuth().user`. */
export async function getProfile(): Promise<UserProfile | null> {
  const { data } = await send<{ data: UserProfile | null }>('/api/v1/me/profile', { method: 'GET' });
  return data;
}

// --- OAuth (social sign-in) -------------------------------------------------

/** The provider flow's entry URL, tagged `platform=mobile` so the backend
 *  finishes by redirecting to our custom scheme with a one-time code instead of
 *  setting a cookie + web redirect. */
export function oauthStartUrl(provider: string): string {
  return `${API_BASE}/api/v1/auth/oauth/${provider}/start?platform=mobile`;
}

/** The providers the backend has configured (e.g. github/google/linkedin).
 *  Public; callers treat a failure as "no providers". */
export async function oauthProviders(): Promise<string[]> {
  const { data } = await send<{ data: string[] }>('/api/v1/auth/oauth/providers', { method: 'GET' });
  return data ?? [];
}

/** Exchange the one-time code from the OAuth callback deep link for a session.
 *  The response sets the `hire_token` cookie — and because THIS app makes the
 *  request, that cookie lands in the app's jar (unlike the browser flow's). A
 *  bad/expired/used code is a 401 `ApiError`. */
export async function exchangeOAuth(code: string): Promise<User> {
  const { data } = await send<{ data: User }>('/api/v1/auth/oauth/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return data;
}

// --- Saved jobs (session-scoped) --------------------------------------------

/** Mark a job saved (bookmark). Returns the updated interaction. */
export async function saveJob(slug: string): Promise<UserJob> {
  const { data } = await send<{ data: UserJob }>(`/api/v1/jobs/${slug}/save`, { method: 'POST' });
  return data;
}

/** Clear a job's saved mark. Idempotent. */
export async function unsaveJob(slug: string): Promise<UserJob> {
  const { data } = await send<{ data: UserJob }>(`/api/v1/jobs/${slug}/save`, { method: 'DELETE' });
  return data;
}

/** The slugs of every job the signed-in user has saved. */
export async function savedSlugs(): Promise<string[]> {
  const { data } = await send<{ data: string[] }>('/api/v1/me/tracking/saved', { method: 'GET' });
  return data ?? [];
}

// --- Push notifications (session-scoped) ------------------------------------

/** Register (or refresh) this device's Expo push token. The backend upserts by
 *  token, so a device that changes hands is reassigned to the caller rather than
 *  duplicated. Answers 204. */
export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  await send<void>('/api/v1/me/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

/** The caller's registered devices — the source of truth for whether push is on
 *  for THIS device (there is no local copy of that state). */
export async function listPushDevices(): Promise<PushDevice[]> {
  const { data } = await send<{ data: PushDevice[] }>('/api/v1/me/push-tokens', { method: 'GET' });
  return data ?? [];
}

/** Unregister this device. A 404 means the token was already gone (pruned as
 *  dead, or claimed by another account) — that is the state we asked for, so it
 *  is not an error to the caller. */
export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await send<void>('/api/v1/me/push-tokens', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return;
    throw err;
  }
}

/** Push a test notification to the caller's own devices, reporting what
 *  happened per device (see `TestPushResult`). */
export async function sendTestPush(): Promise<TestPushResult> {
  const { data } = await send<{ data: TestPushResult }>('/api/v1/me/push-tokens/test', {
    method: 'POST',
  });
  return data;
}

// --- Notification center (session-scoped) -----------------------------------

/** A page of the caller's notification-center rows, newest first, plus their
 *  total unread count. `limit`/`offset` are optional — omitted, the backend
 *  applies its own default page size starting at zero. */
export async function getNotifications(limit?: number, offset?: number): Promise<NotificationsPage> {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const qs = params.toString();
  return send<NotificationsPage>(`/api/v1/me/notifications${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

/** One notification, including its `jobs` snapshot when it has one — the read
 *  a direct visit/deep-link to the digest jobs-list screen needs, since
 *  getNotifications alone only ever serves the caller's current page. Owner-
 *  scoped: another user's id 404s. */
export async function getNotification(id: number): Promise<NotificationItem> {
  const { data } = await send<{ data: NotificationItem }>(`/api/v1/me/notifications/${id}`, {
    method: 'GET',
  });
  return data;
}

/** Mark one notification read. Idempotent — repeating it on an already-read
 *  notification is a no-op. Owner-scoped: another user's id 404s. Answers 204. */
export async function markNotificationRead(id: number): Promise<void> {
  await send<void>(`/api/v1/me/notifications/${id}/read`, { method: 'POST' });
}

/** Mark every one of the caller's unread notifications read in one call,
 *  reporting how many were marked. */
export async function markAllNotificationsRead(): Promise<{ marked: number }> {
  const { data } = await send<{ data: { marked: number } }>('/api/v1/me/notifications/read-all', {
    method: 'POST',
  });
  return data;
}

/**
 * The filtered/searched feed. Takes the serialized filter query (from
 * `filtersToQuery`) and appends the request constants: `semantic_ratio=0`
 * (keyword ranking, matching the web) plus pagination. An empty `query` yields
 * the plain newest-first stream, so this cleanly replaces the old `listJobs`.
 */
export function searchJobs(query: string, limit: number, offset: number): Promise<Page<Job>> {
  const params = new URLSearchParams(query);
  params.set('semantic_ratio', '0');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return getJSON<Page<Job>>(`/api/v1/jobs/search?${params.toString()}`);
}

/**
 * Per-value facet counts for the same filter query, used by the Filters screen's
 * live "Show N jobs" total and its data-driven country list. `disjunctive=1`
 * makes each facet's counts ignore its own selection, so sibling values still
 * show counts. Missing sections are normalized to `{}`.
 */
export async function facetCounts(query: string): Promise<FacetCounts> {
  const params = new URLSearchParams(query);
  params.set('disjunctive', '1');
  const { data } = await getJSON<{ data: FacetCounts }>(`/api/v1/jobs/facets?${params.toString()}`);
  return { total: data.total ?? 0, facets: data.facets ?? {}, stats: data.stats ?? {} };
}

/**
 * One job by its public slug, for the detail screen. This read returns the FULL
 * job model (unlike the feed's subset): `reality` as an object, `view_count`,
 * `closed_at`, and the extended enrichment facets. The endpoint wraps the record
 * in a `{ data }` envelope, so we unwrap it here and hand the screen a plain Job.
 */
export async function getJob(slug: string): Promise<Job> {
  const { data } = await getJSON<{ data: Job }>(`/api/v1/jobs/${slug}`);
  return data;
}

/**
 * A company by its slug, for the company screen: the company's own fields plus
 * its job list and referral availability. `limit`/`offset` page that job list;
 * omitted, the backend applies its own default. Public, unauthenticated read —
 * same shape as `hire/web`'s `client.getCompany`.
 */
export async function getCompany(
  slug: string,
  limit?: number,
  offset?: number,
): Promise<CompanyPage> {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const qs = params.toString();
  const { data } = await getJSON<{ data: CompanyPage }>(
    `/api/v1/companies/${slug}${qs ? `?${qs}` : ''}`,
  );
  return data;
}
