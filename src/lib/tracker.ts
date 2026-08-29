import type { TrackedJob, TrackingPage } from './types';

export const TRACKER_STAGES = [
  'preparing',
  'applied',
  'screening',
  'responded',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
] as const;

export type TrackerStage = (typeof TRACKER_STAGES)[number];

export const TRACKER_GROUPS = [
  'saved',
  'preparing',
  'applied',
  'interview',
  'offer',
  'closed',
] as const;

export type TrackerGroup = (typeof TRACKER_GROUPS)[number];

export const TRACKER_FILTERS = [
  'all',
  'saved',
  'preparing',
  'applied',
  'interview',
  'offer',
  'closed',
] as const;

export type TrackerFilter = (typeof TRACKER_FILTERS)[number];

export const STAGE_LABELS: Record<TrackerStage, string> = {
  preparing: 'Preparing',
  applied: 'Applied',
  screening: 'Screening',
  responded: 'Responded',
  interview: 'Interview',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

export const GROUP_LABELS: Record<TrackerGroup, string> = {
  saved: 'Saved',
  preparing: 'Preparing',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
};

export const FILTER_LABELS: Record<TrackerFilter, string> = {
  all: 'All',
  saved: 'Saved',
  preparing: 'Preparing',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
};

export const CLOSED_OUTCOMES: { stage: TrackerStage; label: string }[] = [
  { stage: 'accepted', label: 'Accepted' },
  { stage: 'rejected', label: 'Rejected' },
  { stage: 'withdrawn', label: 'Withdrawn' },
  { stage: 'expired', label: 'Expired' },
];

export const ACTIVE_STAGES: { stage: TrackerStage; label: string }[] = [
  { stage: 'preparing', label: 'Preparing' },
  { stage: 'applied', label: 'Applied' },
  { stage: 'screening', label: 'Screening' },
  { stage: 'responded', label: 'Responded' },
  { stage: 'interview', label: 'Interview' },
  { stage: 'offer', label: 'Offer' },
];

/**
 * Maps an application row to its coarse display group.
 * Preserves Saved as a client-only group (saved_at set, no stage, no applied_at).
 * An applied row with an unknown stage or legacy applied_at still maps to 'applied'.
 * Returns 'unknown' if no stage, applied_at, or saved_at is present.
 */
export function groupOf(
  job: Pick<TrackedJob, 'stage' | 'applied_at' | 'saved_at'>,
): TrackerGroup | 'unknown' {
  if (job.stage === 'preparing') return 'preparing';
  if (job.stage === 'applied' || job.stage === 'screening' || job.stage === 'responded') {
    return 'applied';
  }
  if (job.stage === 'interview') return 'interview';
  if (job.stage === 'offer') return 'offer';
  if (
    job.stage === 'accepted' ||
    job.stage === 'rejected' ||
    job.stage === 'withdrawn' ||
    job.stage === 'expired'
  ) {
    return 'closed';
  }

  // Unrecognized stage string maps to 'unknown'
  if (job.stage) {
    return 'unknown';
  }

  // Legacy applied_at with no stage
  if (job.applied_at) {
    return 'applied';
  }

  // Saved client-only group: bookmarked, but not yet preparing or applied
  if (job.saved_at) {
    return 'saved';
  }

  return 'unknown';
}

/** Human-readable label for any stage (known or unknown). */
export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return '';
  if (stage in STAGE_LABELS) return STAGE_LABELS[stage as TrackerStage];
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

/** Reports whether a tracked job matches the selected filter tab. */
export function matchesFilter(job: TrackedJob, filter: TrackerFilter): boolean {
  if (filter === 'all') return true;
  const group = groupOf(job);
  return group === filter;
}

/** Tokenized search across role title, company name, and company slug. */
export function matchesSearch(job: TrackedJob, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const tokens = query.split(/\s+/).filter(Boolean);
  const searchableText = [
    job.role_title,
    job.company_slug,
    job.job?.title,
    job.job?.company,
    job.job?.public_slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => searchableText.includes(token));
}

/** Filters and searches a list of tracked jobs. */
export function filterTrackedJobs(
  jobs: TrackedJob[],
  filter: TrackerFilter,
  search: string,
): TrackedJob[] {
  return jobs.filter((job) => matchesFilter(job, filter) && matchesSearch(job, search));
}

/** Computes count badges for each stage filter from the loaded row set. */
export function deriveFilterCounts(jobs: TrackedJob[]): Record<TrackerFilter, number> {
  const counts: Record<TrackerFilter, number> = {
    all: jobs.length,
    saved: 0,
    preparing: 0,
    applied: 0,
    interview: 0,
    offer: 0,
    closed: 0,
  };

  for (const job of jobs) {
    const group = groupOf(job);
    if (group !== 'unknown' && group in counts) {
      counts[group as TrackerGroup]++;
    }
  }

  return counts;
}

/** Formats silence days and state into a short display badge text. */
export function formatSilence(
  daysSilent: number | null | undefined,
  state: string | null | undefined,
): string | null {
  if (daysSilent == null || !state) return null;
  if (state === 'silent') {
    return `No reply · ${daysSilent}d`;
  }
  if (state === 'unconfirmed') {
    return `Mail waiting · ${daysSilent}d`;
  }
  if (state === 'active') {
    return `${daysSilent}d`;
  }
  return null;
}

/** Reports whether this row is an orphan (posting pruned from catalog). */
export function isPrunedJob(job: Pick<TrackedJob, 'job'>): boolean {
  return job.job === null;
}

/** Reports whether this row is eligible to be marked as applied today. */
export function canMarkApplied(
  job: Pick<TrackedJob, 'job' | 'applied_at' | 'stage'>,
): boolean {
  if (job.job === null) return false;
  if (job.applied_at !== null) return false;
  return job.stage === null || job.stage === 'preparing';
}

/** Helper matching a row by database ID or job public slug. */
export function isJobMatch(item: TrackedJob, idOrSlug: string): boolean {
  return item.id === idOrSlug || item.job?.public_slug === idOrSlug;
}

// --- Pure Optimistic Cache Updates ------------------------------------------

export function optimisticPatchStage(
  oldPage: TrackingPage | undefined,
  idOrSlug: string,
  stage: string | null,
  notes?: string | null,
): TrackingPage | undefined {
  if (!oldPage) return oldPage;
  return {
    ...oldPage,
    data: oldPage.data.map((item) => {
      if (!isJobMatch(item, idOrSlug)) return item;
      return {
        ...item,
        stage: stage !== undefined ? stage : item.stage,
        notes: notes !== undefined ? notes : item.notes,
      };
    }),
  };
}

export function optimisticPatchNotes(
  oldPage: TrackingPage | undefined,
  idOrSlug: string,
  notes: string | null,
): TrackingPage | undefined {
  if (!oldPage) return oldPage;
  return {
    ...oldPage,
    data: oldPage.data.map((item) => {
      if (!isJobMatch(item, idOrSlug)) return item;
      return {
        ...item,
        notes,
      };
    }),
  };
}

export function optimisticPatchApplied(
  oldPage: TrackingPage | undefined,
  idOrSlug: string,
  appliedAt: string,
): TrackingPage | undefined {
  if (!oldPage) return oldPage;
  return {
    ...oldPage,
    data: oldPage.data.map((item) => {
      if (!isJobMatch(item, idOrSlug)) return item;
      return {
        ...item,
        applied_at: appliedAt,
        stage: item.stage === 'preparing' || item.stage === null ? 'applied' : item.stage,
        last_activity_at: appliedAt,
        days_silent: 0,
        silence_state: 'active',
      };
    }),
  };
}

export function optimisticRemoveJob(
  oldPage: TrackingPage | undefined,
  idOrSlug: string,
): TrackingPage | undefined {
  if (!oldPage) return oldPage;
  const filtered = oldPage.data.filter((item) => !isJobMatch(item, idOrSlug));
  return {
    ...oldPage,
    data: filtered,
    meta: {
      ...oldPage.meta,
      total: Math.max(0, oldPage.meta.total - 1),
    },
  };
}

export function optimisticMoveToSaved(
  oldPage: TrackingPage | undefined,
  idOrSlug: string,
  savedAt: string,
): TrackingPage | undefined {
  if (!oldPage) return oldPage;
  return {
    ...oldPage,
    data: oldPage.data.map((item) => {
      if (!isJobMatch(item, idOrSlug)) return item;
      return {
        ...item,
        saved_at: savedAt,
        applied_at: null,
        stage: null,
        last_activity_at: null,
        days_silent: null,
        silence_state: null,
      };
    }),
  };
}
