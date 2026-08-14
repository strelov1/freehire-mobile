import { ReturnIntentManager } from '@/features/auth/model/returnIntent';
import { ApiError } from '@/lib/transport';
import type { User } from '@/lib/types';

import { SessionCoordinator } from './sessionCoordinator';

const userA: User = {
  id: 1,
  email: 'a@example.test',
  role: 'user',
  beta_tester: false,
  email_verified: true,
  has_password: true,
  created_at: null,
};
const userB: User = { ...userA, id: 2, email: 'b@example.test' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createHarness(overrides: {
  me?: (signal?: AbortSignal) => Promise<User>;
  login?: (email: string, password: string, signal?: AbortSignal) => Promise<User>;
  register?: (email: string, password: string, signal?: AbortSignal) => Promise<User>;
  exchangeOAuth?: (code: string, signal?: AbortSignal) => Promise<User>;
  logout?: (signal?: AbortSignal) => Promise<void>;
  logoutAll?: (epoch: number, signal?: AbortSignal) => Promise<void>;
  openOAuth?: (provider: string) => Promise<{ code?: string; cancelled: boolean }>;
} = {}) {
  const states: unknown[] = [];
  const transitions: [number | undefined, number | undefined, number][] = [];
  const returnIntents = new ReturnIntentManager();
  const api = {
    me: overrides.me ?? (async () => Promise.reject(new ApiError({ kind: 'http', endpoint: '/me', status: 401 }))),
    login: overrides.login ?? (async () => userA),
    register: overrides.register ?? (async () => userA),
    exchangeOAuth: overrides.exchangeOAuth ?? (async () => userA),
    logout: overrides.logout ?? (async () => undefined),
    logoutAll: overrides.logoutAll ?? (async () => undefined),
  };
  const coordinator = new SessionCoordinator({
    api,
    returnIntents,
    onStateChange: (state) => states.push(state),
    transitionIdentity: async (previous, next, epoch) => {
      transitions.push([previous, next, epoch]);
    },
    executeReturnIntent: async () => undefined,
    openOAuth: overrides.openOAuth ?? (async () => ({ code: 'code', cancelled: false })),
  });
  return { coordinator, states, transitions, returnIntents };
}

describe('SessionCoordinator fencing', () => {
  it('does not render guest while the initial probe is unresolved', async () => {
    const probe = deferred<User>();
    const { coordinator } = createHarness({ me: () => probe.promise });
    const pending = coordinator.bootstrap();
    expect(coordinator.getState()).toEqual({ status: 'bootstrapping' });
    probe.resolve(userA);
    await pending;
    expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
  });

  it('ignores a slow old probe 401 after a newer login succeeds', async () => {
    const probe = deferred<User>();
    const { coordinator } = createHarness({ me: () => probe.promise, login: async () => userA });
    const boot = coordinator.bootstrap();
    await expect(coordinator.login('a@example.test', 'password')).resolves.toMatchObject({ status: 'success' });
    probe.reject(new ApiError({ kind: 'http', endpoint: '/me', status: 401 }));
    await boot;
    expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
  });

  it('ignores a slow old registration success after deletion/account transition', async () => {
    const registration = deferred<User>();
    const { coordinator } = createHarness({ register: () => registration.promise });
    const pending = coordinator.register('a@example.test', 'password');
    await coordinator.completeDeletion();
    registration.resolve(userA);
    await expect(pending).resolves.toEqual({ status: 'cancelled', intent: 'none' });
    expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'deleted' });
  });

  it('maps probe availability failures to unavailable instead of guest', async () => {
    const { coordinator } = createHarness({
      me: async () => Promise.reject(new ApiError({ kind: 'server', endpoint: '/me', status: 503 })),
    });
    await coordinator.bootstrap();
    expect(coordinator.getState()).toEqual({ status: 'unavailable', kind: 'server' });
  });

  it('retains a confirmed user when foreground revalidation is unavailable', async () => {
    let calls = 0;
    const { coordinator } = createHarness({
      me: async () => {
        calls += 1;
        if (calls === 1) return userA;
        throw new ApiError({ kind: 'offline', endpoint: '/me' });
      },
    });
    await coordinator.bootstrap();
    await coordinator.revalidate('foreground');
    expect(coordinator.getState()).toEqual({ status: 'refreshing', user: userA, issue: 'offline' });
    expect(coordinator.getUser()).toEqual(userA);
  });

  it('restores the confirmed identity when logout fails', async () => {
    const { coordinator } = createHarness({
      me: async () => userA,
      logout: async () => Promise.reject(new ApiError({ kind: 'server', endpoint: '/logout', status: 503 })),
    });
    await coordinator.bootstrap();
    await expect(coordinator.logout()).rejects.toMatchObject({ status: 503 });
    expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
  });

  it('does not let a login 401 invalidate an already committed session', async () => {
    const { coordinator } = createHarness({
      me: async () => userA,
      login: async () => Promise.reject(new ApiError({ kind: 'http', endpoint: '/login', status: 401 })),
    });
    await coordinator.bootstrap();
    await expect(coordinator.login('b@example.test', 'wrong')).rejects.toMatchObject({ status: 401 });
    expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
  });

  it('ignores stale required-request unauthorized events', async () => {
    const { coordinator } = createHarness({ me: async () => userA });
    await coordinator.bootstrap();
    const oldEpoch = coordinator.getSessionEpoch() - 1;
    await coordinator.handleUnauthorized({ sessionEpoch: oldEpoch });
    expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    await coordinator.handleUnauthorized({ sessionEpoch: coordinator.getSessionEpoch() });
    expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'expired' });
  });

  it('fences OAuth cancellation and logout-all/deletion transitions', async () => {
    const cancelled = createHarness({ openOAuth: async () => ({ cancelled: true }) });
    await expect(cancelled.coordinator.oauth('google')).resolves.toEqual({ status: 'cancelled', intent: 'none' });
    expect(cancelled.coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });

    const active = createHarness({ me: async () => userB });
    await active.coordinator.bootstrap();
    await active.coordinator.logoutAll();
    expect(active.coordinator.getState()).toEqual({ status: 'guest', reason: 'signed_out_everywhere' });
    await active.coordinator.completeDeletion();
    expect(active.coordinator.getState()).toEqual({ status: 'guest', reason: 'deleted' });
  });
});
