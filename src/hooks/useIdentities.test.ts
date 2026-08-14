import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useIdentities, type UseIdentitiesResult } from './useIdentities';
import { authV2Api } from '@/features/auth/api/authV2Api';
import type { Identity } from '@/features/auth/model/authV2Types';
import { useAuth } from '@/lib/authStore';
import { privateKeys } from '@/lib/queryKeys';
import { ApiError } from '@/lib/transport';

jest.mock('@/features/auth/api/authV2Api', () => ({
  authV2Api: {
    identities: jest.fn(),
    unlinkIdentity: jest.fn(),
  },
}));

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

const mockedAuthApi = authV2Api as jest.Mocked<typeof authV2Api>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('useIdentities', () => {
  let queryClient: QueryClient;

  function renderHookHarness(callback: (res: UseIdentitiesResult) => void) {
    function TestComponent() {
      const result = useIdentities();
      React.useEffect(() => {
        callback(result);
      });
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(TestComponent),
        ),
      );
    });

    return {
      rerender: () => {
        act(() => {
          renderer.update(
            React.createElement(
              QueryClientProvider,
              { client: queryClient },
              React.createElement(TestComponent),
            ),
          );
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
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retryDelay: 0, retry: false },
        mutations: { retry: false },
      },
    });

    mockedUseAuth.mockReturnValue({
      user: { id: 10, email: 'alex@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null },
      state: { status: 'authenticated', user: { id: 10, email: 'alex@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null } },
      sessionEpoch: 3,
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches connected identities for authenticated user', async () => {
    const mockIdentities: Identity[] = [
      { provider: 'google', provider_email: 'alex@gmail.com', linked_at: '2026-01-01T00:00:00Z', status: 'active', can_unlink: true },
      { provider: 'github', linked_at: '2026-02-01T00:00:00Z', status: 'active', can_unlink: true },
    ];
    mockedAuthApi.identities.mockResolvedValueOnce(mockIdentities);

    let latestResult!: UseIdentitiesResult;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(mockedAuthApi.identities).toHaveBeenCalledWith(3, expect.any(AbortSignal));
    expect(latestResult.identities).toEqual(mockIdentities);
    expect(latestResult.hasPassword).toBe(true);
    expect(latestResult.isLoading).toBe(false);
    expect(latestResult.isError).toBe(false);

    unmount();
  });

  it('does not fetch when user is signed out', async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      state: { status: 'guest' },
      sessionEpoch: 0,
    } as unknown as ReturnType<typeof useAuth>);

    let latestResult!: UseIdentitiesResult;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(mockedAuthApi.identities).not.toHaveBeenCalled();
    expect(latestResult.identities).toEqual([]);

    unmount();
  });

  it('executes unlinkIdentity mutation and invalidates cache on success', async () => {
    const mockIdentities: Identity[] = [
      { provider: 'google', provider_email: 'alex@gmail.com', linked_at: '2026-01-01T00:00:00Z', status: 'active', can_unlink: true },
    ];
    mockedAuthApi.identities.mockResolvedValueOnce(mockIdentities);
    mockedAuthApi.unlinkIdentity.mockResolvedValueOnce({ status: 'unlinked' });

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    let latestResult!: UseIdentitiesResult;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    let unlinkRes!: unknown;
    await act(async () => {
      unlinkRes = await latestResult.unlinkIdentity('google');
    });

    expect(mockedAuthApi.unlinkIdentity).toHaveBeenCalledWith('google', 3);
    expect(unlinkRes).toEqual({ status: 'unlinked' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: privateKeys.identities(10) });

    unmount();
  });

  it('handles revocation_pending status from Apple unlink', async () => {
    mockedAuthApi.identities.mockResolvedValueOnce([]);
    mockedAuthApi.unlinkIdentity.mockResolvedValueOnce({ status: 'revocation_pending' });

    let latestResult!: UseIdentitiesResult;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    let unlinkRes!: unknown;
    await act(async () => {
      unlinkRes = await latestResult.unlinkIdentity('apple');
    });

    expect(unlinkRes).toEqual({ status: 'revocation_pending' });

    unmount();
  });

  it('propagates 409 last_sign_in_method error upon unlink failure', async () => {
    const error409 = new ApiError({
      kind: 'http',
      endpoint: '/api/v2/auth/identities/google',
      status: 409,
      code: 'last_sign_in_method',
      serverError: 'cannot remove the last sign-in method',
    });
    mockedAuthApi.identities.mockResolvedValueOnce([]);
    mockedAuthApi.unlinkIdentity.mockRejectedValueOnce(error409);

    let latestResult!: UseIdentitiesResult;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    let errorThrown: unknown;
    await act(async () => {
      try {
        await latestResult.unlinkIdentity('google');
      } catch (e) {
        errorThrown = e;
      }
    });

    expect(errorThrown).toEqual(error409);

    unmount();
  });

  it('propagates 428 recent_auth_required error upon unlink failure', async () => {
    const error428 = new ApiError({
      kind: 'http',
      endpoint: '/api/v2/auth/identities/google',
      status: 428,
      code: 'recent_auth_required',
      serverError: 'recent authentication required',
    });
    mockedAuthApi.identities.mockResolvedValueOnce([]);
    mockedAuthApi.unlinkIdentity.mockRejectedValueOnce(error428);

    let latestResult!: UseIdentitiesResult;
    const { unmount } = renderHookHarness((res) => {
      latestResult = res;
    });

    let errorThrown: unknown;
    await act(async () => {
      try {
        await latestResult.unlinkIdentity('google');
      } catch (e) {
        errorThrown = e;
      }
    });

    expect(errorThrown).toEqual(error428);

    unmount();
  });
});
