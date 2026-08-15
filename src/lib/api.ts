/** Public/job API functions. Authentication calls live in features/auth/api. */
import { companyListParams } from './companyList';
import { ApiError, request } from './transport';
import type {
  CompanyListItem,
  CompanyPage,
  FacetCounts,
  Job,
  NotificationItem,
  NotificationsPage,
  Page,
  PushDevice,
  TestPushResult,
  UserJob,
  UserProfile,
} from './types';

export { ApiError } from './transport';
export { authMessage } from '@/features/auth/api/authApi';

// --- User Profile -----------------------------------------------------------

/** The signed-in user's saved profile, or null when they haven't saved one.
 *  Powers the Filters screen's "Apply profile" button. */
export async function getProfile(signal?: AbortSignal): Promise<UserProfile | null> {
  const { data } = await request<{ data: UserProfile | null }>('/api/v1/me/profile', {
    authMode: 'probe',
    signal,
  });
  return data;
}

// --- Saved jobs (session-scoped) --------------------------------------------

export async function saveJob(slug: string, sessionEpoch: number, signal?: AbortSignal): Promise<UserJob> {
  const { data } = await request<{ data: UserJob }>(`/api/v1/jobs/${encodeURIComponent(slug)}/save`, {
    method: 'POST',
    authMode: 'required',
    sessionEpoch,
    signal,
    cache: 'no-store',
  });
  return data;
}

export async function unsaveJob(slug: string, sessionEpoch: number, signal?: AbortSignal): Promise<UserJob> {
  const { data } = await request<{ data: UserJob }>(`/api/v1/jobs/${encodeURIComponent(slug)}/save`, {
    method: 'DELETE',
    authMode: 'required',
    sessionEpoch,
    signal,
    cache: 'no-store',
  });
  return data;
}

export async function savedSlugs(sessionEpoch: number, signal?: AbortSignal): Promise<string[]> {
  const { data } = await request<{ data: string[] }>('/api/v1/me/tracking/saved', {
    authMode: 'required',
    sessionEpoch,
    signal,
    cache: 'no-store',
  });
  return data ?? [];
}

// --- Dismissed (hidden) jobs (session-scoped) -------------------------------

export async function dismissJob(slug: string, signal?: AbortSignal): Promise<UserJob> {
  const { data } = await request<{ data: UserJob }>(`/api/v1/jobs/${encodeURIComponent(slug)}/dismiss`, {
    method: 'POST',
    authMode: 'required',
    signal,
  });
  return data;
}

export async function undismissJob(slug: string, signal?: AbortSignal): Promise<UserJob> {
  const { data } = await request<{ data: UserJob }>(`/api/v1/jobs/${encodeURIComponent(slug)}/dismiss`, {
    method: 'DELETE',
    authMode: 'required',
    signal,
  });
  return data;
}

export async function dismissedSlugs(signal?: AbortSignal): Promise<string[]> {
  const { data } = await request<{ data: string[] }>('/api/v1/me/tracking/dismissed', {
    authMode: 'required',
    signal,
    cache: 'no-store',
  });
  return data ?? [];
}

// --- Push notifications (session-scoped) ------------------------------------

export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android',
  signal?: AbortSignal,
): Promise<void> {
  await request<void>('/api/v1/me/push-tokens', {
    method: 'POST',
    authMode: 'required',
    body: { token, platform },
    signal,
  });
}

export async function listPushDevices(signal?: AbortSignal): Promise<PushDevice[]> {
  const { data } = await request<{ data: PushDevice[] }>('/api/v1/me/push-tokens', {
    authMode: 'required',
    signal,
  });
  return data ?? [];
}

export async function unregisterPushToken(token: string, signal?: AbortSignal): Promise<void> {
  try {
    await request<void>('/api/v1/me/push-tokens', {
      method: 'DELETE',
      authMode: 'required',
      body: { token },
      signal,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return;
    throw err;
  }
}

export async function sendTestPush(signal?: AbortSignal): Promise<TestPushResult> {
  const { data } = await request<{ data: TestPushResult }>('/api/v1/me/push-tokens/test', {
    method: 'POST',
    authMode: 'required',
    signal,
  });
  return data;
}

// --- Notification center (session-scoped) -----------------------------------

export async function getNotifications(
  limit?: number,
  offset?: number,
  signal?: AbortSignal,
): Promise<NotificationsPage> {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const qs = params.toString();
  return request<NotificationsPage>(`/api/v1/me/notifications${qs ? `?${qs}` : ''}`, {
    authMode: 'required',
    signal,
  });
}

export async function getNotification(id: number, signal?: AbortSignal): Promise<NotificationItem> {
  const { data } = await request<{ data: NotificationItem }>(`/api/v1/me/notifications/${id}`, {
    authMode: 'required',
    signal,
  });
  return data;
}

export async function markNotificationRead(id: number, signal?: AbortSignal): Promise<void> {
  await request<void>(`/api/v1/me/notifications/${id}/read`, {
    method: 'POST',
    authMode: 'required',
    signal,
  });
}

export async function markAllNotificationsRead(signal?: AbortSignal): Promise<{ marked: number }> {
  const { data } = await request<{ data: { marked: number } }>('/api/v1/me/notifications/read-all', {
    method: 'POST',
    authMode: 'required',
    signal,
  });
  return data;
}

// --- Jobs & search (public) -------------------------------------------------

export function searchJobs(query: string, limit: number, offset: number, signal?: AbortSignal): Promise<Page<Job>> {
  const params = new URLSearchParams(query);
  params.set('semantic_ratio', '0');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return request<Page<Job>>(`/api/v1/jobs/search?${params.toString()}`, { authMode: 'public', signal });
}

export async function facetCounts(query: string, signal?: AbortSignal): Promise<FacetCounts> {
  const params = new URLSearchParams(query);
  params.set('disjunctive', '1');
  const { data } = await request<{ data: FacetCounts }>(`/api/v1/jobs/facets?${params.toString()}`, {
    authMode: 'public',
    signal,
  });
  return { total: data.total ?? 0, facets: data.facets ?? {}, stats: data.stats ?? {} };
}

export async function getJob(slug: string, signal?: AbortSignal): Promise<Job> {
  const { data } = await request<{ data: Job }>(`/api/v1/jobs/${encodeURIComponent(slug)}`, {
    authMode: 'public',
    signal,
  });
  return data;
}

export function listCompanies(
  q: string,
  limit: number,
  offset: number,
  signal?: AbortSignal,
): Promise<Page<CompanyListItem>> {
  const params = companyListParams(q, limit, offset);
  return request<Page<CompanyListItem>>(`/api/v1/companies?${params.toString()}`, {
    authMode: 'public',
    signal,
  });
}

export async function getCompany(
  slug: string,
  limit?: number,
  offset?: number,
  signal?: AbortSignal,
): Promise<CompanyPage> {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const qs = params.toString();
  const { data } = await request<{ data: CompanyPage }>(
    `/api/v1/companies/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`,
    { authMode: 'public', signal },
  );
  return data;
}
