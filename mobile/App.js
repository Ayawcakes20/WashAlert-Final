/* eslint-disable import/no-duplicates */
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator, { navigateWhenReady } from './src/navigation/AppNavigation';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import PushNotificationBridge from './src/components/PushNotificationBridge';

const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) { console.error('Background location error:', error); return; }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      console.log('Background location update:', locations[0].coords);
    }
  }
});

// Opens the full-screen Receipt for a "price is ready" push. This used to render a second
// PriceConfirmationModal at the root of the app, mounted alongside the one inside
// OrderDetailScreen — two independent copies of the same modal competing to show the same
// receipt. Routing to the shared Receipt screen instead means there is exactly one receipt UI.
const openReceiptFromNotification = (data) => {
  if (data?.type !== 'PRICE_CONFIRMATION_REQUIRED' || !data?.id) return;
  const [orderId, trackingNumber] = String(data.id).split(':');
  navigateWhenReady('Receipt', { orderData: { id: orderId, trackingNumber } });
};

export default function App() {

  useEffect(() => {
    // Check and apply OTA updates automatically
    async function checkOtaUpdates() {
      try {
        if (!__DEV__) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        }
      } catch (e) {
        console.log('[OTA] Update check skipped/failed:', e.message);
      }
    }
    checkOtaUpdates();

    // Listen for FCM notifications received while app is foregrounded
    const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
      openReceiptFromNotification(notification?.request?.content?.data || {});
    });

    // Listen for taps on background notifications
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      openReceiptFromNotification(response?.notification?.request?.content?.data || {});
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PushNotificationBridge />
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

