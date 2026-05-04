import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, Linking, Alert, BackHandler, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { bookings, payments } from '../services/api';
import logoLaundryHubs from '../../assets/images/logo-laundryhubs.webp';
import logoSpeedyWash from '../../assets/images/logo-speedywash.webp';

const fmt = (n) => `\u20b1${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReceiptRow = ({ label, value, bold, accent }) => (
  <View style={S.receiptRow}>
    <Text style={[S.receiptRowLabel, bold && { fontWeight: '700', color: '#1E293B' }]}>{label}</Text>
    <Text style={[S.receiptRowValue, accent && { color: '#2563EB', fontSize: 15, fontWeight: '900' }]}>{value}</Text>
  </View>
);

export default function PriceConfirmationModal({ visible, orderData, onConfirmed, onDismiss }) {
  const [loading, setLoading] = useState(false);
  const [fullOrderData, setFullOrderData] = useState(orderData);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Sync internal state with prop
  useEffect(() => {
    setFullOrderData(orderData);
  }, [orderData]);

  // Fetch full details if only ID is provided (e.g. from notification)
  useEffect(() => {
    if (visible && orderData && (!orderData.amount || !orderData.serviceName)) {
      (async () => {
        try {
          const id = orderData.id || orderData.dbId;
          if (id) {
            const full = await bookings.getById(id);
            if (full) setFullOrderData(full);
          }
        } catch (e) {
          console.warn('[PriceModal] Failed to fetch full details:', e);
        }
      })();
    }
  }, [visible, orderData]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  const handleConfirm = async () => {
    if (!fullOrderData) return;
    setLoading(true);
    try {
      const isGcash = String(fullOrderData.paymentMethod || '').toUpperCase() === 'GCASH';
      
      console.log('[PAYMENT] Starting confirmation process for:', orderData.trackingNumber || orderData.id);
      console.log('[PAYMENT] Payment method:', orderData.paymentMethod);
      console.log('[PAYMENT] Order data:', JSON.stringify(orderData, null, 2));
      
      // 1. Confirm the price first (Backend sets status to PRICE_CONFIRMED)
      console.log('[PAYMENT] Step 1: Confirming price...');
      let confirmedOrder;
      try {
        // Use fullOrderData as it's guaranteed to have the numeric DB ID
        confirmedOrder = await bookings.confirmPrice(fullOrderData || orderData);
        console.log('[PAYMENT] ✓ Price confirmed successfully');
      } catch (confirmErr) {
        console.error('[PAYMENT] ✗ confirmPrice FAILED:', confirmErr.message);
        throw new Error(`Price confirmation failed: ${confirmErr.message}`);
      }
      
      // 2. If GCash, trigger PayMongo Checkout
      if (isGcash) {
        try {
          console.log('[PAYMENT] Step 2: Initiating GCash checkout...');
          // Ensure we have a valid identifier for the checkout
          const checkoutTarget = confirmedOrder?.trackingNumber || fullOrderData?.trackingNumber || orderData;
          
          const response = await payments.initiateGcashCheckout(checkoutTarget);
          const checkoutUrl = response?.checkoutUrl;

          if (checkoutUrl) {
            console.log('[PAYMENT] Opening PayMongo URL:', checkoutUrl);
            try {
              // Try professional WebBrowser first
              const result = await WebBrowser.openBrowserAsync(checkoutUrl, {
                showTitle: true,
                toolbarColor: '#2563EB',
                controlsColor: '#ffffff',
                enableBarCollapsing: true,
              });
              console.log('[PAYMENT] WebBrowser closed:', result.type);
            } catch (browserErr) {
              // Fallback to standard system browser if WebBrowser fails
              console.warn('[PAYMENT] WebBrowser failed, falling back to Linking:', browserErr.message);
              if (await Linking.canOpenURL(checkoutUrl)) {
                await Linking.openURL(checkoutUrl);
              } else {
                throw new Error('No browser available to open payment link.');
              }
            }
          } else {
            throw new Error('PayMongo did not return a valid checkout link.');
          }
        } catch (paymentErr) {
          console.error('[PAYMENT] ✗ GCash checkout flow FAILED:', paymentErr.message);
          Alert.alert(
            'Payment Setup',
            'Order confirmed, but we couldn\'t open GCash automatically. You can still pay later via the "Pay Now" button in your Order Details screen.'
          );
        }
      }

      onConfirmed && onConfirmed();
    } catch (e) {
      console.error('[PAYMENT_CONFIRM_ERROR]', e);
      console.error('[PAYMENT_CONFIRM_ERROR] Stack:', e.stack);
      Alert.alert('Error', e?.message || 'Failed to confirm. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCallBranch = () => {
    Linking.openURL('tel:09691737924').catch(() =>
      Alert.alert('Error', 'Cannot open dialer.')
    );
  };

  if (!fullOrderData) return null;

  const logo = fullOrderData.branchName?.toLowerCase().includes('makati') ? logoLaundryHubs : logoSpeedyWash;

  // Use trackingNumber for display, dbId/id for API calls
  const displayTrackingNumber = fullOrderData.trackingNumber 
    ? String(fullOrderData.trackingNumber).replace(/^WA-/, '')
    : String(fullOrderData.id || '');
  
  const weight        = fullOrderData.actualWeightKg ? `${fullOrderData.actualWeightKg} kg` : null;
  const serviceName   = fullOrderData.serviceName || fullOrderData.serviceType || 'Laundry Service';
  const serviceTotal  = fullOrderData.finalPrice ?? fullOrderData.servicePrice ?? 0;
  const deliveryFee   = fullOrderData.deliveryPrice ?? 0;
  const grandTotal    = fullOrderData.amount || fullOrderData.totalPrice || (Number(serviceTotal) + Number(deliveryFee));
  const paymentMethod = String(fullOrderData.paymentMethod || 'Cash on Delivery').replace('_', ' ');


  const dateStr = new Date().toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={S.overlay}>
        <Animated.View style={[S.card, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header Controls */}
          <View style={S.headerControls}>
            <View style={S.notchBar} />
            <TouchableOpacity style={S.closeBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={32} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <View style={S.receiptTop} />

          <ScrollView
            style={S.scroll}
            contentContainerStyle={S.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header */}
            <View style={S.receiptHeader}>
              <View style={S.logoWrapper}>
                <Image source={logo} style={S.logoImg} resizeMode="contain" />
              </View>
              <Text style={S.brandName}>WashAlert</Text>
              <Text style={S.branchName}>{String(fullOrderData.branchName || 'MAKATI BRANCH').toUpperCase()}</Text>
            </View>

            {/* Tracking Number */}
            <View style={S.trackingBox}>
              <Text style={S.trackingLabel}>WA-{displayTrackingNumber}</Text>
              <Text style={S.dateLabel}>{dateStr}</Text>
            </View>

            {/* Customer row */}
            <View style={S.customerRow}>
              <View style={{flex:1}}>
                <Text style={S.custName}>{fullOrderData.customerName || 'Customer'}</Text>
                {fullOrderData.customerPhone ? <Text style={S.custPhone}>{fullOrderData.customerPhone}</Text> : null}
              </View>
              <View style={S.serviceChip}>
                <Text style={S.serviceChipTxt}>{String(fullOrderData.serviceType||'').replace('_',' ') || 'Standard'}</Text>
              </View>
            </View>

            {/* Weight badge (only when set) */}
            {weight ? (
              <View style={S.weightBadge}>
                <Ionicons name="scale-outline" size={15} color="#16A34A" />
                <Text style={S.weightTxt}>Actual weight: <Text style={{fontWeight:'900'}}>{weight}</Text></Text>
              </View>
            ) : null}

            {/* Dashed separator */}
            <View style={S.dashedSep} />

            {/* Line items */}
            <ReceiptRow label={serviceName} value={fmt(serviceTotal)} bold />
            {Number(deliveryFee) > 0 && (
              <ReceiptRow label="Logistics & Delivery" value={fmt(deliveryFee)} />
            )}
            {fullOrderData.detergent && fullOrderData.detergent !== 'None' && (
              <ReceiptRow label={`Detergent (${fullOrderData.detergent})`} value="Included" />
            )}
            {fullOrderData.conditioner && fullOrderData.conditioner !== 'None' && (
              <ReceiptRow label={`Conditioner (${fullOrderData.conditioner})`} value="Included" />
            )}

            {/* Total box */}
            <View style={S.totalBox}>
              <View>
                <Text style={S.totalLabel}>TOTAL AMOUNT DUE</Text>
                <Text style={S.totalAmount}>{fmt(grandTotal)}</Text>
              </View>
              <View style={S.payBox}>
                <Text style={S.payLabel}>PAYMENT</Text>
                <Text style={S.payMethod}>{paymentMethod}</Text>
              </View>
            </View>

            {/* Confirm button */}
            <TouchableOpacity
              style={[S.confirmBtn, loading && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.confirmBtnTxt}>
                    {String(fullOrderData.paymentMethod || '').toUpperCase() === 'GCASH' 
                      ? 'Confirm & Pay with GCash' 
                      : 'Confirm & start washing'}
                  </Text>
              }
            </TouchableOpacity>

            <Text style={S.legalTxt}>
              By confirming, you agree to the total above. Washing begins only after your confirmation.
            </Text>

            <TouchableOpacity style={S.contactLink} onPress={handleCallBranch}>
              <Ionicons name="call-outline" size={13} color="#2563EB" />
              <Text style={S.contactLinkTxt}>Question about the price? Call 0969 173 7924</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.88)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 24,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  notchBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  receiptTop: { height: 4, backgroundColor: '#1E293B', marginBottom: 0 },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 24, paddingBottom: 40 },

  receiptHeader: { alignItems: 'center', marginBottom: 16 },
  logoWrapper: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10,
  },
  logoImg: { width: 40, height: 40 },
  brandName: { fontSize: 20, fontWeight: '900', color: '#1E293B', letterSpacing: -0.3 },
  branchName: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },

  trackingBox: { alignItems: 'center', marginBottom: 16 },
  trackingLabel: { fontSize: 28, fontWeight: '900', color: '#2563EB', letterSpacing: -1.5 },
  dateLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  customerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  custName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  custPhone: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  serviceChip: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  serviceChipTxt: { fontSize: 10, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase' },

  weightBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#F0FDF4', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#DCFCE7', marginBottom: 14,
  },
  weightTxt: { fontSize: 13, color: '#15803D', fontWeight: '600' },

  dashedSep: {
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#E2E8F0',
    marginBottom: 14, height: 0,
  },

  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  receiptRowLabel: { fontSize: 13, color: '#64748B', fontWeight: '500', flex: 1, paddingRight: 8 },
  receiptRowValue: { fontSize: 13, fontWeight: '700', color: '#1E293B' },

  totalBox: {
    backgroundColor: '#1E293B', borderRadius: 18, padding: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, marginBottom: 20,
  },
  totalLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5 },
  totalAmount: { fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 2 },
  payBox: { alignItems: 'flex-end' },
  payLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5 },
  payMethod: { fontSize: 12, fontWeight: '800', color: '#FBBF24', marginTop: 2 },

  confirmBtn: {
    backgroundColor: '#2563EB', borderRadius: 16, height: 58,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 10,
  },
  confirmBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },

  legalTxt: {
    fontSize: 11, color: '#94A3B8', textAlign: 'center',
    lineHeight: 16, marginTop: 14, paddingHorizontal: 8,
  },
  contactLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', marginTop: 12, paddingVertical: 6,
  },
  contactLinkTxt: { fontSize: 13, fontWeight: '700', color: '#2563EB', textDecorationLine: 'underline' },
});
