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
      if (checkoutUrl) await Linking.openURL(checkoutUrl);
    } catch (e) {
      Alert.alert('Payment Error', e.message || 'Failed to initiate GCash checkout.');
    } finally {
      setPaying(false);
    }
  };

  if (loading || !order) return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const isAwaitingPrice = order.status?.toLowerCase().includes('awaiting_price');
  const isPaid = order.paymentStatus?.toLowerCase() === 'paid' || order.isPaid;
  const dateStr = new Date(order.dateBooked || Date.now()).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  // Calculate madness details for display
  const madnessKg = Math.max(0, (order.actualWeightKg || 0) - 7);
  const madnessPrice = order.madnessSurcharge || (madnessKg * 50);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="close" size={24} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.receiptBox}>
          {/* Top Divider */}
          <View style={s.dashedLine} />

          {/* Business Header */}
          <View style={s.businessHeader}>
            <Text style={s.brandTitle}>WASHALERT</Text>
            <Text style={s.branchSubTitle}>TRIPLETS {order.branchName?.toUpperCase() || 'MAKATI BRANCH'}</Text>
            <Text style={s.hoursText}>Open 7:00 AM – 10:00 PM daily</Text>
          </View>

          <View style={s.dashedLine} />

          {/* Order Identity */}
          <View style={s.identitySection}>
            <Text style={s.trackingId}>{order.trackingNumber}</Text>
            <Text style={s.dateText}>{dateStr}</Text>
          </View>

          <View style={s.dashedLine} />

          {/* Customer & Weights Info */}
          <View style={s.infoSection}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Customer</Text>
              <Text style={s.infoValue}>{order.customerName}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Actual weight</Text>
              <Text style={s.infoValue}>{order.actualWeightKg || 0} kg</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Load type</Text>
              <Text style={s.infoValue}>{order.serviceMode === 'FULL_SERVICE' ? 'Mixed clothes' : 'Pure clothes'}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>No. of loads</Text>
              <Text style={s.infoValue}>1 load</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Payment</Text>
              <Text style={s.infoValue}>{order.paymentMethod?.toLowerCase() || 'cod'}</Text>
            </View>
          </View>

          <View style={s.dashedLine} />

          {/* Service Breakdown */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>SERVICE BREAKDOWN</Text>
          </View>

          <View style={s.itemRow}>
            <View style={s.itemLeft}>
              <Text style={s.itemName}>{order.serviceName || 'Wash Only'}</Text>
              <Text style={s.itemSub}>₱{order.servicePrice || 80} × 1 load</Text>
            </View>
            <Text style={s.itemPrice}>₱{(order.servicePrice || 80).toFixed(2)}</Text>
          </View>

          {madnessPrice > 0 && (
            <View style={s.itemRow}>
              <View style={s.itemLeft}>
                <Text style={[s.itemName, { color: '#C2410C' }]}>Madness surcharge</Text>
                <Text style={s.itemSub}>({order.actualWeightKg}kg – 7kg capacity) × ₱50</Text>
              </View>
              <Text style={[s.itemPrice, { color: '#C2410C' }]}>₱{madnessPrice.toFixed(2)}</Text>
            </View>
          )}

          <View style={s.dashedLine} />

          {/* Additional Charges */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>ADDITIONAL CHARGES</Text>
          </View>

          <View style={s.itemRow}>
            <View style={s.itemLeft}>
              <Text style={s.itemName}>Convenience fee</Text>
              <Text style={s.itemSub}>Online booking · system fee</Text>
            </View>
            <Text style={s.itemPrice}>₱{(order.deliveryPrice || 20).toFixed(2)}</Text>
          </View>

          <View style={s.dashedLine} />

          {/* Total Section */}
          <View style={s.totalSection}>
            <View>
              <Text style={s.totalLabel}>TOTAL</Text>
              <Text style={s.totalValue}>₱{(order.finalPrice || order.amount || 0).toFixed(2)}</Text>
            </View>
            <View style={s.paymentStatusBox}>
              <Text style={s.payLabel}>PAYMENT</Text>
              <Text style={s.payVal}>{order.paymentMethod?.toUpperCase() || 'COD'}</Text>
            </View>
          </View>

          <View style={s.dashedLine} />

          {/* Footer Info */}
          <View style={s.receiptFooter}>
            <Text style={s.stars}>* * * * * * * * * *</Text>
            <Text style={s.orderRef}>{order.trackingNumber}-{new Date().getFullYear()}</Text>
            <Text style={s.footerThankYou}>Thank you for choosing WashAlert!</Text>
            <Text style={s.footerOfficial}>This is your official receipt. Please keep for reference.</Text>
            <View style={s.dashedLine} />
          </View>
        </View>

        {/* Dynamic Action Button */}
        <View style={s.actionContainer}>
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
            <View style={s.paidBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={s.paidText}>Verified Paid</Text>
            </View>
          ) : (
            <View style={s.waitingBadge}>
              <Text style={s.waitingText}>Waiting for Final Price Approval</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, alignItems: 'flex-end' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  scrollContent: { paddingHorizontal: 20 },
  receiptBox: { backgroundColor: '#fff', padding: 20, borderRadius: 4, elevation: 1 },
  dashedLine: { height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', marginVertical: 15 },
  businessHeader: { alignItems: 'center' },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  branchSubTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 4, letterSpacing: 0.5 },
  hoursText: { fontSize: 12, color: '#94A3B8', marginTop: 6, fontWeight: '500' },
  identitySection: { alignItems: 'center', paddingVertical: 10 },
  trackingId: { fontSize: 32, fontWeight: '900', color: '#2563EB', letterSpacing: -0.5 },
  dateText: { fontSize: 14, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  infoSection: { gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#0F172A', fontWeight: '800' },
  sectionHeader: { marginBottom: 15 },
  sectionHeaderText: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  itemSub: { fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  totalSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  totalLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  totalValue: { fontSize: 34, fontWeight: '900', color: '#2563EB', marginTop: 4 },
  paymentStatusBox: { alignItems: 'flex-end' },
  payLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },
  payVal: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  receiptFooter: { alignItems: 'center', marginTop: 10 },
  stars: { color: '#CBD5E1', letterSpacing: 2 },
  orderRef: { fontSize: 12, color: '#94A3B8', marginVertical: 8, fontWeight: '700' },
  footerThankYou: { fontSize: 13, color: '#64748B', fontWeight: '700' },
  footerOfficial: { fontSize: 11, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  actionContainer: { marginTop: 24 },
  payBtn: { backgroundColor: '#2563EB', borderRadius: 12, height: 56, alignItems: 'center', justifyContent: 'center' },
  payBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0FDF4', padding: 16, borderRadius: 12 },
  paidText: { fontSize: 15, fontWeight: '800', color: '#059669' },
  waitingBadge: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, alignItems: 'center' },
  waitingText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
