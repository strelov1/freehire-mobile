import type { AuthMode } from '@/lib/transport';

export type EndpointContract = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  authMode: AuthMode;
  success: number;
  expectsBody: boolean;
};

export const authEndpoints = {
  register: { method: 'POST', path: '/api/v1/auth/register', authMode: 'public', success: 201, expectsBody: true },
  login: { method: 'POST', path: '/api/v1/auth/login', authMode: 'public', success: 200, expectsBody: true },
  logout: { method: 'POST', path: '/api/v1/auth/logout', authMode: 'public', success: 204, expectsBody: false },
  logoutAll: { method: 'POST', path: '/api/v1/auth/logout-all', authMode: 'required', success: 204, expectsBody: false },
  me: { method: 'GET', path: '/api/v1/auth/me', authMode: 'probe', success: 200, expectsBody: true },
  requestVerification: { method: 'POST', path: '/api/v1/auth/verify/request', authMode: 'required', success: 202, expectsBody: false },
  confirmVerification: { method: 'POST', path: '/api/v1/auth/verify/confirm', authMode: 'required', success: 200, expectsBody: true },
  forgotPassword: { method: 'POST', path: '/api/v1/auth/password/forgot', authMode: 'public', success: 202, expectsBody: false },
  resetPassword: { method: 'POST', path: '/api/v1/auth/password/reset', authMode: 'public', success: 200, expectsBody: true },
  changePassword: { method: 'POST', path: '/api/v1/me/password', authMode: 'required', success: 200, expectsBody: true },
  oauthProviders: { method: 'GET', path: '/api/v1/auth/oauth/providers', authMode: 'public', success: 200, expectsBody: true },
  oauthExchange: { method: 'POST', path: '/api/v1/auth/oauth/exchange', authMode: 'public', success: 200, expectsBody: true },
  deleteAccount: { method: 'DELETE', path: '/api/v1/me', authMode: 'required', success: 204, expectsBody: false },
} as const satisfies Record<string, EndpointContract>;

export function oauthStartEndpoint(provider: string): EndpointContract {
  return {
    method: 'GET',
    path: `/api/v1/auth/oauth/${encodeURIComponent(provider)}/start`,
    authMode: 'public',
    success: 302,
    expectsBody: false,
  };
}
