import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { listPushDevices, registerPushToken, sendTestPush, unregisterPushToken } from './api';
import { useAuth } from './authStore';
import { describeTestPush, getPushToken, isRegistered, pushPlatform, refreshThisDevice } from './push';

/** Copy for the one failure the user can actually fix themselves. */
const PERMISSION_DENIED =
  'Notifications are turned off for freehire. Enable them in your device settings, then try again.';

/**
 * A push-notification switch's state, the two actions that change it, and the
 * test send. Drives the switch on the Profile tab — the only way a device gets
 * registered, so a build without it delivers no push at all (it was dropped
 * from 2026-08-12 to 2026-11-03 and prod held zero devices).
 *
 * State is derived, never stored: `enabled` is true when this device's Expo
 * token is among the registered devices the backend reports. Reads go through
 * React Query so the device list is shared and revalidates after a change; the
 * actions are plain async so a failure surfaces as one message beside the
 * switch rather than a thrown error in a toggle handler.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passive read: never prompts. Null until permission has been granted, which
  // is why a revoked permission alone flips the switch back off.
  const { data: token } = useQuery({
    queryKey: ['push', 'token'],
    queryFn: () => getPushToken(false),
    enabled: !!user,
    staleTime: Infinity,
  });

  const { data: devices, isPending } = useQuery({
    queryKey: ['push', 'devices'],
    queryFn: ({ signal }) => listPushDevices(signal),
    enabled: !!user,
  });

  const enabled = isRegistered(devices ?? [], token ?? null);

  /** Runs one action with exactly one error visible and the busy flag honest
   *  even when the request throws. Resolves to `null` when it did. */
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(
    () =>
      run(async () => {
        const platform = pushPlatform();
        if (!platform) return; // web: the switch isn't reachable there
        const fresh = await getPushToken(true);
        if (!fresh) {
          setError(PERMISSION_DENIED);
          return;
        }
        await registerPushToken(fresh, platform);
        // Seed the token cache: the passive read that produced `null` before
        // permission was granted would otherwise keep the switch off.
        qc.setQueryData(['push', 'token'], fresh);
        await qc.invalidateQueries({ queryKey: ['push', 'devices'] });
      }),
    [qc, run],
  );

  const disable = useCallback(
    () =>
      run(async () => {
        if (token) await unregisterPushToken(token);
        await qc.invalidateQueries({ queryKey: ['push', 'devices'] });
      }),
    [qc, run, token],
  );

  /** Sends a test push and resolves to the sentence describing what happened,
   *  or null when the call itself failed (then `error` carries the reason). */
  const sendTest = useCallback(() => run(async () => describeTestPush(await sendTestPush())), [run]);

  return { enabled, loading: isPending, busy, error, enable, disable, sendTest };
}

/**
 * Once per signed-in account per launch, refresh this device's existing push
 * registration (see `refreshThisDevice`). Mounted at the app root so it runs
 * whatever screen the app opens on, not only when the Profile tab is visited.
 */
export function usePushRefreshOnLaunch() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;
    void refreshThisDevice().then((token) => {
      if (cancelled || !token) return;
      // The switch reads the same two caches; seed them so it renders "on"
      // without a second token read.
      qc.setQueryData(['push', 'token'], token);
      void qc.invalidateQueries({ queryKey: ['push', 'devices'] });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, qc]);
}
