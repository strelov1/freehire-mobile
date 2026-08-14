import type { User } from '@/lib/types';

export type GuestReason = 'no_session' | 'expired' | 'signed_out' | 'signed_out_everywhere' | 'deleted';
export type AvailabilityKind = 'offline' | 'timeout' | 'server' | 'protocol';
export type AuthOperation = 'login' | 'register' | 'oauth';

export type SessionState =
  | { status: 'bootstrapping' }
  | { status: 'guest'; reason: GuestReason }
  | { status: 'unavailable'; kind: AvailabilityKind }
  | { status: 'authenticating'; operation: AuthOperation }
  | { status: 'authenticated'; user: User }
  | { status: 'refreshing'; user: User; issue?: AvailabilityKind }
  | { status: 'signingOut'; user: User };

export type AuthCompletion = {
  status: 'success' | 'cancelled';
  intent: 'none' | 'completed' | 'failed';
};

export type SessionOwner = { userId: number; sessionEpoch: number };
