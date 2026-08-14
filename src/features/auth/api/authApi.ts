import { apiBase } from '@/lib/config';
import { ApiError, request } from '@/lib/transport';
import type { User } from '@/lib/types';

import { authEndpoints, oauthStartEndpoint } from './authEndpoints';

type Data<T> = { data: T };

function call<T>(endpoint: (typeof authEndpoints)[keyof typeof authEndpoints], body?: unknown, signal?: AbortSignal, sessionEpoch?: number) {
  return request<T>(endpoint.path, {
    method: endpoint.method,
    authMode: endpoint.authMode,
    expectsBody: endpoint.expectsBody,
    body,
    signal,
    sessionEpoch,
    cache: 'no-store',
  });
}

export const authApi = {
  async register(email: string, password: string, signal?: AbortSignal): Promise<User> {
    return (await call<Data<User>>(authEndpoints.register, { email, password }, signal)).data;
  },
  async login(email: string, password: string, signal?: AbortSignal): Promise<User> {
    return (await call<Data<User>>(authEndpoints.login, { email, password }, signal)).data;
  },
  async logout(signal?: AbortSignal): Promise<void> {
    await call<void>(authEndpoints.logout, undefined, signal);
  },
  async logoutAll(sessionEpoch: number, signal?: AbortSignal): Promise<void> {
    await call<void>(authEndpoints.logoutAll, undefined, signal, sessionEpoch);
  },
  async me(signal?: AbortSignal): Promise<User> {
    return (await call<Data<User>>(authEndpoints.me, undefined, signal)).data;
  },
  async requestVerification(sessionEpoch: number, signal?: AbortSignal): Promise<void> {
    await call<void>(authEndpoints.requestVerification, undefined, signal, sessionEpoch);
  },
  async confirmVerification(code: string, sessionEpoch: number, signal?: AbortSignal): Promise<User> {
    return (await call<Data<User>>(authEndpoints.confirmVerification, { code }, signal, sessionEpoch)).data;
  },
  async forgotPassword(email: string, signal?: AbortSignal): Promise<void> {
    await call<void>(authEndpoints.forgotPassword, { email }, signal);
  },
  async resetPassword(email: string, code: string, password: string, signal?: AbortSignal): Promise<void> {
    await call<unknown>(authEndpoints.resetPassword, { email, code, password }, signal);
  },
  async changePassword(currentPassword: string, password: string, sessionEpoch: number, signal?: AbortSignal): Promise<void> {
    await call<unknown>(authEndpoints.changePassword, { current_password: currentPassword, password }, signal, sessionEpoch);
  },
  async oauthProviders(signal?: AbortSignal): Promise<string[]> {
    return (await call<Data<string[]>>(authEndpoints.oauthProviders, undefined, signal)).data ?? [];
  },
  oauthStartUrl(provider: string): string {
    const endpoint = oauthStartEndpoint(provider);
    return `${apiBase}${endpoint.path}?platform=mobile`;
  },
  async exchangeOAuth(code: string, signal?: AbortSignal): Promise<User> {
    return (await call<Data<User>>(authEndpoints.oauthExchange, { code }, signal)).data;
  },
  // Account deletion lives in authV2Api: it is recent-auth gated and shares that
  // module's (email, sessionEpoch, signal) argument order.
};

const SAFE_MESSAGES: Record<string, string> = {
  'login:401': 'Invalid email or password.',
  'register:400': 'Please enter a valid email and a password of at least 8 characters.',
  'register:409': 'That email is already registered.',
  'oauth:401': 'This sign-in link expired. Please try again.',
  'forgot:400': 'Please enter a valid email address.',
  'reset:400': 'Please enter a valid code and a password of at least 8 characters.',
  'reset:401': 'Reset code is invalid or expired. Please request a new one.',
  'reset:404': 'Reset code is invalid or expired. Please request a new one.',
  'any:429': 'Too many attempts. Please wait and try again.',
};

export function authMessage(
  error: unknown,
  operation: 'login' | 'register' | 'oauth' | 'forgot' | 'reset',
): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (error.status === 429 && error.retryAfterSeconds !== undefined) {
    return `Too many attempts. Try again in ${Math.max(1, Math.ceil(error.retryAfterSeconds / 60))} minute(s).`;
  }
  return (
    SAFE_MESSAGES[`${operation}:${error.status}`] ??
    SAFE_MESSAGES[`any:${error.status}`] ??
    (error.kind === 'offline'
      ? 'You appear to be offline. Check your connection and try again.'
      : error.kind === 'timeout' || error.kind === 'server'
        ? 'Authentication is temporarily unavailable. Please try again.'
        : 'Something went wrong. Please try again.')
  );
}

export { ApiError };
