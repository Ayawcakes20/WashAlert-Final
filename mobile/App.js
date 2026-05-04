/* eslint-disable import/no-duplicates */
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigation';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import PushNotificationBridge from './src/components/PushNotificationBridge';
import PriceConfirmationModal from './src/components/PriceConfirmationModal';

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

export default function App() {
  const [priceModalData, setPriceModalData] = useState(null);

  useEffect(() => {
    // Listen for FCM notifications received while app is foregrounded
    const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification?.request?.content?.data || {};
      if (data.type === 'PRICE_CONFIRMATION_REQUIRED' && data.id) {
        const [orderId, trackingNumber] = String(data.id).split(':');
        setPriceModalData({ id: orderId, trackingNumber });
      }
    });

    // Listen for taps on background notifications
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response?.notification?.request?.content?.data || {};
      if (data.type === 'PRICE_CONFIRMATION_REQUIRED' && data.id) {
        const [orderId, trackingNumber] = String(data.id).split(':');
        setPriceModalData({ id: orderId, trackingNumber });
      }
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
          <PriceConfirmationModal
            visible={!!priceModalData}
            orderData={priceModalData}
            onConfirmed={() => setPriceModalData(null)}
            onDismiss={() => setPriceModalData(null)}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

