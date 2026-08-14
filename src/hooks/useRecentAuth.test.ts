import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  clearRecentAuth,
  isRecentAuthRequiredError,
  recordRecentAuth,
  useRecentAuth,
  type UseRecentAuthReturn,
} from './useRecentAuth';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('useRecentAuth', () => {
  const mockPasswordReauth = jest.fn();
  const mockOauthReauth = jest.fn();
  const mockAppleReauth = jest.fn();

  function renderHookHarness(callback: (res: UseRecentAuthReturn) => void) {
    function TestComponent() {
      const result = useRecentAuth();
      React.useEffect(() => {
        callback(result);
      });
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(React.createElement(TestComponent));
    });

    return {
      rerender: () => {
        act(() => {
          renderer.update(React.createElement(TestComponent));
        });
      },
      unmount: () => {
        act(() => {
          renderer.unmount();
        });
      },
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    clearRecentAuth();
    jest.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null },
      state: { status: 'authenticated', user: { id: 1, email: 'test@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null } },
      sessionEpoch: 1,
      passwordReauth: mockPasswordReauth,
      oauthReauth: mockOauthReauth,
      appleReauth: mockAppleReauth,
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => {
      clearRecentAuth();
    });
    jest.useRealTimers();
  });

  it('starts with unauthenticated recent auth state', () => {
    let latestResult!: UseRecentAuthReturn;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    expect(latestResult.hasRecentAuth).toBe(false);
    expect(latestResult.recentAuthExpiresAt).toBeNull();
    expect(latestResult.remainingSeconds).toBe(0);

    unmount();
  });

  it('records recent auth with ISO string and counts down', () => {
    const futureDate = new Date(Date.now() + 300_000);
    let latestResult!: UseRecentAuthReturn;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    act(() => {
      latestResult.recordRecentAuth(futureDate.toISOString());
    });

    expect(latestResult.hasRecentAuth).toBe(true);
    expect(latestResult.recentAuthExpiresAt?.toISOString()).toBe(futureDate.toISOString());
    expect(latestResult.remainingSeconds).toBeGreaterThanOrEqual(299);

    // Fast-forward 100 seconds
    act(() => {
      jest.advanceTimersByTime(100_000);
    });

    expect(latestResult.hasRecentAuth).toBe(true);
    expect(latestResult.remainingSeconds).toBeLessThanOrEqual(200);

    // Fast-forward past expiration
    act(() => {
      jest.advanceTimersByTime(205_000);
    });

    expect(latestResult.hasRecentAuth).toBe(false);
    expect(latestResult.recentAuthExpiresAt).toBeNull();
    expect(latestResult.remainingSeconds).toBe(0);

    unmount();
  });

  it('records recent auth with RecentAuthProof object', () => {
    const futureDate = new Date(Date.now() + 60_000);
    let latestResult!: UseRecentAuthReturn;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    act(() => {
      recordRecentAuth({ recent_auth_expires_at: futureDate.toISOString() });
    });

    expect(latestResult.hasRecentAuth).toBe(true);
    expect(latestResult.remainingSeconds).toBeGreaterThanOrEqual(59);

    unmount();
  });

  it('clears recent auth immediately when clearRecentAuth is invoked', () => {
    const futureDate = new Date(Date.now() + 300_000);
    let latestResult!: UseRecentAuthReturn;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    act(() => {
      latestResult.recordRecentAuth(futureDate);
    });
    expect(latestResult.hasRecentAuth).toBe(true);

    act(() => {
      latestResult.clearRecentAuth();
    });

    expect(latestResult.hasRecentAuth).toBe(false);
    expect(latestResult.recentAuthExpiresAt).toBeNull();
    expect(latestResult.remainingSeconds).toBe(0);

    unmount();
  });

  it('ignores past or invalid expiration timestamps', () => {
    const pastDate = new Date(Date.now() - 10_000);
    let latestResult!: UseRecentAuthReturn;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    act(() => {
      latestResult.recordRecentAuth(pastDate.toISOString());
    });
    expect(latestResult.hasRecentAuth).toBe(false);

    act(() => {
      latestResult.recordRecentAuth('invalid-date');
    });
    expect(latestResult.hasRecentAuth).toBe(false);

    unmount();
  });

  describe('requestReauth', () => {
    it('executes password reauth and updates recent auth proof', async () => {
      const expiresAt = new Date(Date.now() + 300_000).toISOString();
      mockPasswordReauth.mockResolvedValueOnce({ recent_auth_expires_at: expiresAt });

      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      let proof!: unknown;
      await act(async () => {
        proof = await latestResult.requestReauth({ method: 'password', password: 'my-password' });
      });

      expect(mockPasswordReauth).toHaveBeenCalledWith('my-password');
      expect(proof).toEqual({ recent_auth_expires_at: expiresAt });
      expect(latestResult.hasRecentAuth).toBe(true);

      unmount();
    });

    it('executes oauth reauth and updates recent auth proof', async () => {
      const expiresAt = new Date(Date.now() + 300_000).toISOString();
      mockOauthReauth.mockResolvedValueOnce({ recent_auth_expires_at: expiresAt });

      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      await act(async () => {
        await latestResult.requestReauth({ method: 'oauth', provider: 'google' });
      });

      expect(mockOauthReauth).toHaveBeenCalledWith('google');
      expect(latestResult.hasRecentAuth).toBe(true);

      unmount();
    });

    it('executes apple reauth and updates recent auth proof', async () => {
      const expiresAt = new Date(Date.now() + 300_000).toISOString();
      mockAppleReauth.mockResolvedValueOnce({ recent_auth_expires_at: expiresAt });

      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      await act(async () => {
        await latestResult.requestReauth({ method: 'apple' });
      });

      expect(mockAppleReauth).toHaveBeenCalled();
      expect(latestResult.hasRecentAuth).toBe(true);

      unmount();
    });

    it('throws when password is required but missing', async () => {
      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      await expect(
        latestResult.requestReauth({ method: 'password' }),
      ).rejects.toThrow('Password is required');

      unmount();
    });

    it('throws when oauth provider is missing', async () => {
      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      await expect(
        latestResult.requestReauth({ method: 'oauth' }),
      ).rejects.toThrow('Provider is required');

      unmount();
    });
  });

  describe('executeWithRecentAuth', () => {
    it('executes action directly when recent auth is active', async () => {
      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      act(() => {
        latestResult.recordRecentAuth(new Date(Date.now() + 300_000));
      });

      const action = jest.fn().mockResolvedValue('success');
      const onRequestReauth = jest.fn();

      const val = await latestResult.executeWithRecentAuth(action, onRequestReauth);
      expect(val).toBe('success');
      expect(action).toHaveBeenCalledTimes(1);
      expect(onRequestReauth).not.toHaveBeenCalled();

      unmount();
    });

    it('prompts reauth when inactive and then executes action', async () => {
      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      const action = jest.fn().mockResolvedValue('done');
      const onRequestReauth = jest.fn().mockImplementation(async () => {
        act(() => {
          latestResult.recordRecentAuth(new Date(Date.now() + 300_000));
        });
        return true;
      });

      const val = await latestResult.executeWithRecentAuth(action, onRequestReauth);
      expect(val).toBe('done');
      expect(onRequestReauth).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('aborts when user cancels initial reauth prompt', async () => {
      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      const action = jest.fn();
      const onRequestReauth = jest.fn().mockResolvedValue(false);

      await expect(
        latestResult.executeWithRecentAuth(action, onRequestReauth),
      ).rejects.toThrow('reauth_cancelled');
      expect(action).not.toHaveBeenCalled();

      unmount();
    });

    it('recovers from 428 recent_auth_required error and retries action', async () => {
      let latestResult!: UseRecentAuthReturn;
      const { unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      act(() => {
        latestResult.recordRecentAuth(new Date(Date.now() + 300_000));
      });

      const error428 = new ApiError({
        kind: 'http',
        endpoint: '/api/v1/me/password',
        status: 428,
        code: 'recent_auth_required',
        serverError: 'recent authentication required',
      });
      const action = jest
        .fn()
        .mockRejectedValueOnce(error428)
        .mockResolvedValueOnce('retried-success');

      const onRequestReauth = jest.fn().mockImplementation(async () => {
        act(() => {
          latestResult.recordRecentAuth(new Date(Date.now() + 300_000));
        });
        return true;
      });

      let val!: string;
      await act(async () => {
        val = await latestResult.executeWithRecentAuth(action, onRequestReauth);
      });
      expect(val).toBe('retried-success');
      expect(action).toHaveBeenCalledTimes(2);
      expect(onRequestReauth).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  describe('session/user change reset', () => {
    it('resets recent auth when user id changes', () => {
      const futureDate = new Date(Date.now() + 300_000);
      let latestResult!: UseRecentAuthReturn;
      const { rerender, unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      act(() => {
        latestResult.recordRecentAuth(futureDate);
      });
      expect(latestResult.hasRecentAuth).toBe(true);

      mockedUseAuth.mockReturnValue({
        user: { id: 2, email: 'new@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null },
        state: { status: 'authenticated', user: { id: 2, email: 'new@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null } },
        sessionEpoch: 1,
      } as unknown as ReturnType<typeof useAuth>);

      rerender();

      expect(latestResult.hasRecentAuth).toBe(false);
      expect(latestResult.recentAuthExpiresAt).toBeNull();

      unmount();
    });

    it('resets recent auth when sessionEpoch changes', () => {
      const futureDate = new Date(Date.now() + 300_000);
      let latestResult!: UseRecentAuthReturn;
      const { rerender, unmount } = renderHookHarness((res) => {
        latestResult = res;
      });

      act(() => {
        latestResult.recordRecentAuth(futureDate);
      });
      expect(latestResult.hasRecentAuth).toBe(true);

      mockedUseAuth.mockReturnValue({
        user: { id: 1, email: 'test@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null },
        state: { status: 'authenticated', user: { id: 1, email: 'test@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null } },
        sessionEpoch: 2,
      } as unknown as ReturnType<typeof useAuth>);

      rerender();

      expect(latestResult.hasRecentAuth).toBe(false);

      unmount();
    });
  });

  describe('isRecentAuthRequiredError', () => {
    it('identifies ApiError with 428 status', () => {
      const err = new ApiError({
        kind: 'http',
        endpoint: '/api/v1/me/password',
        status: 428,
        code: 'recent_auth_required',
      });
      expect(isRecentAuthRequiredError(err)).toBe(true);
    });

    it('identifies object with status 428 or code recent_auth_required', () => {
      expect(isRecentAuthRequiredError({ status: 428 })).toBe(true);
      expect(isRecentAuthRequiredError({ code: 'recent_auth_required' })).toBe(true);
      expect(isRecentAuthRequiredError({ error: 'recent_auth_required' })).toBe(true);
      expect(isRecentAuthRequiredError({ status: 401 })).toBe(false);
      expect(isRecentAuthRequiredError(null)).toBe(false);
      expect(isRecentAuthRequiredError(new Error('other'))).toBe(false);
    });
  });
});
