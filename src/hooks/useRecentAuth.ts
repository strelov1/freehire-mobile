import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { RecentAuthProof } from '@/features/auth/model/authV2Types';
import { useAuth } from '@/lib/authStore';
import {
  clearRecentAuth,
  getRecentAuthSnapshot,
  hasRecentAuthNow,
  recordRecentAuth,
  subscribeRecentAuth,
} from '@/lib/recentAuthStore';
import { ApiError } from '@/lib/transport';

export { clearRecentAuth, recordRecentAuth } from '@/lib/recentAuthStore';

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
  const snapshot = useSyncExternalStore(subscribeRecentAuth, getRecentAuthSnapshot, getRecentAuthSnapshot);

  const previousUserRef = useRef<number | null>(user?.id ?? null);
  const previousEpochRef = useRef<number>(sessionEpoch);

  // Belt and braces: the session coordinator already clears the window on every
  // identity change, including while no screen is mounted. This catches a hook
  // that mounts against an identity it has not seen before.
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
      // A caller that resolves with the proof itself has just widened the window;
      // record it so the retry does not immediately trip the same 428.
      const absorbProof = (result: boolean | RecentAuthProof | void) => {
        if (result && typeof result === 'object' && 'recent_auth_expires_at' in result) {
          recordRecentAuth(result);
        }
      };

      if (!hasRecentAuthNow() && onRequestReauth) {
        const reauthRes = await onRequestReauth();
        if (reauthRes === false) {
          throw new Error('reauth_cancelled');
        }
        absorbProof(reauthRes);
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
            absorbProof(reauthRes);
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
