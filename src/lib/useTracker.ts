import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  clearApplicationStage,
  getTrackedJobs,
  getTrackingPipeline,
  markJobApplied,
  saveJob,
  trackApplication,
  untrackApplication,
} from './api';
import { useAuth } from './authStore';
import { privateKeys } from './queryKeys';
import {
  optimisticMoveToSaved,
  optimisticPatchApplied,
  optimisticPatchNotes,
  optimisticPatchStage,
  optimisticRemoveJob,
} from './tracker';
import type { TrackingPage, UserJob } from './types';
import type { SessionOwner } from '@/features/auth/model/authTypes';

export function useTrackedJobs(filter: string = 'board') {
  const { user, sessionEpoch } = useAuth();
  const queryKey = user
    ? privateKeys.trackerList(user.id, filter)
    : (['private', 'none', 'tracker', 'list', filter] as const);

  return useQuery({
    queryKey,
    queryFn: ({ signal }) => getTrackedJobs(filter, 500, 0, sessionEpoch, signal),
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useTrackingPipeline() {
  const { user, sessionEpoch } = useAuth();
  const queryKey = user
    ? privateKeys.trackerPipeline(user.id)
    : (['private', 'none', 'tracker', 'pipeline'] as const);

  return useQuery({
    queryKey,
    queryFn: ({ signal }) => getTrackingPipeline(sessionEpoch, signal),
    enabled: !!user,
    staleTime: 30_000,
  });
}

type MutationTransport = { signal: AbortSignal; release: () => void };

type MarkAppliedVars = {
  slug: string;
  id: string;
  appliedOn?: string;
  owner: SessionOwner;
  transport: MutationTransport;
};

type UpdateStageVars = {
  id: string;
  stage: string;
  notes?: string | null;
  owner: SessionOwner;
  transport: MutationTransport;
};

type UpdateNotesVars = {
  id: string;
  notes: string;
  owner: SessionOwner;
  transport: MutationTransport;
};

type MoveToSavedVars = {
  slug: string;
  id: string;
  owner: SessionOwner;
  transport: MutationTransport;
};

type RemoveVars = {
  id: string;
  owner: SessionOwner;
  transport: MutationTransport;
};

type BaseTrackerVars = {
  owner: SessionOwner;
  transport: MutationTransport;
};

type OptimisticMutationContext = {
  previous: TrackingPage | undefined;
  owner: SessionOwner;
};

function useOptimisticTrackerMutation<TVars extends BaseTrackerVars, TData = unknown>(
  mutationFn: (vars: TVars) => Promise<TData>,
  optimisticPatcher: (old: TrackingPage | undefined, vars: TVars) => TrackingPage | undefined,
  invalidateTracker: (owner: SessionOwner) => void,
  isOwnerCurrent: (owner: SessionOwner) => boolean,
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVars, OptimisticMutationContext | undefined>({
    mutationFn,
    onMutate: async (vars) => {
      if (!isOwnerCurrent(vars.owner)) return;
      const listKey = privateKeys.trackerList(vars.owner.userId, 'board');
      await queryClient.cancelQueries({ queryKey: listKey });
      if (!isOwnerCurrent(vars.owner)) return;
      const previous = queryClient.getQueryData<TrackingPage>(listKey);
      queryClient.setQueryData<TrackingPage>(listKey, (old) => optimisticPatcher(old, vars));
      return { previous, owner: vars.owner };
    },
    onError: (_err, _vars, context) => {
      if (context && isOwnerCurrent(context.owner)) {
        queryClient.setQueryData(
          privateKeys.trackerList(context.owner.userId, 'board'),
          context.previous,
        );
      }
    },
    onSettled: (_data, _err, vars) => {
      if (vars) {
        vars.transport.release();
        invalidateTracker(vars.owner);
      }
    },
  });
}

export function useTrackerMutations() {
  const { user, sessionEpoch, isOwnerCurrent, createPrivateMutation } = useAuth();
  const queryClient = useQueryClient();

  const invalidateTracker = useCallback(
    (owner: SessionOwner) => {
      if (!isOwnerCurrent(owner)) return;
      void queryClient.invalidateQueries({
        queryKey: privateKeys.tracker(owner.userId),
      });
      void queryClient.invalidateQueries({
        queryKey: privateKeys.savedJobs(owner.userId),
        exact: true,
      });
    },
    [isOwnerCurrent, queryClient],
  );

  const markAppliedMutation = useOptimisticTrackerMutation<MarkAppliedVars, UserJob>(
    ({ slug, appliedOn, owner, transport }) =>
      markJobApplied(slug, owner.sessionEpoch, appliedOn, transport.signal),
    (old, vars) => optimisticPatchApplied(old, vars.id, new Date().toISOString()),
    invalidateTracker,
    isOwnerCurrent,
  );

  const updateStageMutation = useOptimisticTrackerMutation<UpdateStageVars, UserJob>(
    ({ id, stage, notes, owner, transport }) =>
      trackApplication(id, stage, notes, owner.sessionEpoch, transport.signal),
    (old, vars) => optimisticPatchStage(old, vars.id, vars.stage, vars.notes),
    invalidateTracker,
    isOwnerCurrent,
  );

  const updateNotesMutation = useOptimisticTrackerMutation<UpdateNotesVars, UserJob>(
    ({ id, notes, owner, transport }) =>
      trackApplication(id, undefined, notes, owner.sessionEpoch, transport.signal),
    (old, vars) => optimisticPatchNotes(old, vars.id, vars.notes),
    invalidateTracker,
    isOwnerCurrent,
  );

  const moveToSavedMutation = useOptimisticTrackerMutation<MoveToSavedVars, void>(
    async ({ slug, id, owner, transport }) => {
      await saveJob(slug, owner.sessionEpoch, transport.signal);
      try {
        await clearApplicationStage(id, owner.sessionEpoch, transport.signal);
      } catch (err) {
        throw new Error(
          "Saved to bookmarks, but couldn't clear application progress. Please try again.",
          { cause: err },
        );
      }
    },
    (old, vars) => optimisticMoveToSaved(old, vars.id, new Date().toISOString()),
    invalidateTracker,
    isOwnerCurrent,
  );

  const removeMutation = useOptimisticTrackerMutation<RemoveVars, UserJob>(
    ({ id, owner, transport }) =>
      untrackApplication(id, owner.sessionEpoch, transport.signal),
    (old, vars) => optimisticRemoveJob(old, vars.id),
    invalidateTracker,
    isOwnerCurrent,
  );

  const markApplied = useCallback(
    async (slug: string, id: string, appliedOn?: string): Promise<UserJob> => {
      if (!user) throw new Error('Unauthenticated');
      const owner = { userId: user.id, sessionEpoch };
      const transport = createPrivateMutation(owner);
      return markAppliedMutation.mutateAsync({ slug, id, appliedOn, owner, transport });
    },
    [user, sessionEpoch, createPrivateMutation, markAppliedMutation],
  );

  const updateStage = useCallback(
    async (id: string, stage: string, notes?: string | null): Promise<UserJob> => {
      if (!user) throw new Error('Unauthenticated');
      const owner = { userId: user.id, sessionEpoch };
      const transport = createPrivateMutation(owner);
      return updateStageMutation.mutateAsync({ id, stage, notes, owner, transport });
    },
    [user, sessionEpoch, createPrivateMutation, updateStageMutation],
  );

  const updateNotes = useCallback(
    async (id: string, notes: string): Promise<UserJob> => {
      if (!user) throw new Error('Unauthenticated');
      const owner = { userId: user.id, sessionEpoch };
      const transport = createPrivateMutation(owner);
      return updateNotesMutation.mutateAsync({ id, notes, owner, transport });
    },
    [user, sessionEpoch, createPrivateMutation, updateNotesMutation],
  );

  const moveToSaved = useCallback(
    async (slug: string, id: string): Promise<void> => {
      if (!user) throw new Error('Unauthenticated');
      const owner = { userId: user.id, sessionEpoch };
      const transport = createPrivateMutation(owner);
      await moveToSavedMutation.mutateAsync({ slug, id, owner, transport });
    },
    [user, sessionEpoch, createPrivateMutation, moveToSavedMutation],
  );

  const removeFromTracker = useCallback(
    async (id: string): Promise<UserJob> => {
      if (!user) throw new Error('Unauthenticated');
      const owner = { userId: user.id, sessionEpoch };
      const transport = createPrivateMutation(owner);
      return removeMutation.mutateAsync({ id, owner, transport });
    },
    [user, sessionEpoch, createPrivateMutation, removeMutation],
  );

  return {
    markApplied,
    updateStage,
    updateNotes,
    moveToSaved,
    removeFromTracker,
    isMarkingApplied: markAppliedMutation.isPending,
    isUpdatingStage: updateStageMutation.isPending,
    isUpdatingNotes: updateNotesMutation.isPending,
    isMovingToSaved: moveToSavedMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
