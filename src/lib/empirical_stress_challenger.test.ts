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

const testUser1: User = {
  id: 101,
  email: 'user101@example.test',
  role: 'user',
  beta_tester: false,
  email_verified: true,
  has_password: true,
  created_at: null,
};

const testUser2: User = {
  id: 102,
  email: 'user102@example.test',
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
  // Attach dummy handler so unhandled rejections don't crash Node if discarded
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function createTestHarness(overrides: {
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
    login: overrides.login ?? (async () => testUser1),
    register: overrides.register ?? (async () => testUser1),
    exchangeOAuth: overrides.exchangeOAuth ?? (async () => testUser1),
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

describe('Empirical Adversarial Stress Test - SessionCoordinator & cancelCurrent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Adversarial Abort Scenarios on All Auth Operations', () => {
    it('aborted logoutAll restores authenticated state and ignores late completion', async () => {
      const slowLogoutAll = deferred<void>();
      const { coordinator } = createTestHarness({
        me: async () => testUser1,
        logoutAll: () => slowLogoutAll.promise,
      });
      await coordinator.bootstrap();

      const p = coordinator.logoutAll();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: testUser1 });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      slowLogoutAll.resolve();
      await expect(p).resolves.toBeUndefined();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });
    });

    it('aborted passwordReauth restores authenticated state and throws cancellation error', async () => {
      const slowPassword = deferred<{ recent_auth_expires_at: string }>();
      mockAuthV2Api.passwordReauth.mockImplementationOnce(() => slowPassword.promise);

      const { coordinator } = createTestHarness({ me: async () => testUser1 });
      await coordinator.bootstrap();

      const p = coordinator.passwordReauth('mysecret');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'login' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      slowPassword.resolve({ recent_auth_expires_at: '2026-08-14T20:00:00Z' });
      await expect(p).rejects.toThrow('Reauthentication cancelled by newer operation');
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });
    });

    it('aborted appleSignIn (sign_in) restores guest state when cancelled during attempt', async () => {
      const slowAttempt = deferred<{ attempt_id: string; expires_at: string }>();
      mockAuthV2Api.appleAttempt.mockImplementationOnce(() => slowAttempt.promise);

      const { coordinator } = createTestHarness();
      const p = coordinator.appleSignIn('sign_in');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });

      slowAttempt.resolve({ attempt_id: 'att_999', expires_at: '2026-08-14T20:00:00Z' });
      const res = await p;
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });

    it('aborted appleSignIn (sign_in) restores guest state when cancelled during native Apple sheet', async () => {
      const slowApple = deferred<{ identityToken: string; authorizationCode: string }>();
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-14T20:00:00Z' });
      mockAppleAuth.signInAsync.mockImplementationOnce(() => slowApple.promise as any);

      const { coordinator } = createTestHarness();
      const p = coordinator.appleSignIn('sign_in');
      // Wait for appleAttempt to resolve so signInAsync is entered
      await Promise.resolve();
      await Promise.resolve();

      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });

      slowApple.reject({ code: 'ERR_REQUEST_CANCELED' });
      const res = await p;
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });

    it('aborted appleSignIn (reauth) restores authenticated state when cancelled during native Apple sheet', async () => {
      const slowApple = deferred<{ identityToken: string; authorizationCode: string }>();
      mockAuthV2Api.appleAttempt.mockResolvedValueOnce({ attempt_id: 'att_123', expires_at: '2026-08-14T20:00:00Z' });
      mockAppleAuth.signInAsync.mockImplementationOnce(() => slowApple.promise as any);

      const { coordinator } = createTestHarness({ me: async () => testUser1 });
      await coordinator.bootstrap();

      const p = coordinator.appleReauth();
      // Wait for appleAttempt to resolve so signInAsync is entered
      await Promise.resolve();
      await Promise.resolve();

      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      slowApple.reject({ code: 'ERR_REQUEST_CANCELED' });
      await expect(p).rejects.toThrow('Expected recent auth proof from Apple reauthentication');
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });
    });

    it('aborted register restores guest state', async () => {
      const slowRegister = deferred<User>();
      const { coordinator } = createTestHarness({
        register: () => slowRegister.promise,
      });

      const p = coordinator.register('new@test.com', 'password123');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'register' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });

      slowRegister.reject(new ApiError({ kind: 'aborted', endpoint: '/register' }));
      const res = await p;
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });
  });

  describe('Adversarial Concurrency & Rapid Invocations', () => {
    it('handles multiple consecutive cancelCurrent() calls idempotently without state thrashing', async () => {
      const slowLogout = deferred<void>();
      const { coordinator, states } = createTestHarness({
        me: async () => testUser1,
        logout: () => slowLogout.promise,
      });
      await coordinator.bootstrap();

      states.length = 0;
      const p = coordinator.logout();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: testUser1 });

      // Call cancelCurrent 5 times in a row
      for (let i = 0; i < 5; i++) {
        coordinator.cancelCurrent();
      }

      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });
      // Only one state transition should occur from signingOut -> authenticated
      expect(states).toEqual([
        { status: 'signingOut', user: testUser1 },
        { status: 'authenticated', user: testUser1 },
      ]);

      slowLogout.reject(new ApiError({ kind: 'aborted', endpoint: '/logout' }));
      await expect(p).resolves.toBeUndefined();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });
    });

    it('handles rapid sequence: logout -> cancelCurrent -> login -> cancelCurrent -> oauthV2', async () => {
      const slowLogout = deferred<void>();
      const slowLogin = deferred<User>();
      const slowOAuth = deferred<{ code?: string; cancelled: boolean }>();

      const { coordinator } = createTestHarness({
        me: async () => testUser1,
        logout: () => slowLogout.promise,
        login: () => slowLogin.promise,
        openOAuthV2: () => slowOAuth.promise,
      });
      await coordinator.bootstrap();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      // Step 1: Start logout and cancel it
      const pLogout = coordinator.logout();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: testUser1 });
      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      // Step 2: Start login (as guest) and cancel it
      const pLogin = coordinator.login('someone@test.com', 'pass');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'login' });
      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      // Step 3: Start oauthV2 and let it resolve with testUser2
      mockAuthV2Api.oauthExchange.mockResolvedValueOnce(testUser2);
      const pOAuth = coordinator.oauthV2('github', 'sign_in');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      // Step 4: Resolve in reverse/arbitrary order
      slowLogout.reject(new ApiError({ kind: 'aborted', endpoint: '/logout' }));
      slowLogin.resolve(testUser1);
      slowOAuth.resolve({ code: 'valid_code', cancelled: false });

      await pLogout;
      const resLogin = await pLogin;
      const resOAuth = await pOAuth;

      expect(resLogin).toEqual({ status: 'cancelled', intent: 'none' });
      expect(resOAuth).toEqual({ status: 'success', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser2 });
      expect(coordinator.getUser()).toEqual(testUser2);
    });

    it('does not leak or throw when aborted operation encounters non-abort server 500 error after cancellation', async () => {
      const slowDelete = deferred<void>();
      mockAuthV2Api.deleteAccount.mockImplementationOnce(() => slowDelete.promise);

      const { coordinator } = createTestHarness({ me: async () => testUser1 });
      await coordinator.bootstrap();

      const p = coordinator.deleteAccount();
      expect(coordinator.getState()).toEqual({ status: 'signingOut', user: testUser1 });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      // Server returns 500 internal server error late after client cancelled
      slowDelete.reject(new ApiError({ kind: 'server', endpoint: '/me', status: 500 }));
      await expect(p).resolves.toBeUndefined();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });
    });

    it('does not leak or throw when aborted oauthV2 exchange fails after cancellation during browser session', async () => {
      const slowBrowser = deferred<{ code?: string; cancelled: boolean }>();
      const slowExchange = deferred<User>();
      mockAuthV2Api.oauthExchange.mockImplementationOnce(() => slowExchange.promise);

      const { coordinator } = createTestHarness({
        openOAuthV2: () => slowBrowser.promise,
      });

      const p = coordinator.oauthV2('google', 'sign_in');
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });

      slowBrowser.resolve({ code: 'code123', cancelled: false });
      slowExchange.reject(new ApiError({ kind: 'server', endpoint: '/oauth/exchange', status: 500 }));
      const res = await p;
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });

    it('does not leak or throw when aborted oauthV2 exchange fails after cancellation during exchange', async () => {
      const slowExchange = deferred<User>();
      mockAuthV2Api.oauthExchange.mockImplementationOnce(() => slowExchange.promise);

      const { coordinator } = createTestHarness({
        openOAuthV2: async () => ({ code: 'code123', cancelled: false }),
      });

      const p = coordinator.oauthV2('google', 'sign_in');
      // Wait for openOAuthV2 to resolve
      await Promise.resolve();
      await Promise.resolve();
      expect(coordinator.getState()).toEqual({ status: 'authenticating', operation: 'oauth' });

      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });

      slowExchange.reject(new ApiError({ kind: 'server', endpoint: '/oauth/exchange', status: 500 }));
      const res = await p;
      expect(res).toEqual({ status: 'cancelled', intent: 'none' });
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'no_session' });
    });
  });

  describe('cancelCurrent when already in stable or unavailable state', () => {
    it('is a safe no-op when called in guest state', () => {
      const { coordinator } = createTestHarness();
      // Initially bootstrapping
      coordinator.cancelCurrent();
      // Still bootstrapping (not transient auth/signout/refreshing)
      expect(coordinator.getState()).toEqual({ status: 'bootstrapping' });
    });

    it('is a safe no-op when called in unavailable state', async () => {
      const { coordinator, states } = createTestHarness({
        me: async () => {
          throw new ApiError({ kind: 'offline', endpoint: '/me' });
        },
      });
      await coordinator.bootstrap();
      expect(coordinator.getState()).toEqual({ status: 'unavailable', kind: 'offline' });

      states.length = 0;
      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'unavailable', kind: 'offline' });
      expect(states).toEqual([]);
    });

    it('is a safe no-op when called in confirmed authenticated state', async () => {
      const { coordinator, states } = createTestHarness({ me: async () => testUser1 });
      await coordinator.bootstrap();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });

      states.length = 0;
      coordinator.cancelCurrent();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: testUser1 });
      expect(states).toEqual([]);
    });
  });
});
