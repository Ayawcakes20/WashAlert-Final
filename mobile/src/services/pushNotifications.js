import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const DEVICE_ID_KEY = 'washalert_device_installation_id_v1';
const isExpoGoAndroid =
  Platform.OS === 'android' &&
  (Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const generateDeviceId = () => `wa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getOrCreateDeviceId = async () => {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const next = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return generateDeviceId();
  }
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('washalert-updates', {
    name: 'WashAlert Updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

export const registerForPushNotifications = async () => {
  const deviceId = await getOrCreateDeviceId();

  if (isExpoGoAndroid) {
    return {
      token: null,
      platform: 'ANDROID_FCM',
      deviceId,
      unsupportedReason: 'ANDROID_REMOTE_PUSH_REQUIRES_DEVELOPMENT_BUILD',
    };
  }

  if (Platform.OS !== 'android') {
    return { token: null, platform: Platform.OS.toUpperCase(), deviceId };
  }

  await ensureAndroidChannel();
  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    throw new Error('Push notification permission was not granted.');
  }

  const tokenResult = await Notifications.getDevicePushTokenAsync({ type: 'fcm' });
  if (!tokenResult?.data) {
    throw new Error('Unable to retrieve FCM device token.');
  }

  return {
    token: String(tokenResult.data),
    platform: 'ANDROID_FCM',
    deviceId,
  };
};

export const subscribePushTokenRefresh = (onTokenRefresh) => {
  if (Platform.OS !== 'android' || isExpoGoAndroid) {
    return { remove: () => {} };
  }

  return Notifications.addPushTokenListener(async (tokenResult) => {
    if (!tokenResult?.data) return;
    const payload = {
      token: String(tokenResult.data),
      platform: 'ANDROID_FCM',
      deviceId: await getOrCreateDeviceId(),
    };
    onTokenRefresh?.(payload);
  });
};
