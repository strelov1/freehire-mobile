import type { SessionState } from '../model/authTypes';

export type SessionAction =
  | { type: 'BOOTSTRAP' }
  | { type: 'GUEST'; reason: Extract<SessionState, { status: 'guest' }>['reason'] }
  | { type: 'UNAVAILABLE'; kind: Extract<SessionState, { status: 'unavailable' }>['kind'] }
  | { type: 'AUTHENTICATING'; operation: Extract<SessionState, { status: 'authenticating' }>['operation'] }
  | { type: 'AUTHENTICATED'; user: Extract<SessionState, { status: 'authenticated' }>['user'] }
  | { type: 'REFRESHING'; user: Extract<SessionState, { status: 'refreshing' }>['user']; issue?: Extract<SessionState, { status: 'unavailable' }>['kind'] }
  | { type: 'SIGNING_OUT'; user: Extract<SessionState, { status: 'signingOut' }>['user'] };

export function sessionReducer(_state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'BOOTSTRAP':
      return { status: 'bootstrapping' };
    case 'GUEST':
      return { status: 'guest', reason: action.reason };
    case 'UNAVAILABLE':
      return { status: 'unavailable', kind: action.kind };
    case 'AUTHENTICATING':
      return { status: 'authenticating', operation: action.operation };
    case 'AUTHENTICATED':
      return { status: 'authenticated', user: action.user };
    case 'REFRESHING':
      return { status: 'refreshing', user: action.user, issue: action.issue };
    case 'SIGNING_OUT':
      return { status: 'signingOut', user: action.user };
  }
}
