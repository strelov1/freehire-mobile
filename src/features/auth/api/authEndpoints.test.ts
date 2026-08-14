import { authEndpoints, oauthStartEndpoint } from './authEndpoints';

describe('frozen v1 auth endpoint contracts', () => {
  it.each([
    ['register', 'POST', '/api/v1/auth/register', 201, 'public', true],
    ['login', 'POST', '/api/v1/auth/login', 200, 'public', true],
    ['logout', 'POST', '/api/v1/auth/logout', 204, 'public', false],
    ['logoutAll', 'POST', '/api/v1/auth/logout-all', 204, 'required', false],
    ['me', 'GET', '/api/v1/auth/me', 200, 'probe', true],
    ['requestVerification', 'POST', '/api/v1/auth/verify/request', 202, 'required', false],
    ['confirmVerification', 'POST', '/api/v1/auth/verify/confirm', 200, 'required', true],
    ['forgotPassword', 'POST', '/api/v1/auth/password/forgot', 202, 'public', false],
    ['resetPassword', 'POST', '/api/v1/auth/password/reset', 200, 'public', true],
    ['changePassword', 'POST', '/api/v1/me/password', 200, 'required', true],
    ['oauthProviders', 'GET', '/api/v1/auth/oauth/providers', 200, 'public', true],
    ['oauthExchange', 'POST', '/api/v1/auth/oauth/exchange', 200, 'public', true],
    ['deleteAccount', 'DELETE', '/api/v1/me', 204, 'required', false],
  ] as const)('%s matches the backend method/path/status/classification', (name, method, path, success, authMode, expectsBody) => {
    expect(authEndpoints[name]).toEqual({ method, path, success, authMode, expectsBody });
  });

  it('encodes the provider in the preserved browser OAuth v1 start route', () => {
    expect(oauthStartEndpoint('google/test')).toEqual({
      method: 'GET',
      path: '/api/v1/auth/oauth/google%2Ftest/start',
      success: 302,
      authMode: 'public',
      expectsBody: false,
    });
  });
});
