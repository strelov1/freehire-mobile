import type { SessionState } from './authTypes';

export type AccountRouteDecision = 'allow' | 'loading' | 'unavailable' | 'authenticate';

export function accountRouteDecision(state: SessionState): AccountRouteDecision {
  switch (state.status) {
    case 'authenticated':
    case 'refreshing':
    case 'signingOut':
      return 'allow';
    case 'unavailable':
      return 'unavailable';
    case 'guest':
      return 'authenticate';
    case 'bootstrapping':
    case 'authenticating':
      return 'loading';
  }
}

export function authRouteShouldLeave(state: SessionState): boolean {
  return state.status === 'authenticated' || state.status === 'refreshing' || state.status === 'signingOut';
}
