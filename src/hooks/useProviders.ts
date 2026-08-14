import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { authV2Api } from '@/features/auth/api/authV2Api';
import type { V2Provider, V2ProviderList } from '@/features/auth/model/authV2Types';
import { publicKeys } from '@/lib/queryKeys';

export type UseProvidersResult = {
  providers: V2Provider[];
  schemaVersion: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Hook to discover available v2 auth providers (Google, GitHub, LinkedIn, Apple)
 * with TanStack Query caching and automatic platform filtering.
 *
 * Degrades gracefully to an empty array on network/server errors so that
 * standard email/password authentication remains uninterrupted.
 */
export function useProviders(): UseProvidersResult {
  const currentPlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  const { data, isLoading, isError, error, refetch } = useQuery<V2ProviderList>({
    queryKey: publicKeys.v2Providers,
    queryFn: ({ signal }) => authV2Api.providers(signal),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  const rawProviders = data?.providers ?? [];
  const providers = isError
    ? []
    : rawProviders.filter((p) => {
        if (!Array.isArray(p.platforms) || p.platforms.length === 0) return true;
        return p.platforms.includes(currentPlatform) || p.platforms.includes(Platform.OS);
      });

  return {
    providers,
    schemaVersion: data?.schema_version ?? 2,
    isLoading,
    isError,
    error,
    refetch,
  };
}
