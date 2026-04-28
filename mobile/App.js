/* eslint-disable import/no-duplicates */
import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigation';
import * as TaskManager from 'expo-task-manager';
import PushNotificationBridge from './src/components/PushNotificationBridge';

const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      // Note: We need the orderNumber here. In a real app, we might store the 
      // active tracking order number in AsyncStorage or a persistent state.
      // For this implementation, we assume the foreground interval handles the 
      // broadcast, but this task is defined for future background expansion.
      console.log('Background location update:', location.coords);
    }
  }
});

export default function App() {
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
