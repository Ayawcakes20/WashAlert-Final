/* eslint-disable import/no-duplicates */
import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigation';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import PushNotificationBridge from './src/components/PushNotificationBridge';
import PriceConfirmationModal from './src/components/PriceConfirmationModal';

// Instruct Expo Splash Screen to hold native splash until React root layout is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RootErrorBoundary caught exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>WashAlert Startup Error</Text>
          <Text style={styles.errorMessage}>
            {String(this.state.error?.message || this.state.error || 'An unexpected startup error occurred.')}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [priceModalData, setPriceModalData] = useState(null);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('App prepare error:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();

    const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification?.request?.content?.data || {};
      if (data.type === 'PRICE_CONFIRMATION_REQUIRED' && data.id) {
        const [orderId, trackingNumber] = String(data.id).split(':');
        setPriceModalData({ id: orderId, trackingNumber });
      }
    });

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

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#1A2B4A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#F3F4F6',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

