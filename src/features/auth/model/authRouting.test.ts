import type { User } from '@/lib/types';

import { accountRouteDecision, authRouteShouldLeave } from './authRouting';

const user: User = {
  id: 1,
  email: 'one@example.test',
  role: 'user',
  beta_tester: false,
  email_verified: true,
  has_password: true,
  created_at: null,
};

describe('auth route decisions', () => {
  it('keeps bootstrap neutral and gives unavailable a retry surface', () => {
    expect(accountRouteDecision({ status: 'bootstrapping' })).toBe('loading');
    expect(accountRouteDecision({ status: 'unavailable', kind: 'server' })).toBe('unavailable');
  });

  it('guards guests and allows only confirmed private phases', () => {
    expect(accountRouteDecision({ status: 'guest', reason: 'no_session' })).toBe('authenticate');
    expect(accountRouteDecision({ status: 'authenticated', user })).toBe('allow');
    expect(accountRouteDecision({ status: 'refreshing', user })).toBe('allow');
    expect(accountRouteDecision({ status: 'signingOut', user })).toBe('allow');
    expect(authRouteShouldLeave({ status: 'authenticated', user })).toBe(true);
    expect(authRouteShouldLeave({ status: 'guest', reason: 'no_session' })).toBe(false);
  });
});
