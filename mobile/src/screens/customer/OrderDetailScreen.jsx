import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { bookings as bookingsApi, payments } from '../../services/api';
import { Button } from '../../components';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

const ORDER_PROGRESS_STEPS = [
  { key: 'pending', label: 'Order Received', icon: 'cube-outline' },
  { key: 'washing', label: 'Washing', icon: 'water-outline' },
  { key: 'drying', label: 'Drying', icon: 'bonfire-outline' },
  { key: 'ready', label: 'Ready', icon: 'checkmark-circle-outline' },
  { key: 'delivering', label: 'Out for Delivery', icon: 'bus-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-done-outline' },
];

const normalizeOrderStatus = (status) => {
  const raw = String(status || '').trim().toLowerCase();
  const map = {
    received: 'pending',
    pending: 'pending',
    washing: 'washing',
    drying: 'drying',
    ready: 'ready',
    pending_pickup: 'delivering',
    en_route_to_pickup: 'delivering',
    picked_up: 'delivering',
    in_transit: 'delivering',
    delivering: 'delivering',
    delivered: 'delivered',
    cancelled: 'cancelled',
    failed: 'cancelled',
  };
  return map[raw] || raw || 'pending';
};

const formatStatusLabel = (status) =>
  String(status || 'pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());

const getStatusColor = (status) => {
  switch (normalizeOrderStatus(status)) {
    case 'pending':
      return { bg: 'hsla(224, 82%, 48%, 0.1)', text: colors.primary };
    case 'washing':
    case 'drying':
      return { bg: 'hsla(16, 100%, 56%, 0.1)', text: colors.warning };
    case 'ready':
      return { bg: 'hsla(156, 87%, 34%, 0.1)', text: colors.success };
    case 'delivering':
      return { bg: 'hsla(38, 92%, 50%, 0.1)', text: colors.warning };
    case 'delivered':
      return { bg: 'hsla(174, 79%, 44%, 0.1)', text: colors.accent };
    case 'cancelled':
      return { bg: 'hsla(0, 84%, 60%, 0.1)', text: colors.error };
    default:
      return { bg: colors.border, text: colors.textSecondary };
  }
};

const normalizeCheckoutUrl = (value) => {
  if (!value) return null;
  return String(value).trim();
};

const OrderDetailScreen = ({ route, navigation }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for live indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  // Real-time Firestore listener: when staff updates status on web Kanban,
  // Firestore is synced and this listener fires immediately — no refresh needed.
  useEffect(() => {
    if (!order?.id) return;
    const trackingNumber = order.trackingNumber || order.id;
    if (!trackingNumber) return;

    const unsub = onSnapshot(
      doc(db, 'orders', String(trackingNumber)),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // Map Firestore status field to the mobile status format
          const rawStatus = (data.status || '').toLowerCase();
          const statusMap = {
            pending: 'pending',
            washing: 'washing',
            drying: 'drying',
            ready: 'ready',
            pending_pickup: 'delivering',
            en_route_to_pickup: 'delivering',
            picked_up: 'delivering',
            in_transit: 'delivering',
            delivered: 'delivered',
            cancelled: 'cancelled',
          };
          const mappedStatus = statusMap[rawStatus] || rawStatus;
          if (mappedStatus && mappedStatus !== order?.status) {
            console.log('[OrderDetail] Firestore status update tracking=', trackingNumber, 'status=', mappedStatus);
            setOrder(prev => prev ? { ...prev, status: mappedStatus } : prev);
          }
        }
      },
      (err) => console.warn('Firestore order listener error:', err.message)
    );

    return () => unsub();
  }, [order?.id, order?.trackingNumber]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const data = await bookingsApi.getById(orderId);
      console.log('[OrderDetail] Backend order loaded tracking=', data?.trackingNumber || data?.id, 'status=', data?.status);
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Order not found</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const normalizedStatus = normalizeOrderStatus(order.status);
  const sColor = getStatusColor(normalizedStatus);

  // Show a live indicator dot when real-time status is being tracked
  const isTracking = !!order?.trackingNumber;
  const currentStepIndex = ORDER_PROGRESS_STEPS.findIndex((step) => step.key === normalizedStatus);
  const completedSteps = currentStepIndex >= 0 ? currentStepIndex + 1 : 1;
  const progressPercent = Math.max(10, Math.round((completedSteps / ORDER_PROGRESS_STEPS.length) * 100));

  // Default timeline if missing from API
  const timeline = (order.timeline && order.timeline.length
    ? order.timeline
    : ORDER_PROGRESS_STEPS.map((step, index) => ({
        step: step.label,
        time: index === 0 ? order.date : '',
        done: index <= currentStepIndex,
        icon: step.icon,
      })));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{order.id}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isTracking && (
              <View style={styles.liveTag}>
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: sColor.bg }]}>
              <Text style={[styles.badgeText, { color: sColor.text }]}>{formatStatusLabel(normalizedStatus)}</Text>
            </View>
          </View>
        </View>

        {/* Progress Tracker */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Progress</Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressSummary}>
            Current: {formatStatusLabel(normalizedStatus)} ({completedSteps}/{ORDER_PROGRESS_STEPS.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressChipsRow}>
            {ORDER_PROGRESS_STEPS.map((step, index) => {
              const done = index <= currentStepIndex;
              const active = index === currentStepIndex;
              return (
                <View
                  key={step.key}
                  style={[styles.progressChip, done && styles.progressChipDone, active && styles.progressChipActive]}
                >
                  <Ionicons
                    name={done ? 'checkmark' : step.icon}
                    size={13}
                    color={done ? colors.card : colors.textSecondary}
                  />
                  <Text style={[styles.progressChipText, done && styles.progressChipTextDone]}>{step.label}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Order Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Information</Text>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Branch</Text><Text style={styles.infoVal}>{order.branchName || order.branch}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Service</Text><Text style={styles.infoVal}>{order.serviceType || order.service}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Load</Text><Text style={styles.infoVal}>{order.loadKg} kg</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Detergent</Text><Text style={styles.infoVal}>{order.detergent}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Conditioner</Text><Text style={styles.infoVal}>{order.conditioner}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Instructions</Text><Text style={styles.infoVal}>{order.instructions || 'None'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Date</Text><Text style={styles.infoVal}>{order.date}</Text></View>
          {order.scheduleDate && (
             <View style={styles.infoRow}><Text style={styles.infoKey}>Scheduled</Text><Text style={styles.infoVal}>{order.scheduleDate} , {order.scheduleTime}</Text></View>
          )}
        </View>

        {/* Payment Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Information</Text>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Service Fee</Text><Text style={styles.infoVal}>₱{(order.servicePrice || 0).toFixed(2)}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Supplies</Text><Text style={styles.infoVal}>₱{(order.suppliesPrice || 0).toFixed(2)}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Delivery Fee</Text><Text style={styles.infoVal}>₱{(order.deliveryPrice || 0).toFixed(2)}</Text></View>
          <View style={styles.receiptDivider} />
          <View style={styles.infoRow}><Text style={styles.infoKey}>Total Amount</Text><Text style={styles.amountVal}>₱{(order.amount || 0).toFixed(2)}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoKey}>Method</Text><Text style={styles.infoVal}>{order.paymentMethod}</Text></View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Status</Text>
            <View style={[styles.badge, { backgroundColor: order.paymentStatus === 'Paid' ? 'hsla(156, 87%, 34%, 0.1)' : 'hsla(38, 92%, 50%, 0.1)', paddingVertical: 2 }]}>
              <Text style={[styles.badgeText, { color: order.paymentStatus === 'Paid' ? colors.success : colors.warning }]}>{order.paymentStatus || 'Pending'}</Text>
            </View>
          </View>
          
          {/* Pay Now Button for Unpaid GCash Orders */}
          {order.paymentMethod?.toLowerCase() === 'gcash' && order.paymentStatus?.toLowerCase() !== 'paid' && (
            <TouchableOpacity 
              style={[styles.trackBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={async () => {
                try {
                  console.log('[OrderDetail][Payment] Initiating GCash checkout', order.trackingNumber || order.id);
                  const rawUrl = await payments.initiateGcashCheckout(order.trackingNumber || order.id);
                  const checkoutUrl = normalizeCheckoutUrl(rawUrl);
                  if (!checkoutUrl || !/^https?:\/\//i.test(checkoutUrl)) {
                    throw new Error('Checkout URL was not returned by backend.');
                  }
                  try {
                    const browserResult = await WebBrowser.openBrowserAsync(checkoutUrl);
                    console.log('[OrderDetail][Payment] Browser launch result=', browserResult?.type || 'unknown');
                    if (browserResult?.type !== 'opened') {
                      const canOpen = await Linking.canOpenURL(checkoutUrl);
                      if (canOpen) {
                        await Linking.openURL(checkoutUrl);
                        console.log('[OrderDetail][Payment] Fallback Linking.openURL success');
                      }
                    }
                  } catch (openError) {
                    console.warn('[OrderDetail][Payment] WebBrowser launch failed, attempting Linking fallback');
                    const canOpen = await Linking.canOpenURL(checkoutUrl);
                    if (canOpen) {
                      await Linking.openURL(checkoutUrl);
                      console.log('[OrderDetail][Payment] Fallback Linking.openURL success');
                    } else {
                      throw openError;
                    }
                  }
                } catch (error) {
                  console.error('[OrderDetail][Payment] Checkout launch failed:', error);
                  Alert.alert('Error', 'Could not initiate payment. Please try again.');
                }
              }}
            >
              <Ionicons name="card-outline" size={16} color={colors.card} />
              <Text style={styles.trackBtnText}>Pay Now with GCash</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Delivery Info */}
        {order.delivery && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Information</Text>
            <View style={styles.infoRow}><Text style={styles.infoKey}>Address</Text><Text style={[styles.infoVal, { maxWidth: '60%', textAlign: 'right' }]}>{order.delivery.address}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoKey}>Driver</Text><Text style={styles.infoVal}>{order.delivery.driver}</Text></View>
            
            <TouchableOpacity 
              style={styles.trackBtn}
              onPress={() => navigation.navigate('Tracking', { orderId: order.id })}
            >
              <Ionicons name="location" size={16} color={colors.card} />
              <Text style={styles.trackBtnText}>Track Delivery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Timeline Vertical */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Timeline</Text>
          <View style={styles.vertTimeline}>
            {timeline.map((t, i) => (
              <View key={i} style={styles.vertTimelineRow}>
                <View style={styles.vertIconCol}>
                  <View style={[styles.vertDot, t.done ? styles.vertDotActive : styles.vertDotInactive]} />
                  {i < timeline.length - 1 && (
                    <View style={[styles.vertLine, t.done ? styles.vertLineActive : styles.vertLineInactive]} />
                  )}
                </View>
                <View style={styles.vertContent}>
                  <Text style={[styles.vertStep, t.done ? styles.vertStepActive : styles.vertStepInactive]}>{t.step}</Text>
                  {t.time ? <Text style={styles.vertTime}>{t.time}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.callBtn}>
            <Ionicons name="call-outline" size={16} color={colors.primary} />
            <Text style={styles.callText}>Call Branch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.trackOrderBtn} onPress={() => navigation.navigate('Tracking', { orderId: order.id })}>
            <Ionicons name="location-outline" size={16} color={colors.card} />
            <Text style={styles.trackOrderText}>Track Order</Text>
          </TouchableOpacity>
        </View>

        {normalizedStatus === 'pending' && (
          <TouchableOpacity 
            style={[styles.callBtn, { borderColor: colors.error, marginTop: 12, height: 48, width: '100%' }]}
            onPress={() => {
              Alert.alert(
                "Cancel Order",
                "Are you sure you want to cancel this booking?",
                [
                  { text: "No", style: "cancel" },
                  { text: "Yes", style: "destructive", onPress: async () => {
                      try {
                        await bookingsApi.cancel(order.id);
                        Alert.alert("Success", "Booking Cancelled");
                        navigation.goBack();
                      } catch (e) {
                        Alert.alert("Error", e.message || "Failed to cancel.");
                      }
                  }}
                ]
              );
            }}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={[styles.callText, { color: colors.error }]}>Cancel Booking</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 14, fontWeight: '500', color: colors.text, marginLeft: 8 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 16 },

  progressBarTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  progressSummary: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  progressChipsRow: {
    marginTop: 10,
    gap: 8,
    paddingRight: 8,
  },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  progressChipDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressChipActive: {
    borderColor: colors.primary,
  },
  progressChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressChipTextDone: {
    color: colors.card,
  },

  receiptDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12, borderStyle: 'dashed' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoKey: { fontSize: 14, color: colors.textSecondary },
  infoVal: { fontSize: 14, fontWeight: '500', color: colors.text },
  amountVal: { fontSize: 14, fontWeight: 'bold', color: colors.primary },

  trackBtn: { width: '100%', height: 44, backgroundColor: colors.accent, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  trackBtnText: { color: colors.card, fontSize: 14, fontWeight: '600', marginLeft: 8 },

  liveTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText: { fontSize: 9, fontWeight: '700', color: '#22c55e', letterSpacing: 0.5 },

  vertTimelineRow: { flexDirection: 'row' },
  vertIconCol: { alignItems: 'center', width: 20, marginRight: 12 },
  vertDot: { width: 12, height: 12, borderRadius: 6 },
  vertDotActive: { backgroundColor: colors.primary },
  vertDotInactive: { backgroundColor: colors.border },
  vertLine: { width: 2, height: 32 },
  vertLineActive: { backgroundColor: colors.primary },
  vertLineInactive: { backgroundColor: colors.border },
  vertContent: { paddingBottom: 16 },
  vertStep: { fontSize: 14, fontWeight: '500' },
  vertStepActive: { color: colors.text },
  vertStepInactive: { color: colors.textSecondary },
  vertTime: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  callBtn: { flex: 1, height: 48, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  callText: { color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 8 },
  trackOrderBtn: { flex: 1, height: 48, backgroundColor: colors.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trackOrderText: { color: colors.card, fontSize: 14, fontWeight: '600', marginLeft: 8 },
});

export default OrderDetailScreen;

