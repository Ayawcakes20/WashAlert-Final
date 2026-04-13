import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../services/api';
import { registerForPushNotifications, subscribePushTokenRefresh } from '../services/pushNotifications';

const PushNotificationBridge = () => {
  const { isAuthenticated, user } = useAuth();
  const lastSyncedRef = useRef('');

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      lastSyncedRef.current = '';
      return undefined;
    }

    let active = true;
    let refreshSubscription = null;

    const syncToken = async ({ token, platform, deviceId }) => {
      if (!token) return;
      const dedupeKey = `${user.id}:${token}`;
      if (lastSyncedRef.current === dedupeKey) return;

      console.log('[Push] syncing FCM token userId=', user.id, 'deviceId=', deviceId, 'platform=', platform);
      await profileApi.updateFcmToken({
        fcmToken: token,
        platform,
        deviceId,
      });
      console.log('[Push] FCM token sync complete userId=', user.id);
      lastSyncedRef.current = dedupeKey;
    };

    const bootstrapPush = async () => {
      try {
        const registration = await registerForPushNotifications();
        if (!active) return;
        if (registration?.unsupportedReason) {
          console.info(
            '[Push] remote notifications are skipped in Expo Go on Android. Use a development build for push testing.'
          );
          return;
        }
        if (registration?.token) {
          await syncToken(registration);
        }
      } catch (error) {
        console.warn('[Push] registration skipped:', error?.message || error);
      }
    };

    void bootstrapPush();
    refreshSubscription = subscribePushTokenRefresh((next) => {
      if (!active || !next?.token) return;
      void syncToken(next);
    });

    return () => {
      active = false;
      refreshSubscription?.remove?.();
    };
  }, [isAuthenticated, user?.id]);

  return null;
};

export default PushNotificationBridge;
