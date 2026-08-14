import { ReturnIntentManager } from '@/features/auth/model/returnIntent';
import { ApiError } from '@/lib/transport';
import type { User } from '@/lib/types';
import { authV2Api } from '../api/authV2Api';
import * as AppleAuthentication from 'expo-apple-authentication';

import { SessionCoordinator } from './sessionCoordinator';

jest.mock('../api/authV2Api', () => ({
  authV2Api: {
    oauthStartUrl: jest.fn((provider: string, params: any) => `https://example.com/oauth/${provider}?purpose=${params.purpose}`),
    oauthExchange: jest.fn(),
    appleAttempt: jest.fn(),
    appleExchange: jest.fn(),
    passwordReauth: jest.fn(),
    deleteAccount: jest.fn(),
  },
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

const mockAuthV2Api = authV2Api as jest.Mocked<typeof authV2Api>;
const mockAppleAuth = AppleAuthentication as jest.Mocked<typeof AppleAuthentication>;

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
  openOAuthV2?: (url: string) => Promise<{ code?: string; cancelled: boolean }>;
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
    openOAuthV2: overrides.openOAuthV2,
  });
  return { coordinator, states, transitions, returnIntents };
}

describe('SessionCoordinator fencing & V2 flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  describe('V2 OAuth & Apple Sign-In methods', () => {
    it('handles oauthV2 sign-in success with PKCE verifier/challenge', async () => {
      mockAuthV2Api.oauthExchange.mockResolvedValueOnce(userA);
      const { coordinator } = createHarness({
        openOAuthV2: async () => ({ code: 'otc_123', cancelled: false }),
      });

      const res = await coordinator.oauthV2('github', 'sign_in');
      expect(res).toEqual({ status: 'success', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(mockAuthV2Api.oauthExchange).toHaveBeenCalledWith('otc_123', expect.any(String), expect.any(Object));
    });

    it('handles oauthV2 cancellation cleanly', async () => {
      const { coordinator } = createHarness({
        openOAuthV2: async () => ({ cancelled: true }),
      });

      const res = await coordinator.oauthV2('github');
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });

    it('handles oauthV2 reauth returning RecentAuthProof', async () => {
      const proof = { recent_auth_expires_at: '2026-08-13T19:00:00Z' };
      mockAuthV2Api.oauthExchange.mockResolvedValueOnce(proof);
      const { coordinator } = createHarness({
        me: async () => userA,
        openOAuthV2: async () => ({ code: 'otc_123', cancelled: false }),
      });
      await coordinator.bootstrap();

      const res = await coordinator.oauthReauth('github');
      expect(res).toEqual(proof);
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('handles appleSignIn sign-in flow success', async () => {
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T19:00:00Z' });
      mockAppleAuth.signInAsync.mockResolvedValueOnce({
        identityToken: 'id_tok',
        authorizationCode: 'auth_code',
      } as any);
      mockAuthV2Api.appleExchange.mockResolvedValueOnce(userA);

      const { coordinator } = createHarness();
      const res = await coordinator.appleSignIn('sign_in');
      expect(res).toEqual({ status: 'success', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(mockAuthV2Api.appleExchange).toHaveBeenCalledWith(
        {
          attempt_id: 'att_123',
          identity_token: 'id_tok',
          authorization_code: 'auth_code',
          raw_nonce: expect.any(String),
        },
        expect.any(Object),
      );
    });

    it('handles appleSignIn user cancellation', async () => {
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T19:00:00Z' });
      mockAppleAuth.signInAsync.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });

      const { coordinator } = createHarness();
      const res = await coordinator.appleSignIn('sign_in');
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });

    it('handles appleReauth returning RecentAuthProof', async () => {
      const proof = { recent_auth_expires_at: '2026-08-13T19:00:00Z' };
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T19:00:00Z' });
      mockAppleAuth.signInAsync.mockResolvedValueOnce({
        identityToken: 'id_tok',
        authorizationCode: 'auth_code',
      } as any);
      mockAuthV2Api.appleExchange.mockResolvedValueOnce(proof);

      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      const res = await coordinator.appleReauth();
      expect(res).toEqual(proof);
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });
  });

  describe('Reauthentication & Deletion methods', () => {
    it('executes passwordReauth when authenticated', async () => {
      const proof = { recent_auth_expires_at: '2026-08-13T19:00:00Z' };
      mockAuthV2Api.passwordReauth.mockResolvedValueOnce(proof);

      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      const res = await coordinator.passwordReauth('mysecret');
      expect(res).toEqual(proof);
      expect(mockAuthV2Api.passwordReauth).toHaveBeenCalledWith('mysecret', expect.any(Number), expect.any(Object));
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('throws error when passwordReauth is called while unauthenticated', async () => {
      const { coordinator } = createHarness();
      await expect(coordinator.passwordReauth('mysecret')).rejects.toThrow(
        'User must be authenticated to perform reauthentication',
      );
    });

    it('executes deleteAccount and transitions session to guest with reason deleted', async () => {
      mockAuthV2Api.deleteAccount.mockResolvedValueOnce(undefined);
      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      await coordinator.deleteAccount();
      expect(mockAuthV2Api.deleteAccount).toHaveBeenCalledWith(userA.email, expect.any(Number), expect.any(Object));
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'deleted' });
    });

    it('passes custom email argument to deleteAccount if provided', async () => {
      mockAuthV2Api.deleteAccount.mockResolvedValueOnce(undefined);
      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      await coordinator.deleteAccount('custom@example.com');
      expect(mockAuthV2Api.deleteAccount).toHaveBeenCalledWith('custom@example.com', expect.any(Number), expect.any(Object));
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'deleted' });
    });

    it('restores authenticated state if deleteAccount fails', async () => {
      mockAuthV2Api.deleteAccount.mockRejectedValueOnce(
        new ApiError({ kind: 'server', endpoint: '/api/v1/me', status: 500 }),
      );
      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      await expect(coordinator.deleteAccount()).rejects.toMatchObject({ status: 500 });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });
  });

  describe('cancelCurrent state restoration', () => {
    it('restores authenticated state when cancelCurrent aborts active logout', async () => {
      const slowLogout = deferred<void>();
      const { coordinator } = createHarness({
        me: async () => userA,
        logout: () => slowLogout.promise,
      });
      await coordinator.bootstrap();

      const logoutPromise = coordinator.logout();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: userA });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });

      slowLogout.reject(new ApiError({ kind: 'aborted', endpoint: '/logout' }));
      await expect(logoutPromise).resolves.toBeUndefined();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('restores authenticated state when cancelCurrent aborts active deleteAccount', async () => {
      const slowDelete = deferred<void>();
      mockAuthV2Api.deleteAccount.mockImplementationOnce(() => slowDelete.promise);
      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      const deletePromise = coordinator.deleteAccount();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: userA });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });

      slowDelete.reject(new ApiError({ kind: 'aborted', endpoint: '/delete' }));
      await expect(deletePromise).resolves.toBeUndefined();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('restores guest state when cancelCurrent aborts active login', async () => {
      const slowLogin = deferred<User>();
      const { coordinator } = createHarness({ login: () => slowLogin.promise });

      const loginPromise = coordinator.login('user@test.com', 'pass');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'login' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });

      slowLogin.reject(new ApiError({ kind: 'aborted', endpoint: '/login' }));
      const res = await loginPromise;
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });

    it('restores authenticated state when cancelCurrent aborts active reauth', async () => {
      const slowOAuth = deferred<{ code?: string; cancelled: boolean }>();
      const { coordinator } = createHarness({
        me: async () => userA,
        openOAuthV2: () => slowOAuth.promise,
      });
      await coordinator.bootstrap();

      const oauthPromise = coordinator.oauthV2('github', 'reauth');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });

      slowOAuth.resolve({ code: '123', cancelled: false });
      const res = await oauthPromise;
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('restores authenticated state when cancelCurrent aborts active revalidation', async () => {
      const slowMe = deferred<User>();
      let meCalls = 0;
      const { coordinator } = createHarness({
        me: async () => {
          meCalls++;
          if (meCalls === 1) return userA;
          return slowMe.promise;
        },
      });
      await coordinator.bootstrap();

      const revalPromise = coordinator.revalidate('foreground');
      expect(coordinator.getState()).toEqual({ status: 'refreshing', user: userA });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });

      slowMe.reject(new ApiError({ kind: 'aborted', endpoint: '/me' }));
      await expect(revalPromise).resolves.toBeUndefined();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });
  });
});
