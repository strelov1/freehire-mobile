import type { RecentAuthProof } from '@/features/auth/model/authV2Types';

/**
 * The "you proved it was you recently" window, kept outside React so both the
 * session coordinator (which has no hooks) and every screen read one truth. It
 * holds nothing secret — only when the server-side proof expires — but it must
 * be dropped the moment the identity changes, or the next account inherits the
 * previous one's window and skips its re-auth prompt.
 *
 * The ticking interval only runs while something is subscribed, so a signed-out
 * app (and a finished test run) leaves no timer behind.
 */

export type RecentAuthSnapshot = {
  hasRecentAuth: boolean;
  remainingSeconds: number;
  recentAuthExpiresAt: Date | null;
};

let expiresAt: Date | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function remainingSecondsUntil(target: Date | null): number {
  if (!target) return 0;
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 1000));
}

function computeSnapshot(): RecentAuthSnapshot {
  const remaining = remainingSecondsUntil(expiresAt);
  return {
    hasRecentAuth: remaining > 0,
    remainingSeconds: remaining,
    recentAuthExpiresAt: remaining > 0 ? expiresAt : null,
  };
}

// useSyncExternalStore compares snapshots by identity, so getSnapshot has to
// hand back a cached object rather than a fresh one on every read.
let lastSnapshot: RecentAuthSnapshot = computeSnapshot();

function notify() {
  lastSnapshot = computeSnapshot();
  for (const listener of listeners) listener();
}

function stopTimer() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}

function startTimer() {
  if (intervalId || listeners.size === 0) return;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return;
  intervalId = setInterval(() => {
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      expiresAt = null;
      stopTimer();
    }
    notify();
  }, 1000);
}

export function subscribeRecentAuth(listener: () => void): () => void {
  listeners.add(listener);
  notify();
  startTimer();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopTimer();
  };
}

export function getRecentAuthSnapshot(): RecentAuthSnapshot {
  return lastSnapshot;
}

/**
 * Reads the clock rather than the cached snapshot — callers gating a sensitive
 * action need the answer as of right now, not as of the last tick.
 */
export function hasRecentAuthNow(): boolean {
  return remainingSecondsUntil(expiresAt) > 0;
}

/** Reads the expiry out of a proof (or a raw date) and starts the window. */
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

  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    clearRecentAuth();
    return;
  }

  expiresAt = date;
  startTimer();
  notify();
}

export function clearRecentAuth() {
  expiresAt = null;
  stopTimer();
  notify();
}
