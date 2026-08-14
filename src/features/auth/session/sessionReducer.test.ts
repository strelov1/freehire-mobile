import type { User } from '@/lib/types';

import { sessionReducer } from './sessionReducer';

const user: User = {
  id: 1,
  email: 'one@example.test',
  role: 'user',
  beta_tester: false,
  email_verified: true,
  has_password: true,
  created_at: null,
};

describe('sessionReducer', () => {
  it('represents every public session phase without a nullable loading guess', () => {
    let state = sessionReducer({ status: 'bootstrapping' }, { type: 'AUTHENTICATING', operation: 'login' });
    expect(state).toEqual({ status: 'authenticating', operation: 'login' });
    state = sessionReducer(state, { type: 'AUTHENTICATED', user });
    expect(state).toEqual({ status: 'authenticated', user });
    state = sessionReducer(state, { type: 'REFRESHING', user, issue: 'offline' });
    expect(state).toEqual({ status: 'refreshing', user, issue: 'offline' });
    state = sessionReducer(state, { type: 'SIGNING_OUT', user });
    expect(state).toEqual({ status: 'signingOut', user });
    state = sessionReducer(state, { type: 'GUEST', reason: 'signed_out' });
    expect(state).toEqual({ status: 'guest', reason: 'signed_out' });
    state = sessionReducer(state, { type: 'UNAVAILABLE', kind: 'offline' });
    expect(state).toEqual({ status: 'unavailable', kind: 'offline' });
  });
});
