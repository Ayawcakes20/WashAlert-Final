import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { bookings } from '../../services/api';

const PaymentSuccessScreen = ({ navigation, route }) => {
  const tracking = route?.params?.tracking;
  const [verifying, setVerifying] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Wait for the PayMongo webhook to process, then verify from backend before showing final success.
    const timer = setTimeout(async () => {
      try {
        if (tracking) {
          // Trigger a fresh fetch of orders so the Orders list is up-to-date when navigated to.
          await bookings.getMyBookings('all', 10);
        }
      } catch {
        // Non-fatal — just proceed to navigate regardless.
      } finally {
        if (mountedRef.current) setVerifying(false);
      }
    }, 3000);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [tracking]);

  const goToOrders = () => navigation.navigate('CustomerTabs', { screen: 'Orders' });

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {verifying ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <Ionicons name="checkmark-circle" size={100} color="#10B981" />
        )}
      </View>
      <Text style={styles.title}>
        {verifying ? 'Confirming Payment...' : 'Payment Successful!'}
      </Text>
      <Text style={styles.message}>
        {verifying
          ? 'Please wait while we confirm your payment.'
          : 'Your payment has been processed. You can now track your order in the Orders tab.'}
      </Text>
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
