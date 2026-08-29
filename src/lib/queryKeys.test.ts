import { QueryClient } from '@tanstack/react-query';

import { PrivateMutationRegistry, clearPrivateUserData, privateKeys, publicKeys } from './queryKeys';

describe('company directory keys', () => {
  it('separates a cache entry per settled search', () => {
    const base = publicKeys.companies.search('stripe');
    expect(base).toEqual(['public', 'companies', 'search', 'stripe']);
    expect(publicKeys.companies.search('vercel')).not.toEqual(base);
    expect(publicKeys.companies.search('')).not.toEqual(base);
  });
});

describe('private query ownership', () => {
  it('requires a stable user id in every private key', () => {
    expect(privateKeys.root(7)).toEqual(['private', 7]);
    expect(privateKeys.savedJobs(7)).toEqual(['private', 7, 'saved-jobs']);
    expect(privateKeys.savedJobs(8)).not.toEqual(privateKeys.savedJobs(7));
    expect(privateKeys.tracker(7)).toEqual(['private', 7, 'tracker']);
    expect(privateKeys.trackerList(7, 'board')).toEqual(['private', 7, 'tracker', 'list', 'board']);
    expect(privateKeys.trackerPipeline(7)).toEqual(['private', 7, 'tracker', 'pipeline']);
  });

  it('aborts only mutation transports belonging to the leaving user', () => {
    const registry = new PrivateMutationRegistry();
    const userA = registry.create(1, 2);
    const userB = registry.create(2, 3);
    registry.abortUser(1);
    expect(userA.signal.aborted).toBe(true);
    expect(userB.signal.aborted).toBe(false);
    userB.release();
  });

  it('removes only the prior user private root and preserves public/new-user data', async () => {
    const queryClient = new QueryClient();
    const registry = new PrivateMutationRegistry();
    queryClient.setQueryData(privateKeys.savedJobs(1), ['old']);
    queryClient.setQueryData(privateKeys.savedJobs(2), ['new']);
    queryClient.setQueryData(privateKeys.trackerList(1, 'board'), { data: ['old'] });
    queryClient.setQueryData(privateKeys.trackerList(2, 'board'), { data: ['new'] });
    queryClient.setQueryData(['public', 'jobs'], ['feed']);
    const oldMutation = registry.create(1, 4);

    await clearPrivateUserData(queryClient, registry, 1);

    expect(oldMutation.signal.aborted).toBe(true);
    expect(queryClient.getQueryData(privateKeys.savedJobs(1))).toBeUndefined();
    expect(queryClient.getQueryData(privateKeys.trackerList(1, 'board'))).toBeUndefined();
    expect(queryClient.getQueryData(privateKeys.savedJobs(2))).toEqual(['new']);
    expect(queryClient.getQueryData(privateKeys.trackerList(2, 'board'))).toEqual({ data: ['new'] });
    expect(queryClient.getQueryData(['public', 'jobs'])).toEqual(['feed']);
    queryClient.clear();
  });
});
