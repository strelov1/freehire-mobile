import {
  clearApplicationStage,
  getTrackedJobs,
  getTrackingPipeline,
  markJobApplied,
  trackApplication,
  untrackApplication,
} from './api';

function mockResponse(status: number, data: unknown) {
  const body = JSON.stringify(data);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    text: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('tracker API contract transports', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('getTrackedJobs calls GET /api/v1/me/tracking with filter, limit, offset, and required auth', async () => {
    const fakeData = {
      data: [
        {
          id: 'slug-1',
          company_slug: 'acme',
          role_title: 'Engineer',
          job: null,
          viewed_at: null,
          saved_at: '2026-08-01T00:00:00Z',
          applied_at: null,
          stage: null,
          notes: null,
          email_count: 0,
          last_activity_at: null,
          days_silent: null,
          silence_state: null,
          followed_up_at: null,
          cv_opened_at: null,
        },
      ],
      meta: {
        total: 1,
        limit: 500,
        offset: 0,
        counts: { all: 1, viewed: 0, saved: 1, applied: 0, board: 1, dismissed: 0 },
      },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse(200, fakeData));

    const result = await getTrackedJobs(42, 'board', 500, 0);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/me/tracking?filter=board&limit=500&offset=0'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      }),
    );
    expect(result.data.length).toBe(1);
    expect(result.meta.total).toBe(1);
  });

  it('getTrackingPipeline calls GET /api/v1/me/tracking/pipeline and extracts pipeline stats', async () => {
    const fakeData = {
      data: {
        total: 5,
        stages: { applied: 3, interview: 2 },
      },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse(200, fakeData));

    const result = await getTrackingPipeline(42);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/me/tracking/pipeline'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      }),
    );
    expect(result).toEqual({
      total: 5,
      stages: { applied: 3, interview: 2 },
    });
  });

  it('markJobApplied sends POST /jobs/:slug/apply with no body when appliedOn is omitted', async () => {
    const fakeResult = {
      data: { saved_at: null, applied_at: '2026-08-27T00:00:00Z', stage: 'applied' },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse(200, fakeResult));

    const res = await markJobApplied('acme-eng', 42);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/jobs/acme-eng/apply'),
      expect.objectContaining({
        method: 'POST',
        body: undefined,
      }),
    );
    expect(res.stage).toBe('applied');
  });

  it('markJobApplied encodes special slug chars and passes optional applied_on', async () => {
    const fakeResult = {
      data: { saved_at: null, applied_at: '2026-08-20T00:00:00Z', stage: 'applied' },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse(200, fakeResult));

    await markJobApplied('acme/c++', 42, '2026-08-20');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/jobs/acme%2Fc%2B%2B/apply'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ applied_on: '2026-08-20' }),
      }),
    );
  });

  it('trackApplication sends PATCH /me/applications/:id with stage and notes', async () => {
    const fakeResult = {
      data: { saved_at: null, applied_at: null, stage: 'interview', notes: 'Scheduled for Fri' },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse(200, fakeResult));

    const res = await trackApplication('a123', 'interview', 'Scheduled for Fri', 42);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/me/applications/a123'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ stage: 'interview', notes: 'Scheduled for Fri' }),
      }),
    );
    expect(res.stage).toBe('interview');
  });

  it('clearApplicationStage sends DELETE /me/applications/:id/stage', async () => {
    const fakeResult = {
      data: { saved_at: '2026-08-01T00:00:00Z', applied_at: null, stage: null },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse(200, fakeResult));

    const res = await clearApplicationStage('a456', 42);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/me/applications/a456/stage'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
    expect(res.stage).toBeNull();
  });

  it('untrackApplication sends DELETE /me/applications/:id', async () => {
    const fakeResult = {
      data: { saved_at: null, applied_at: null, stage: null, notes: null },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse(200, fakeResult));

    await untrackApplication('a789', 42);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/me/applications/a789'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });
});
