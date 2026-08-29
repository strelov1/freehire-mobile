import {
  CLOSED_OUTCOMES,
  STAGE_LABELS,
  TRACKER_STAGES,
  canMarkApplied,
  deriveFilterCounts,
  filterTrackedJobs,
  formatSilence,
  groupOf,
  isPrunedJob,
  matchesFilter,
  matchesSearch,
  optimisticMoveToSaved,
  optimisticPatchApplied,
  optimisticPatchNotes,
  optimisticPatchStage,
  optimisticRemoveJob,
  PartialTrackerError,
  shouldRollbackOptimisticPatch,
  stageLabel,
} from './tracker';
import type { TrackedJob, TrackingPage } from './types';

const sampleJob: TrackedJob = {
  id: 'acme-backend-engineer',
  company_slug: 'acme',
  role_title: 'Senior Go Engineer',
  job: {
    public_slug: 'acme-backend-engineer',
    title: 'Senior Go Engineer',
    company: 'Acme Corp',
  },
  viewed_at: '2026-08-01T10:00:00Z',
  saved_at: '2026-08-01T11:00:00Z',
  applied_at: null,
  stage: null,
  notes: null,
  email_count: 0,
  last_activity_at: null,
  days_silent: null,
  silence_state: null,
  followed_up_at: null,
  cv_opened_at: null,
};

describe('tracker stages and groups', () => {
  it('covers all 10 canonical stages in STAGE_LABELS', () => {
    for (const stage of TRACKER_STAGES) {
      expect(STAGE_LABELS[stage]).toBeDefined();
    }
  });

  it('maps every active stage to its appropriate group', () => {
    expect(groupOf({ stage: 'preparing', applied_at: null, saved_at: '2026-08-01' })).toBe(
      'preparing',
    );
    expect(groupOf({ stage: 'applied', applied_at: '2026-08-01', saved_at: null })).toBe('applied');
    expect(groupOf({ stage: 'screening', applied_at: '2026-08-01', saved_at: null })).toBe(
      'applied',
    );
    expect(groupOf({ stage: 'responded', applied_at: '2026-08-01', saved_at: null })).toBe(
      'applied',
    );
    expect(groupOf({ stage: 'interview', applied_at: '2026-08-01', saved_at: null })).toBe(
      'interview',
    );
    expect(groupOf({ stage: 'offer', applied_at: '2026-08-01', saved_at: null })).toBe('offer');
  });

  it('maps all 4 closed outcomes to the closed group', () => {
    for (const { stage } of CLOSED_OUTCOMES) {
      expect(groupOf({ stage, applied_at: '2026-08-01', saved_at: null })).toBe('closed');
    }
  });

  it('preserves Saved as a client-only group', () => {
    expect(groupOf({ stage: null, applied_at: null, saved_at: '2026-08-01' })).toBe('saved');
  });

  it('maps legacy applied_at with no stage to applied', () => {
    expect(groupOf({ stage: null, applied_at: '2026-08-01', saved_at: null })).toBe('applied');
  });

  it('maps unknown stage to unknown', () => {
    expect(groupOf({ stage: 'custom_future_stage', applied_at: null, saved_at: null })).toBe(
      'unknown',
    );
  });

  it('maps row with no stage, applied_at, or saved_at to unknown', () => {
    expect(groupOf({ stage: null, applied_at: null, saved_at: null })).toBe('unknown');
  });

  it('formats stage labels cleanly including fallback for unknown stages', () => {
    expect(stageLabel('interview')).toBe('Interview');
    expect(stageLabel('custom_stage')).toBe('Custom_stage');
    expect(stageLabel(null)).toBe('');
  });
});

describe('filter and search matching', () => {
  const jobs: TrackedJob[] = [
    { ...sampleJob, id: '1', stage: null, saved_at: '2026-08-01' }, // saved
    { ...sampleJob, id: '2', stage: 'preparing', saved_at: '2026-08-01' }, // preparing
    { ...sampleJob, id: '3', stage: 'applied', applied_at: '2026-08-01' }, // applied
    { ...sampleJob, id: '4', stage: 'interview', applied_at: '2026-08-01' }, // interview
    { ...sampleJob, id: '5', stage: 'offer', applied_at: '2026-08-01' }, // offer
    { ...sampleJob, id: '6', stage: 'rejected', applied_at: '2026-08-01' }, // closed
    { ...sampleJob, id: '7', stage: 'unknown_future', applied_at: null }, // unknown
  ];

  it('matches all filter tab for all rows', () => {
    for (const job of jobs) {
      expect(matchesFilter(job, 'all')).toBe(true);
    }
  });

  it('matches specific stage filters', () => {
    expect(jobs.filter((j) => matchesFilter(j, 'saved')).map((j) => j.id)).toEqual(['1']);
    expect(jobs.filter((j) => matchesFilter(j, 'preparing')).map((j) => j.id)).toEqual(['2']);
    expect(jobs.filter((j) => matchesFilter(j, 'applied')).map((j) => j.id)).toEqual(['3']);
    expect(jobs.filter((j) => matchesFilter(j, 'interview')).map((j) => j.id)).toEqual(['4']);
    expect(jobs.filter((j) => matchesFilter(j, 'offer')).map((j) => j.id)).toEqual(['5']);
    expect(jobs.filter((j) => matchesFilter(j, 'closed')).map((j) => j.id)).toEqual(['6']);
  });

  it('performs tokenized search matching', () => {
    const job: TrackedJob = {
      ...sampleJob,
      role_title: 'Staff Frontend Engineer',
      company_slug: 'stripe',
      job: { public_slug: 'stripe-staff-frontend', title: 'Staff Frontend Engineer', company: 'Stripe' },
    };

    expect(matchesSearch(job, 'staff stripe')).toBe(true);
    expect(matchesSearch(job, 'frontend')).toBe(true);
    expect(matchesSearch(job, 'backend')).toBe(false);
    expect(matchesSearch(job, '')).toBe(true);
    expect(matchesSearch(job, '   ')).toBe(true);
  });

  it('combines filtering and searching via filterTrackedJobs', () => {
    const list: TrackedJob[] = [
      {
        ...sampleJob,
        id: '1',
        role_title: 'React Native Dev',
        stage: 'interview',
        applied_at: '2026-08-01',
      },
      {
        ...sampleJob,
        id: '2',
        role_title: 'Go Engineer',
        stage: 'interview',
        applied_at: '2026-08-01',
      },
      {
        ...sampleJob,
        id: '3',
        role_title: 'React Native Dev',
        stage: 'applied',
        applied_at: '2026-08-01',
      },
    ];

    const result = filterTrackedJobs(list, 'interview', 'react');
    expect(result.map((j) => j.id)).toEqual(['1']);
  });

  it('derives dynamic filter counts accurately', () => {
    const counts = deriveFilterCounts(jobs);
    expect(counts).toEqual({
      all: 7,
      saved: 1,
      preparing: 1,
      applied: 1,
      interview: 1,
      offer: 1,
      closed: 1,
    });
  });
});

describe('silence formatting and signals', () => {
  it('returns null for null silence triplet', () => {
    expect(formatSilence(null, null)).toBeNull();
    expect(formatSilence(5, null)).toBeNull();
    expect(formatSilence(null, 'silent')).toBeNull();
  });

  it('formats silent state with warning label', () => {
    expect(formatSilence(24, 'silent')).toBe('No reply · 24d');
  });

  it('formats unconfirmed state', () => {
    expect(formatSilence(3, 'unconfirmed')).toBe('Mail waiting · 3d');
  });

  it('formats active state with elapsed days', () => {
    expect(formatSilence(5, 'active')).toBe('5d');
  });
});

describe('pruned job & mark applied eligibility', () => {
  it('detects pruned job when job object is null', () => {
    expect(isPrunedJob({ job: null })).toBe(true);
    expect(isPrunedJob({ job: sampleJob.job })).toBe(false);
  });

  it('permits mark applied for saved and preparing rows with live job', () => {
    expect(canMarkApplied({ job: sampleJob.job, applied_at: null, stage: null })).toBe(true);
    expect(canMarkApplied({ job: sampleJob.job, applied_at: null, stage: 'preparing' })).toBe(true);
  });

  it('rejects mark applied for already applied, other stages, or pruned jobs', () => {
    expect(canMarkApplied({ job: sampleJob.job, applied_at: '2026-08-01', stage: 'applied' })).toBe(
      false,
    );
    expect(canMarkApplied({ job: sampleJob.job, applied_at: null, stage: 'interview' })).toBe(false);
    expect(canMarkApplied({ job: null, applied_at: null, stage: 'preparing' })).toBe(false);
  });
});

describe('optimistic cache transforms', () => {
  const initialPage: TrackingPage = {
    data: [
      { ...sampleJob, id: 'job-1', stage: 'preparing', notes: 'Initial notes' },
      {
        ...sampleJob,
        id: 'job-2',
        stage: null,
        saved_at: '2026-08-01',
        job: { ...sampleJob.job!, public_slug: 'other-job-slug' },
      },
    ],
    meta: {
      total: 2,
      limit: 500,
      offset: 0,
      counts: { all: 2, viewed: 0, saved: 1, applied: 0, board: 2, dismissed: 0 },
    },
  };

  it('optimistically patches stage and notes', () => {
    const updated = optimisticPatchStage(initialPage, 'job-1', 'interview', 'Updated notes');
    expect(updated?.data[0]?.stage).toBe('interview');
    expect(updated?.data[0]?.notes).toBe('Updated notes');
    expect(updated?.data[1]?.stage).toBeNull();
  });

  it('optimistically patches notes only', () => {
    const updated = optimisticPatchNotes(initialPage, 'job-1', 'Only notes updated');
    expect(updated?.data[0]?.stage).toBe('preparing');
    expect(updated?.data[0]?.notes).toBe('Only notes updated');
  });

  it('optimistically patches applied status', () => {
    const now = '2026-08-27T12:00:00Z';
    const updated = optimisticPatchApplied(initialPage, 'job-2', now);
    expect(updated?.data[1]?.applied_at).toBe(now);
    expect(updated?.data[1]?.stage).toBe('applied');
    expect(updated?.data[1]?.silence_state).toBe('active');
    expect(updated?.data[1]?.days_silent).toBe(0);
  });

  it('optimistically removes job and decrements total count', () => {
    const updated = optimisticRemoveJob(initialPage, 'job-1');
    expect(updated?.data.length).toBe(1);
    expect(updated?.data[0]?.id).toBe('job-2');
    expect(updated?.meta.total).toBe(1);
  });

  it('optimistically moves job to saved', () => {
    const now = '2026-08-27T12:00:00Z';
    const updated = optimisticMoveToSaved(initialPage, 'job-1', now);
    expect(updated?.data[0]?.saved_at).toBe(now);
    expect(updated?.data[0]?.applied_at).toBeNull();
    expect(updated?.data[0]?.stage).toBeNull();
    expect(updated?.data[0]?.silence_state).toBeNull();
  });

  it('rolls the optimistic patch back for an ordinary failure but not a partial one', () => {
    expect(shouldRollbackOptimisticPatch(new Error('Network request failed'))).toBe(true);
    expect(shouldRollbackOptimisticPatch(undefined)).toBe(true);
    expect(
      shouldRollbackOptimisticPatch(
        new PartialTrackerError("Saved to bookmarks, but couldn't clear application progress."),
      ),
    ).toBe(false);
  });

  it('matches by job public_slug across optimistic patchers', () => {
    const updatedStage = optimisticPatchStage(initialPage, 'acme-backend-engineer', 'interview');
    expect(updatedStage?.data[0]?.stage).toBe('interview');

    const updatedNotes = optimisticPatchNotes(initialPage, 'acme-backend-engineer', 'Slug matched notes');
    expect(updatedNotes?.data[0]?.notes).toBe('Slug matched notes');

    const updatedRemoved = optimisticRemoveJob(initialPage, 'acme-backend-engineer');
    expect(updatedRemoved?.data.length).toBe(1);
    expect(updatedRemoved?.data[0]?.id).toBe('job-2');
  });
});
