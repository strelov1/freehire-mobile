/**
 * Push notifications: this device's Expo token and the words for what a send
 * did. Deliberately free of app state — `useAuth` is not imported here so that
 * `authStore` can unregister this device on sign-out without an import cycle.
 * The screen-facing hook lives in `usePushNotifications.ts`.
 *
 * There is no local record of whether push is on. It is on when the OS
 * permission is granted AND this device's token is among the user's registered
 * devices (`GET /me/push-tokens`) — one source of truth, the backend's. The OS
 * permission alone cannot carry that state: an app cannot revoke its own
 * permission, so a user who switched push off would be silently re-registered
 * on the next launch.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { unregisterPushToken } from './api';
import { getNotifications, type NotificationResponse } from './notifications';
import type { PushDevice, TestPushResult } from './types';

/** Whether this device's token is one of the user's registered devices. Another
 *  device of the same account must not turn this device's switch on, so the
 *  match is on the token itself. */
export function isRegistered(devices: PushDevice[], token: string | null): boolean {
  return token !== null && devices.some((d) => d.token === token);
}

/**
 * Plain words for a test send's four counts. Two of the outcomes need the user
 * to act — nothing registered, and a registration the backend just removed as
 * dead — so they must not read as "sent". `sent + pruned + failed` always equals
 * `devices`, which is why no case here is empty.
 */
export function describeTestPush(r: TestPushResult): string {
  if (r.devices === 0) return 'No device is registered for push notifications.';

  const parts: string[] = [];
  if (r.sent > 0) {
    parts.push(`Test notification sent to ${r.sent} ${r.sent === 1 ? 'device' : 'devices'}.`);
  }
  if (r.pruned > 0) {
    const stale =
      r.pruned === 1
        ? 'A registration is no longer valid and was removed'
        : `${r.pruned} registrations are no longer valid and were removed`;
    parts.push(`${stale} — switch notifications off and on again to re-register.`);
  }
  if (r.failed > 0) {
    const subject = r.failed === 1 ? 'One notification' : `${r.failed} notifications`;
    parts.push(`${subject} could not be sent.`);
  }
  return parts.join(' ');
}

/** The platform string the backend accepts (`ios` or `android`); anything else
 *  is a 400 there, so web never reaches registration. */
export function pushPlatform(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

/**
 * This device's Expo push token, or `null` when push isn't available here:
 * web, permission not granted, no EAS project id, or Expo's token service is
 * unreachable (it is a network call, and being offline must not throw at a
 * caller who only wanted to know the current state).
 *
 * `prompt` decides whether a missing permission is *requested*. The launch-time
 * read passes `false` — asking for permission is something the user initiates by
 * flipping the switch, not something a screen does on open.
 */
export async function getPushToken(prompt: boolean): Promise<string | null> {
  const notifs = getNotifications();
  if (!notifs) return null;

  if (pushPlatform() === null) return null;

  let { granted } = await notifs.getPermissionsAsync();
  if (!granted && prompt) {
    granted = (await notifs.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  // Android delivers only through a channel; without one, a push arrives silently.
  if (Platform.OS === 'android') {
    await notifs.setNotificationChannelAsync('default', {
      name: 'Job alerts',
      importance: notifs.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await notifs.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/**
 * Drop this device's registration, used on sign-out: without it the next account
 * to sign in on this phone inherits the previous user's notifications until the
 * row happens to be overwritten. Best-effort by design — a sign-out must not
 * fail because the network did, and the token is only readable while permission
 * stands, so there is nothing to remove when it doesn't.
 */
export async function unregisterThisDevice(): Promise<void> {
  try {
    const token = await getPushToken(false);
    if (token) await unregisterPushToken(token);
  } catch {
    // Deliberately swallowed: see above.
  }
}

/**
 * The job slug carried in a tapped push's deep-link data, or null when it has
 * none. Only a push that concerns exactly one job (a reminder, a nudge, or a
 * subscription digest with a single match) carries a slug — a digest with
 * several matches carries none, and a tap on it should just foreground the
 * app rather than guess which job to open.
 */
export function jobSlugFromResponse(response: NotificationResponse): string | null {
  const slug = response.notification.request.content.data?.slug;
  return typeof slug === 'string' && slug.length > 0 ? slug : null;
}
