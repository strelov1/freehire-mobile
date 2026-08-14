import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { saveJob, savedSlugs, unsaveJob } from './api';
import { useAuth } from './authStore';
import { privateKeys } from './queryKeys';
import type { SessionOwner } from '@/features/auth/model/authTypes';

type ToggleVariables = {
  slug: string;
  saved: boolean;
  owner: SessionOwner;
  transport: { signal: AbortSignal; release: () => void };
};

export function useSavedJobs() {
  const { user, sessionEpoch, isOwnerCurrent, createPrivateMutation } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = user ? privateKeys.savedJobs(user.id) : privateKeys.signedOutSavedJobs;

  const { data } = useQuery({
    queryKey,
    queryFn: ({ signal }) => savedSlugs(sessionEpoch, signal),
    enabled: !!user,
    staleTime: 30_000,
  });
  const savedSet = useMemo(() => new Set(data ?? []), [data]);

  const mutation = useMutation({
    mutationFn: ({ slug, saved, owner, transport }: ToggleVariables) =>
      saved
        ? unsaveJob(slug, owner.sessionEpoch, transport.signal)
        : saveJob(slug, owner.sessionEpoch, transport.signal),
    onMutate: async (variables) => {
      if (!isOwnerCurrent(variables.owner)) return;
      const ownedKey = privateKeys.savedJobs(variables.owner.userId);
      await queryClient.cancelQueries({ queryKey: ownedKey, exact: true });
      if (!isOwnerCurrent(variables.owner)) return;
      const previous = queryClient.getQueryData<string[]>(ownedKey) ?? [];
      queryClient.setQueryData<string[]>(
        ownedKey,
        variables.saved ? previous.filter((slug) => slug !== variables.slug) : [...new Set([...previous, variables.slug])],
      );
      return { previous, owner: variables.owner };
    },
    onError: (_error, _variables, context) => {
      if (context && isOwnerCurrent(context.owner)) {
        queryClient.setQueryData(privateKeys.savedJobs(context.owner.userId), context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      variables.transport.release();
      if (isOwnerCurrent(variables.owner)) {
        void queryClient.invalidateQueries({
          queryKey: privateKeys.savedJobs(variables.owner.userId),
          exact: true,
        });
      }
    },
  });

  return {
    ready: !!user,
    isSaved: (slug: string) => savedSet.has(slug),
    toggle: (slug: string, saved: boolean) => {
      if (!user) return;
      const owner = { userId: user.id, sessionEpoch };
      mutation.mutate({ slug, saved, owner, transport: createPrivateMutation(owner) });
    },
  };
}
