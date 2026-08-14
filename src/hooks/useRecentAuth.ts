import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { RecentAuthProof } from '@/features/auth/model/authV2Types';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';

export type ReauthMethod = 'password' | 'oauth' | 'apple';

export type ReauthRequestOptions =
  | { method: 'password'; password?: string; provider?: string }
  | { method: 'oauth'; provider?: string; password?: string }
  | { method: 'apple'; provider?: string; password?: string };

export type UseRecentAuthReturn = {
  /** True if the current recent-auth proof is active and unexpired */
  hasRecentAuth: boolean;
  /** Date timestamp when recent-auth proof expires, or null */
  recentAuthExpiresAt: Date | null;
  /** Remaining seconds until recent-auth proof expires (0 if expired/none) */
  remainingSeconds: number;
  /** Record new recent-auth proof expiration */
  recordRecentAuth: (expiresAt: string | Date | RecentAuthProof | null | undefined) => void;
  /** Clear active recent-auth proof */
  clearRecentAuth: () => void;
  /** Execute re-authentication using the specified method */
  requestReauth: (options: ReauthRequestOptions) => Promise<RecentAuthProof>;
  /**
   * Helper that executes a sensitive action. If unauthenticated or if a 428
   * recent_auth_required error is caught, triggers onRequestReauth and retries.
   */
  executeWithRecentAuth: <T>(
    action: () => Promise<T>,
    onRequestReauth?: () => Promise<boolean | RecentAuthProof | void>,
  ) => Promise<T>;
  /** Alias for executeWithRecentAuth */
  withRecentAuth: <T>(
    action: () => Promise<T>,
    onRequestReauth?: () => Promise<boolean | RecentAuthProof | void>,
  ) => Promise<T>;
};

type Snapshot = {
  hasRecentAuth: boolean;
  remainingSeconds: number;
  recentAuthExpiresAt: Date | null;
};

// Module-level shared proof state so all components and hooks remain in sync
let sharedExpiresAt: Date | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function calculateRemainingSeconds(expiresAt: Date | null): number {
  if (!expiresAt) return 0;
  const diffMs = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}

function computeSnapshot(): Snapshot {
  const remaining = calculateRemainingSeconds(sharedExpiresAt);
  return {
    hasRecentAuth: remaining > 0,
    remainingSeconds: remaining,
    recentAuthExpiresAt: remaining > 0 ? sharedExpiresAt : null,
  };
}

let lastSnapshot: Snapshot = computeSnapshot();

function notify() {
  lastSnapshot = computeSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return lastSnapshot;
}

function updateTimer() {
  if (sharedExpiresAt && sharedExpiresAt.getTime() > Date.now()) {
    if (!intervalId) {
      intervalId = setInterval(() => {
        if (!sharedExpiresAt || sharedExpiresAt.getTime() <= Date.now()) {
          sharedExpiresAt = null;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
        notify();
      }, 1000);
      if (typeof intervalId === 'object' && typeof (intervalId as { unref?: () => void }).unref === 'function') {
        (intervalId as { unref: () => void }).unref();
      }
    }
  } else {
    sharedExpiresAt = null;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
  notify();
}

/** Directly record recent authentication expiry in module store */
export function recordRecentAuth(proof: string | Date | RecentAuthProof | null | undefined) {
  if (!proof) {
    clearRecentAuth();
    return;
  }
  let date: Date;
  if (proof instanceof Date) {
    date = proof;
  } else if (typeof proof === 'string') {
    date = new Date(proof);
  } else if (typeof proof === 'object' && 'recent_auth_expires_at' in proof) {
    date = new Date(proof.recent_auth_expires_at);
  } else {
    clearRecentAuth();
    return;
  }

  if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    clearRecentAuth();
    return;
  }

  sharedExpiresAt = date;
  updateTimer();
}

/** Directly clear recent authentication expiry in module store */
export function clearRecentAuth() {
  sharedExpiresAt = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  notify();
}

/** Determine if an error is an HTTP 428 Precondition Required or recent_auth_required error */
export function isRecentAuthRequiredError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof ApiError) {
    return error.status === 428 || error.code === 'recent_auth_required';
  }
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return (
      record.status === 428 ||
      record.code === 'recent_auth_required' ||
      record.error === 'recent_auth_required' ||
      record.message === 'recent authentication required'
    );
  }
  return false;
}

/**
 * Hook for tracking recent-auth proof expiration and managing reauthentication
 * gating for high-security operations (password change, unlinking identities, account deletion).
 */
export function useRecentAuth(): UseRecentAuthReturn {
  const { user, sessionEpoch, passwordReauth, oauthReauth, appleReauth } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const previousUserRef = useRef<number | null>(user?.id ?? null);
  const previousEpochRef = useRef<number>(sessionEpoch);

  // Clean reset whenever user identity or session epoch changes
  useEffect(() => {
    const userChanged = previousUserRef.current !== (user?.id ?? null);
    const epochChanged = previousEpochRef.current !== sessionEpoch;

    if (userChanged || epochChanged) {
      previousUserRef.current = user?.id ?? null;
      previousEpochRef.current = sessionEpoch;
      clearRecentAuth();
    }
  }, [user?.id, sessionEpoch]);

  const requestReauth = useCallback(
    async (options: ReauthRequestOptions): Promise<RecentAuthProof> => {
      let result: RecentAuthProof | { status?: string };
      if (options.method === 'password') {
        if (!options.password) {
          throw new Error('Password is required for password re-authentication');
        }
        result = await passwordReauth(options.password);
      } else if (options.method === 'oauth') {
        if (!options.provider) {
          throw new Error('Provider is required for OAuth re-authentication');
        }
        const res = await oauthReauth(options.provider);
        result = res as RecentAuthProof;
      } else if (options.method === 'apple') {
        const res = await appleReauth();
        result = res as RecentAuthProof;
      } else {
        throw new Error(`Unsupported reauth method: ${(options as { method: string }).method}`);
      }

      if (result && 'recent_auth_expires_at' in result && typeof result.recent_auth_expires_at === 'string') {
        recordRecentAuth(result.recent_auth_expires_at);
        return result;
      }

      throw new Error('Re-authentication did not return a valid proof');
    },
    [passwordReauth, oauthReauth, appleReauth],
  );

  const executeWithRecentAuth = useCallback(
    async <T>(
      action: () => Promise<T>,
      onRequestReauth?: () => Promise<boolean | RecentAuthProof | void>,
    ): Promise<T> => {
      const currentSnap = computeSnapshot();
      if (!currentSnap.hasRecentAuth && onRequestReauth) {
        const reauthRes = await onRequestReauth();
        if (reauthRes === false) {
          throw new Error('reauth_cancelled');
        }
      }

      try {
        return await action();
      } catch (err: unknown) {
        if (isRecentAuthRequiredError(err)) {
          clearRecentAuth();
          if (onRequestReauth) {
            const reauthRes = await onRequestReauth();
            if (reauthRes === false) {
              throw err;
            }
            return await action();
          }
        }
        throw err;
      }
    },
    [],
  );

  return {
    hasRecentAuth: snapshot.hasRecentAuth,
    recentAuthExpiresAt: snapshot.recentAuthExpiresAt,
    remainingSeconds: snapshot.remainingSeconds,
    recordRecentAuth,
    clearRecentAuth,
    requestReauth,
    executeWithRecentAuth,
    withRecentAuth: executeWithRecentAuth,
  };
}
