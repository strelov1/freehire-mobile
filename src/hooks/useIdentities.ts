import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { authV2Api } from '@/features/auth/api/authV2Api';
import type { Identity, UnlinkResult } from '@/features/auth/model/authV2Types';
import { useAuth } from '@/lib/authStore';
import { privateKeys } from '@/lib/queryKeys';

export type UseIdentitiesResult = {
  identities: Identity[];
  hasPassword: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  unlinkIdentity: (provider: string) => Promise<UnlinkResult>;
  isUnlinking: boolean;
  unlinkingProvider: string | null;
};

/**
 * Hook to list connected OAuth & Apple identities for the current user,
 * and execute identity unlinking with TanStack Query cache invalidation.
 */
export function useIdentities(): UseIdentitiesResult {
  const { user, state, sessionEpoch } = useAuth();
  const queryClient = useQueryClient();
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  const isAuthenticated = Boolean(
    user && (state.status === 'authenticated' || state.status === 'refreshing'),
  );

  const query = useQuery<Identity[]>({
    queryKey: user ? privateKeys.identities(user.id) : ['private', 'none', 'identities'],
    queryFn: async ({ signal }) => (await authV2Api.identities(sessionEpoch, signal)) ?? [],
    enabled: isAuthenticated,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const unlinkMutation = useMutation<UnlinkResult, unknown, string>({
    mutationFn: async (provider: string) => {
      setUnlinkingProvider(provider);
      try {
        return await authV2Api.unlinkIdentity(provider, sessionEpoch);
      } finally {
        setUnlinkingProvider(null);
      }
    },
    onSuccess: () => {
      if (user) {
        void queryClient.invalidateQueries({ queryKey: privateKeys.identities(user.id) });
      }
    },
  });

  const unlinkIdentity = useCallback(
    async (provider: string): Promise<UnlinkResult> => {
      return await unlinkMutation.mutateAsync(provider);
    },
    [unlinkMutation],
  );

  return {
    identities: query.data ?? [],
    hasPassword: user?.has_password ?? true,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    unlinkIdentity,
    isUnlinking: unlinkMutation.isPending,
    unlinkingProvider,
  };
}
