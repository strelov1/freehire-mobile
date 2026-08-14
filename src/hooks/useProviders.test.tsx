import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Platform } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { authV2Api } from '@/features/auth/api/authV2Api';
import { useProviders, type UseProvidersResult } from './useProviders';

jest.mock('@/features/auth/api/authV2Api', () => ({
  authV2Api: {
    providers: jest.fn(),
  },
}));

const mockedProvidersApi = authV2Api.providers as jest.MockedFunction<typeof authV2Api.providers>;

describe('useProviders', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retryDelay: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  async function renderHookHarness(callback: (res: UseProvidersResult) => void) {
    function TestComponent() {
      const result = useProviders();
      React.useEffect(() => {
        callback(result);
      }, [result]);
      return null;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });

    return () => {
      act(() => {
        renderer.unmount();
      });
    };
  }

  it('fetches providers and filters according to iOS platform', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const mockData = {
      schema_version: 2,
      providers: [
        { id: 'apple', flow: 'native_apple' as const, platforms: ['ios'], available: true },
        { id: 'google', flow: 'browser_oauth' as const, platforms: ['ios', 'android'], available: true },
        { id: 'android_only', flow: 'browser_oauth' as const, platforms: ['android'], available: true },
      ],
    };
    mockedProvidersApi.mockResolvedValue(mockData);

    let latestResult: UseProvidersResult | null = null;
    const unmount = await renderHookHarness((res) => {
      latestResult = res;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(latestResult).not.toBeNull();
    expect(latestResult!.isLoading).toBe(false);
    expect(latestResult!.isError).toBe(false);
    expect(latestResult!.schemaVersion).toBe(2);
    expect(latestResult!.providers).toHaveLength(2);
    expect(latestResult!.providers.map((p) => p.id)).toEqual(['apple', 'google']);

    unmount();
  });

  it('fetches providers and filters according to Android platform', async () => {
    (Platform as { OS: string }).OS = 'android';
    const mockData = {
      schema_version: 2,
      providers: [
        { id: 'apple', flow: 'native_apple' as const, platforms: ['ios'], available: true },
        { id: 'google', flow: 'browser_oauth' as const, platforms: ['ios', 'android'], available: true },
        { id: 'android_only', flow: 'browser_oauth' as const, platforms: ['android'], available: true },
      ],
    };
    mockedProvidersApi.mockResolvedValue(mockData);

    let latestResult: UseProvidersResult | null = null;
    const unmount = await renderHookHarness((res) => {
      latestResult = res;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(latestResult).not.toBeNull();
    expect(latestResult!.isLoading).toBe(false);
    expect(latestResult!.providers).toHaveLength(2);
    expect(latestResult!.providers.map((p) => p.id)).toEqual(['google', 'android_only']);

    unmount();
  });

  it('degrades gracefully to empty array when backend fails or is offline', async () => {
    (Platform as { OS: string }).OS = 'ios';
    mockedProvidersApi.mockRejectedValue(new Error('Network offline or 500 error'));

    let latestResult: UseProvidersResult | null = null;
    const unmount = await renderHookHarness((res) => {
      latestResult = res;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(latestResult).not.toBeNull();
    expect(latestResult!.isLoading).toBe(false);
    expect(latestResult!.isError).toBe(true);
    expect(latestResult!.providers).toEqual([]);
    expect(latestResult!.schemaVersion).toBe(2);

    unmount();
  });
});
