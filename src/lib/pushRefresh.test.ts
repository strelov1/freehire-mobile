import { listPushDevices, registerPushToken } from './api';
import { getNotifications } from './notifications';
import { refreshThisDevice } from './push';

jest.mock('./api', () => ({
  listPushDevices: jest.fn(),
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(),
}));
jest.mock('./notifications', () => ({ getNotifications: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'p' } } } }));

const TOKEN = 'ExponentPushToken[this-device]';

function notifs(granted: boolean, token = TOKEN) {
  return {
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted }),
    requestPermissionsAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: token }),
  };
}

function device(token: string) {
  return { token, platform: 'ios', created_at: '', last_seen_at: '' };
}

beforeEach(() => jest.resetAllMocks());

/**
 * Launch keeps an existing registration alive and never creates one: the OS
 * permission outlives the user's "off", so registering a token the backend does
 * not list would silently turn push back on.
 */
describe('refreshThisDevice', () => {
  it('re-registers a token the backend already lists for this account', async () => {
    (getNotifications as jest.Mock).mockReturnValue(notifs(true));
    (listPushDevices as jest.Mock).mockResolvedValue([device(TOKEN)]);

    await expect(refreshThisDevice()).resolves.toBe(TOKEN);
    expect(registerPushToken).toHaveBeenCalledWith(TOKEN, 'ios');
  });

  it('leaves push off when this token is not registered, even with permission', async () => {
    (getNotifications as jest.Mock).mockReturnValue(notifs(true));
    (listPushDevices as jest.Mock).mockResolvedValue([device('ExponentPushToken[other-phone]')]);

    await expect(refreshThisDevice()).resolves.toBeNull();
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('never prompts for permission', async () => {
    const n = notifs(false);
    (getNotifications as jest.Mock).mockReturnValue(n);

    await expect(refreshThisDevice()).resolves.toBeNull();
    expect(n.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(listPushDevices).not.toHaveBeenCalled();
  });

  it('swallows a network failure', async () => {
    (getNotifications as jest.Mock).mockReturnValue(notifs(true));
    (listPushDevices as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(refreshThisDevice()).resolves.toBeNull();
  });
});
