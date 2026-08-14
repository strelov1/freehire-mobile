import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';

export const isPushSupported = !(isRunningInExpoGo() && Platform.OS === 'android');

let cachedModule: typeof NotificationsType | null = null;

export function getNotifications(): typeof NotificationsType | null {
  if (!isPushSupported) return null;
  if (cachedModule) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-notifications') as typeof NotificationsType;
    return cachedModule;
  } catch {
    return null;
  }
}

export type NotificationResponse = NotificationsType.NotificationResponse;
