import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Dimensions, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { bookings as bookingsApi, payments as paymentsApi } from '../../services/api';
import { db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await bookingsApi.getDetails(orderId);
      setOrder(res);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Unable to load order details.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadData();
    // Real-time status sync via Firestore
    const unsub = onSnapshot(doc(db, 'orders', String(orderId)), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOrder(prev => prev ? { ...prev, status: data.status, paymentStatus: data.paymentStatus || prev.paymentStatus } : prev);
      }
    });
    return () => unsub();
  }, [orderId]);

  const handlePayment = async () => {
    try {
      setPaying(true);
      const { checkoutUrl } = await paymentsApi.initiateGcashCheckout(order);
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      }
    } catch (e) {
      Alert.alert('Payment Error', e.message || 'Failed to initiate GCash checkout.');
    } finally {
      setPaying(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isAwaitingPrice = order.status?.toLowerCase().includes('awaiting_price');
  const isPaid = order.paymentStatus?.toLowerCase() === 'paid' || order.isPaid;
  const dateStr = new Date(order.dateBooked || Date.now()).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="close" size={24} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {/* Branch & Logo */}
        <View style={s.brandSection}>
          <Image source={require('../../../assets/images/logo-speedywash.webp')} style={s.brandLogo} />
          <Text style={s.brandName}>WashAlert</Text>
          <Text style={s.branchName}>{order.branchName?.toUpperCase() || 'MAKATI BRANCH'}</Text>
        </View>

        {/* Order Number & Date */}
        <Text style={s.trackingNum}>{order.trackingNumber}</Text>
        <Text style={s.orderDate}>{dateStr}</Text>

        {/* Customer & Service Info */}
        <View style={s.customerSection}>
          <View style={s.customerInfo}>
            <Text style={s.customerLabel}>{order.customerName}</Text>
            <Text style={s.customerSub}>{order.customerPhone}</Text>
          </View>
          <View style={s.serviceBadge}>
            <Text style={s.serviceBadgeText}>{order.serviceType?.toUpperCase() || 'PICKUP & DELIVERY'}</Text>
          </View>
        </View>

        {/* Actual Weight Badge */}
        {order.actualWeightKg > 0 && (
          <View style={s.weightBadge}>
            <MaterialCommunityIcons name="scale-bathroom" size={18} color="#059669" />
            <Text style={s.weightText}>
              Actual weight: <Text style={s.weightVal}>{order.actualWeightKg} kg</Text>
            </Text>
          </View>
        )}

        {/* Receipt Breakdown (Exactly like Image 2) */}
        <View style={s.dividerDashed} />
        
        <View style={s.receiptTable}>
          <View style={s.receiptRow}>
            <Text style={s.receiptLabel}>{order.serviceName || 'Wash & Dry'}</Text>
            <Text style={s.receiptValue}>₱{(order.servicePrice || 0).toFixed(2)}</Text>
          </View>

          {order.rushPrice > 0 && (
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Rush Fee</Text>
              <Text style={s.receiptValue}>₱{order.rushPrice.toFixed(2)}</Text>
            </View>
          )}

          {/* Calculate Madness Surcharge if not explicit */}
          {(order.madnessSurcharge > 0 || (order.actualWeightKg > 8)) && (
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Madness Surcharge</Text>
              <Text style={[s.receiptValue, { color: colors.primary, fontWeight: '800' }]}>
                ₱{(order.madnessSurcharge || (Math.max(0, order.actualWeightKg - 8) * 50)).toFixed(2)}
              </Text>
            </View>
          )}

          {order.suppliesPrice > 0 && (
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Supplies (Detergent/Fabcon)</Text>
              <Text style={s.receiptValue}>₱{order.suppliesPrice.toFixed(2)}</Text>
            </View>
          )}

          <View style={s.receiptRow}>
            <Text style={s.receiptLabel}>Convenience Fee</Text>
            <Text style={s.receiptValue}>₱{(order.deliveryPrice || 20).toFixed(2)}</Text>
          </View>
        </View>

        {/* Total Amount Card */}
        <View style={s.totalCard}>
          <View>
            <Text style={s.totalCardLabel}>TOTAL AMOUNT DUE</Text>
            <Text style={s.totalCardValue}>₱{(order.finalPrice || order.amount || 0).toFixed(2)}</Text>
          </View>
          <View style={s.paymentInfo}>
            <Text style={s.paymentLabel}>PAYMENT</Text>
            <Text style={s.paymentMethod}>{order.paymentMethod?.toLowerCase() || 'gcash'}</Text>
          </View>
        </View>

        {/* Action Button */}
        {isAwaitingPrice && !isPaid ? (
          <TouchableOpacity 
            style={s.payBtn} 
            onPress={handlePayment}
            disabled={paying}
          >
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.payBtnText}>Confirm & Pay with GCash</Text>
            )}
          </TouchableOpacity>
        ) : isPaid ? (
          <View style={s.paidBadgeLarge}>
            <Ionicons name="checkmark-circle" size={24} color="#059669" />
            <Text style={s.paidBadgeText}>Payment Verified & Paid</Text>
          </View>
        ) : (
          <View style={s.statusInfoBox}>
            <Text style={s.statusInfoTitle}>Status: {order.status?.toUpperCase().replace(/_/g, ' ')}</Text>
            <Text style={s.statusInfoSub}>Waiting for staff to verify weight and update final price.</Text>
          </View>
        )}

        <Text style={s.disclaimer}>
          By confirming, you agree to the total above. Washing begins only after your confirmation.
        </Text>

        <TouchableOpacity style={s.helpRow} onPress={() => Linking.openURL('tel:09691737924')}>
          <Ionicons name="call-outline" size={16} color={colors.primary} />
          <Text style={s.helpText}>Question about the price? Call 0969 173 7924</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10 },
  brandSection: { alignItems: 'center', marginBottom: 24 },
  brandLogo: { width: 60, height: 60, borderRadius: 30, marginBottom: 12 },
  brandName: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  branchName: { fontSize: 12, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1 },
  trackingNum: { fontSize: 42, fontWeight: '900', color: colors.primary, textAlign: 'center', letterSpacing: -1 },
  orderDate: { fontSize: 16, color: colors.textTertiary, textAlign: 'center', marginBottom: 24, fontWeight: '600' },
  customerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  customerInfo: { flex: 1 },
  customerLabel: { fontSize: 18, fontWeight: '800', color: colors.text },
  customerSub: { fontSize: 14, color: colors.textTertiary, marginTop: 2 },
  serviceBadge: { backgroundColor: '#F0F4FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  serviceBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', padding: 14, borderRadius: 14, marginBottom: 24 },
  weightText: { fontSize: 15, color: '#065F46', fontWeight: '600' },
  weightVal: { fontWeight: '900', fontSize: 18 },
  dividerDashed: { height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 },
  receiptTable: { gap: 14, marginBottom: 32 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  receiptValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalCard: { backgroundColor: '#1C2F3E', borderRadius: 24, padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  totalCardLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  totalCardValue: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 4 },
  paymentInfo: { alignItems: 'flex-end' },
  paymentLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  paymentMethod: { fontSize: 16, fontWeight: '800', color: '#FCD34D', marginTop: 4 },
  payBtn: { backgroundColor: colors.primary, borderRadius: 16, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  payBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  paidBadgeLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F0FDF4', padding: 20, borderRadius: 16, marginBottom: 20 },
  paidBadgeText: { fontSize: 16, fontWeight: '800', color: '#059669' },
  statusInfoBox: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: colors.primary },
  statusInfoTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  statusInfoSub: { fontSize: 13, color: colors.textTertiary, marginTop: 4, lineHeight: 18 },
  disclaimer: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18, marginBottom: 24 },
  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  helpText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
