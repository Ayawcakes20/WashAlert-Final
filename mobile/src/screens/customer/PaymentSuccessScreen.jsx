import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { payments } from '../../services/api';

// How long to wait (ms) for the PayMongo webhook to process before checking status.
const WEBHOOK_BUFFER_MS = 4000;

const PaymentSuccessScreen = ({ navigation, route }) => {
  const tracking = route?.params?.tracking;
  const [verifying, setVerifying] = useState(true);
  // null = still waiting, true = confirmed paid, false = still processing
  const [isPaidConfirmed, setIsPaidConfirmed] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Wait for the PayMongo webhook buffer period, then check actual payment status.
    const timer = setTimeout(async () => {
      let confirmed = false;
      if (tracking) {
        try {
          const paymentRecord = await payments.trackPayment(tracking);
          const status = String(paymentRecord?.status || '').toUpperCase();
          // Only trust backend status — never mark paid on the frontend.
          confirmed = status === 'PAID' || status === 'VERIFIED';
        } catch {
          // Non-fatal: treat as still-processing so user can check later.
          confirmed = false;
        }
      }

      if (mountedRef.current) {
        setIsPaidConfirmed(confirmed);
        setVerifying(false);
      }
    }, WEBHOOK_BUFFER_MS);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [tracking]);

  const goToOrders = () => navigation.navigate('CustomerTabs', { screen: 'Orders' });

  const renderContent = () => {
    if (verifying) {
      return (
        <>
          <View style={styles.iconContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={styles.title}>Confirming Payment...</Text>
          <Text style={styles.message}>
            Please wait while we confirm your payment with the payment gateway.
          </Text>
        </>
      );
    }

    if (isPaidConfirmed) {
      return (
        <>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={100} color="#10B981" />
          </View>
          <Text style={styles.title}>Payment Confirmed!</Text>
          <Text style={styles.message}>
            Your payment has been confirmed. You can now track your order in the Orders tab.
          </Text>
        </>
      );
    }

    // Payment not yet confirmed by the backend — may be a webhook delay.
    return (
      <>
        <View style={styles.iconContainer}>
          <Ionicons name="time-outline" size={100} color="#F59E0B" />
        </View>
        <Text style={styles.title}>Payment Processing</Text>
        <Text style={styles.message}>
          Payment confirmation is still processing. Please check your order in a moment — it will
          update automatically once confirmed.
        </Text>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {renderContent()}
      <TouchableOpacity
        style={[styles.button, verifying && styles.buttonDisabled]}
        onPress={goToOrders}
        disabled={verifying}
      >
        <Text style={styles.buttonText}>Go to Orders</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 24,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PaymentSuccessScreen;
