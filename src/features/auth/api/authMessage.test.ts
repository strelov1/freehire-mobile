import { ApiError } from '@/lib/transport';

import { authMessage } from './authApi';

describe('authMessage', () => {
  it('maps only allowlisted endpoint/status combinations', () => {
    expect(authMessage(new ApiError({ kind: 'http', endpoint: '/login', status: 401 }), 'login')).toBe(
      'Invalid email or password.',
    );
    expect(authMessage(new ApiError({ kind: 'http', endpoint: '/register', status: 409 }), 'register')).toBe(
      'That email is already registered.',
    );
    expect(authMessage(new ApiError({ kind: 'http', endpoint: '/forgot', status: 400 }), 'forgot')).toBe(
      'Please enter a valid email address.',
    );
    expect(authMessage(new ApiError({ kind: 'http', endpoint: '/reset', status: 400 }), 'reset')).toBe(
      'Please enter a valid code and a password of at least 8 characters.',
    );
    expect(authMessage(new ApiError({ kind: 'http', endpoint: '/reset', status: 401 }), 'reset')).toBe(
      'Reset code is invalid or expired. Please request a new one.',
    );
    expect(authMessage(new ApiError({ kind: 'http', endpoint: '/reset', status: 404 }), 'reset')).toBe(
      'Reset code is invalid or expired. Please request a new one.',
    );
  });

  it('does not render arbitrary server text', () => {
    const error = new ApiError({
      kind: 'http',
      endpoint: '/login',
      status: 400,
      serverError: '<script>proxy text</script>',
    });
    expect(authMessage(error, 'login')).toBe('Something went wrong. Please try again.');
  });

  it('gives availability errors safe retry copy', () => {
    expect(authMessage(new ApiError({ kind: 'offline', endpoint: '/login' }), 'login')).toContain('offline');
    expect(authMessage(new ApiError({ kind: 'server', endpoint: '/login' }), 'login')).toContain(
      'temporarily unavailable',
    );
  });
});
