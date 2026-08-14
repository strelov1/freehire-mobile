import { ReturnIntentManager } from '@/features/auth/model/returnIntent';
import { ApiError } from '@/lib/transport';
import type { User } from '@/lib/types';
import { authV2Api } from '@/features/auth/api/authV2Api';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SessionCoordinator } from '@/features/auth/session/sessionCoordinator';

jest.mock('@/features/auth/api/authV2Api', () => ({
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
  email: 'userA@example.com',
  role: 'user',
  beta_tester: false,
  email_verified: true,
  has_password: true,
  created_at: null,
};

const userB: User = {
  id: 2,
  email: 'userB@example.com',
  role: 'user',
  beta_tester: false,
  email_verified: true,
  has_password: true,
  created_at: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {});
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
  return { coordinator, states, transitions, returnIntents, api };
}

describe('Empirical M2 Challenge - SessionCoordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Focus Area 1: State Machine Transitions (oauthV2, appleSignIn, reauth, deleteAccount)', () => {
    it('oauthV2 sign_in transitions to authenticating, then authenticated', async () => {
      mockAuthV2Api.oauthExchange.mockResolvedValueOnce(userA);
      const { coordinator, states } = createHarness({
        openOAuthV2: async () => ({ code: 'otc_123', cancelled: false }),
      });

      const res = await coordinator.oauthV2('google', 'sign_in');
      expect(res).toEqual({ status: 'success', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(states).toEqual([
        { status: 'authenticating', operation: 'oauth' },
        { status: 'authenticated', user: userA },
      ]);
    });

    it('oauthV2 reauth returns RecentAuthProof and restores authenticated state', async () => {
      const proof = { recent_auth_expires_at: '2026-08-13T20:00:00Z' };
      mockAuthV2Api.oauthExchange.mockResolvedValueOnce(proof);
      const { coordinator, states } = createHarness({
        me: async () => userA,
        openOAuthV2: async () => ({ code: 'otc_123', cancelled: false }),
      });
      await coordinator.bootstrap();

      states.length = 0;
      const res = await coordinator.oauthReauth('github');
      expect(res).toEqual(proof);
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(states).toEqual([
        { status: 'authenticating', operation: 'oauth' },
        { status: 'authenticated', user: userA },
      ]);
    });

    it('appleSignIn sign_in transitions to authenticating, then authenticated', async () => {
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T20:00:00Z' });
      mockAppleAuth.signInAsync.mockResolvedValueOnce({
        identityToken: 'id_tok',
        authorizationCode: 'auth_code',
      } as any);
      mockAuthV2Api.appleExchange.mockResolvedValueOnce(userA);

      const { coordinator, states } = createHarness();
      const res = await coordinator.appleSignIn('sign_in');
      expect(res).toEqual({ status: 'success', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(states).toEqual([
        { status: 'authenticating', operation: 'oauth' },
        { status: 'authenticated', user: userA },
      ]);
    });

    it('appleSignIn user cancellation restores previous state', async () => {
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T20:00:00Z' });
      mockAppleAuth.signInAsync.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });

      const { coordinator, states } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();
      states.length = 0;

      const res = await coordinator.appleSignIn('sign_in');
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(states).toEqual([
        { status: 'authenticating', operation: 'oauth' },
        { status: 'authenticated', user: userA },
      ]);
    });

    it('passwordReauth succeeds when authenticated and keeps authenticated state', async () => {
      const proof = { recent_auth_expires_at: '2026-08-13T20:00:00Z' };
      mockAuthV2Api.passwordReauth.mockResolvedValueOnce(proof);

      const { coordinator, states } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();
      states.length = 0;

      const res = await coordinator.passwordReauth('mysecret');
      expect(res).toEqual(proof);
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(mockAuthV2Api.passwordReauth).toHaveBeenCalledWith('mysecret', 1, expect.any(Object));
      expect(states).toEqual([
        { status: 'authenticating', operation: 'login' },
        { status: 'authenticated', user: userA },
      ]);
    });

    it('passwordReauth throws when called while unauthenticated', async () => {
      const { coordinator } = createHarness();
      await expect(coordinator.passwordReauth('secret')).rejects.toThrow(
        'User must be authenticated to perform reauthentication',
      );
    });

    it('deleteAccount does nothing when unauthenticated', async () => {
      const { coordinator } = createHarness();
      await coordinator.deleteAccount();
      expect(coordinator.getState()).toEqual({ status: 'bootstrapping' });
      expect(mockAuthV2Api.deleteAccount).not.toHaveBeenCalled();
    });

    it('deleteAccount transitions signingOut -> guest(deleted) when authenticated', async () => {
      mockAuthV2Api.deleteAccount.mockResolvedValueOnce(undefined);
      const { coordinator, states, transitions } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();
      states.length = 0;
      transitions.length = 0;

      await coordinator.deleteAccount();
      expect(mockAuthV2Api.deleteAccount).toHaveBeenCalledWith(userA.email, 1, expect.any(Object));
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'deleted' });
      expect(coordinator.getUser()).toBeUndefined();
      expect(states).toEqual([
        { status: 'signingOut', user: userA },
        { status: 'guest', reason: 'deleted' },
      ]);
      expect(transitions).toEqual([
        [userA.id, undefined, 2],
      ]);
    });

    it('deleteAccount restores authenticated state if API call rejects', async () => {
      mockAuthV2Api.deleteAccount.mockRejectedValueOnce(
        new ApiError({ kind: 'server', endpoint: '/api/v1/me', status: 500 }),
      );
      const { coordinator, states } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();
      states.length = 0;

      await expect(coordinator.deleteAccount()).rejects.toMatchObject({ status: 500 });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
      expect(states).toEqual([
        { status: 'signingOut', user: userA },
        { status: 'authenticated', user: userA },
      ]);
    });
  });

  describe('Focus Area 2: Generation Fencing & Cancellation Safety', () => {
    it('cancelCurrent on logout restores state to authenticated', async () => {
      const slowLogout = deferred<void>();
      const { coordinator } = createHarness({
        me: async () => userA,
        logout: () => slowLogout.promise,
      });
      await coordinator.bootstrap();

      const logoutPromise = coordinator.logout();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: userA });

      coordinator.cancelCurrent();
      slowLogout.reject(new ApiError({ kind: 'aborted', endpoint: '/logout' }));
      await expect(logoutPromise).resolves.toBeUndefined();

      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('cancelCurrent on deleteAccount restores state to authenticated', async () => {
      const slowDelete = deferred<void>();
      mockAuthV2Api.deleteAccount.mockImplementationOnce(() => slowDelete.promise);

      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      const deletePromise = coordinator.deleteAccount();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: userA });

      coordinator.cancelCurrent();
      slowDelete.reject(new ApiError({ kind: 'aborted', endpoint: '/delete' }));
      await expect(deletePromise).resolves.toBeUndefined();

      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('cancelCurrent on oauthV2 reauth restores state to authenticated', async () => {
      const slowOAuth = deferred<{ code?: string; cancelled: boolean }>();
      const { coordinator } = createHarness({
        me: async () => userA,
        openOAuthV2: () => slowOAuth.promise,
      });
      await coordinator.bootstrap();

      const oauthPromise = coordinator.oauthV2('github', 'reauth');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      coordinator.cancelCurrent();
      slowOAuth.resolve({ code: '123', cancelled: false });
      const res = await oauthPromise;

      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('cancelCurrent on login when unauthenticated restores state to guest', async () => {
      const slowLogin = deferred<User>();
      const { coordinator } = createHarness({
        login: () => slowLogin.promise,
      });

      const loginPromise = coordinator.login('test@example.com', 'secret');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'login' });

      coordinator.cancelCurrent();
      slowLogin.reject(new ApiError({ kind: 'aborted', endpoint: '/login' }));
      const res = await loginPromise;

      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });

    it('cancelCurrent on revalidate restores state to authenticated', async () => {
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
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });

      const revalidatePromise = coordinator.revalidate('foreground');
      expect(coordinator.getState()).toEqual({ status: 'refreshing', user: userA });

      coordinator.cancelCurrent();
      slowMe.reject(new ApiError({ kind: 'aborted', endpoint: '/me' }));
      await expect(revalidatePromise).resolves.toBeUndefined();

      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('ensures newer operation on same coordinator instance fences out older slow operation', async () => {
      const slowLogin = deferred<User>();
      let loginCalls = 0;
      const { coordinator } = createHarness({
        login: async (email, pass, signal) => {
          loginCalls++;
          if (loginCalls === 1) return slowLogin.promise;
          return userB;
        },
      });

      const loginPromise1 = coordinator.login('a@example.com', 'pass1');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'login' });

      // Start new login on SAME coordinator while login 1 is slow
      const loginPromise2 = coordinator.login('b@example.com', 'pass2');
      const res2 = await loginPromise2;
      expect(res2).toEqual({ status: 'success', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userB });

      // Now resolve slow login 1
      slowLogin.resolve(userA);
      const res1 = await loginPromise1;

      expect(res1).toEqual({ status: 'cancelled', intent: 'none' });
      // State remains userB, userA did not overwrite
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userB });
    });
  });

  describe('Focus Area 3: GuestReason transition to deleted upon account deletion', () => {
    it('transitions GuestReason to deleted on deleteAccount', async () => {
      mockAuthV2Api.deleteAccount.mockResolvedValueOnce(undefined);
      const { coordinator, returnIntents } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      returnIntents.record({ kind: 'navigate', destination: 'account' });
      expect(returnIntents.getSnapshot().status).toBe('pending');

      await coordinator.deleteAccount();

      const state = coordinator.getState();
      expect(state).toEqual({ status: 'guest', reason: 'deleted' });
      expect(returnIntents.getSnapshot().status).toBe('empty');
    });

    it('transitions GuestReason to deleted on completeDeletion', async () => {
      const { coordinator, returnIntents } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      returnIntents.record({ kind: 'navigate', destination: 'account' });
      await coordinator.completeDeletion();

      const state = coordinator.getState();
      expect(state).toEqual({ status: 'guest', reason: 'deleted' });
      expect(returnIntents.getSnapshot().status).toBe('empty');
    });
  });

  describe('Focus Area 4: Reauth and Error Paths', () => {
    it('appleReauth throws when Apple sign-in is cancelled by user', async () => {
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T20:00:00Z' });
      mockAppleAuth.signInAsync.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });

      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      await expect(coordinator.appleReauth()).rejects.toThrow('Expected recent auth proof from Apple reauthentication');
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('oauthReauth throws when OAuth browser flow is cancelled', async () => {
      const { coordinator } = createHarness({
        me: async () => userA,
        openOAuthV2: async () => ({ cancelled: true }),
      });
      await coordinator.bootstrap();

      await expect(coordinator.oauthReauth('github')).rejects.toThrow('Expected recent auth proof from OAuth reauthentication');
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('appleSignIn rethrows non-cancellation error from native prompt and restores state', async () => {
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T20:00:00Z' });
      const customError = new Error('Apple Authentication Service Unavailable');
      (customError as any).code = 'ERR_UNAVAILABLE';
      mockAppleAuth.signInAsync.mockRejectedValueOnce(customError);

      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      await expect(coordinator.appleSignIn('sign_in')).rejects.toThrow('Apple Authentication Service Unavailable');
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('oauthV2 rethrows exchange error and restores state', async () => {
      mockAuthV2Api.oauthExchange.mockRejectedValueOnce(
        new ApiError({ kind: 'server', endpoint: '/api/v2/auth/oauth/exchange', status: 500 }),
      );

      const { coordinator } = createHarness({
        me: async () => userA,
        openOAuthV2: async () => ({ code: 'otc_123', cancelled: false }),
      });
      await coordinator.bootstrap();

      await expect(coordinator.oauthV2('github', 'sign_in')).rejects.toMatchObject({ status: 500 });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });

    it('passwordReauth restores authenticated state and rethrows on invalid password error', async () => {
      mockAuthV2Api.passwordReauth.mockRejectedValueOnce(
        new ApiError({ kind: 'http', endpoint: '/api/v2/auth/reauth/password', status: 401 }),
      );

      const { coordinator } = createHarness({ me: async () => userA });
      await coordinator.bootstrap();

      await expect(coordinator.passwordReauth('wrongpass')).rejects.toMatchObject({ status: 401 });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userA });
    });
  });

  describe('Focus Area 5: Return Intent Execution & Preservation', () => {
    it('oauthV2 sign_in executes pending return intent on successful authentication', async () => {
      mockAuthV2Api.oauthExchange.mockResolvedValueOnce(userA);
      let executedIntent: any = null;
      const { coordinator, returnIntents } = createHarness({
        openOAuthV2: async () => ({ code: 'otc_123', cancelled: false }),
      });
      // Override executeReturnIntent
      (coordinator as any).dependencies.executeReturnIntent = async (intent: any) => {
        executedIntent = intent;
      };

      returnIntents.record({ kind: 'navigate', destination: 'account' });
      expect(returnIntents.getSnapshot().status).toBe('pending');

      const res = await coordinator.oauthV2('google', 'sign_in');
      expect(res).toEqual({ status: 'success', intent: 'completed' });
      expect(executedIntent).toEqual({ kind: 'navigate', destination: 'account' });
      expect(returnIntents.getSnapshot().status).toBe('completed');
    });

    it('appleSignIn sign_in executes pending return intent on successful authentication', async () => {
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T20:00:00Z' });
      mockAppleAuth.signInAsync.mockResolvedValueOnce({
        identityToken: 'id_tok',
        authorizationCode: 'auth_code',
      } as any);
      mockAuthV2Api.appleExchange.mockResolvedValueOnce(userA);

      let executedIntent: any = null;
      const { coordinator, returnIntents } = createHarness();
      (coordinator as any).dependencies.executeReturnIntent = async (intent: any) => {
        executedIntent = intent;
      };

      returnIntents.record({ kind: 'navigate', destination: 'account' });
      expect(returnIntents.getSnapshot().status).toBe('pending');

      const res = await coordinator.appleSignIn('sign_in');
      expect(res).toEqual({ status: 'success', intent: 'completed' });
      expect(executedIntent).toEqual({ kind: 'navigate', destination: 'account' });
      expect(returnIntents.getSnapshot().status).toBe('completed');
    });

    it('oauthReauth and appleReauth do not consume or execute pending return intent', async () => {
      const proof = { recent_auth_expires_at: '2026-08-13T20:00:00Z' };
      mockAuthV2Api.oauthExchange.mockResolvedValueOnce(proof);

      let executedCalls = 0;
      const { coordinator, returnIntents } = createHarness({
        me: async () => userA,
        openOAuthV2: async () => ({ code: 'otc_123', cancelled: false }),
      });
      (coordinator as any).dependencies.executeReturnIntent = async () => {
        executedCalls++;
      };
      await coordinator.bootstrap();

      returnIntents.record({ kind: 'navigate', destination: 'account' });
      expect(returnIntents.getSnapshot().status).toBe('pending');

      const res = await coordinator.oauthReauth('google');
      expect(res).toEqual(proof);
      expect(executedCalls).toBe(0);
      expect(returnIntents.getSnapshot().status).toBe('pending');
    });
  });

  describe('Focus Area 6: Superseding and Interleaved Concurrency', () => {
    it('does not allow late apple cancellation to overwrite state after a newer operation succeeded', async () => {
      const slowApplePrompt = deferred<any>();
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-13T20:00:00Z' });
      mockAppleAuth.signInAsync.mockImplementationOnce(() => slowApplePrompt.promise);

      const { coordinator } = createHarness({
        login: async () => userB,
      });

      // Start slow Apple sign-in (operation 1)
      const applePromise = coordinator.appleSignIn('sign_in');
      // Wait for appleAttempt microtasks to resolve so signInAsync is entered
      await Promise.resolve();
      await Promise.resolve();
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      // Newer login begins and completes immediately (operation 2)
      const loginRes = await coordinator.login('userb@example.com', 'secret');
      expect(loginRes).toEqual({ status: 'success', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userB });

      // Now Apple prompt finally reports user cancellation
      slowApplePrompt.reject({ code: 'ERR_REQUEST_CANCELED' });
      const appleRes = await applePromise;

      expect(appleRes).toEqual({ status: 'cancelled', intent: 'none' });
      // Crucial: State MUST remain userB, not get reset to guest or previous state
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: userB });
      expect(coordinator.getUser()).toEqual(userB);
    });
  });
});
