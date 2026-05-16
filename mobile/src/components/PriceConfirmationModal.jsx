import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, Linking, Alert, BackHandler, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { bookings, payments } from '../services/api';
import { computeOrderPricing } from '../utils/pricingUtils';
import logoLaundryHubs from '../../assets/images/logo-laundryhubs.webp';
import logoSpeedyWash from '../../assets/images/logo-speedywash.webp';

const fmt = (n) => `\u20b1${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReceiptRow = ({ label, value, bold, accent }) => (
  <View style={S.receiptRow}>
    <Text style={[S.receiptRowLabel, bold && { fontWeight: '700', color: '#1E293B' }]}>{label}</Text>
    <Text style={[S.receiptRowValue, accent && { color: '#2563EB', fontSize: 15, fontWeight: '900' }]}>{value}</Text>
  </View>
);

export default function PriceConfirmationModal({ visible, orderData, onConfirmed, onDismiss, onRejected }) {
  const [loading, setLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [fullOrderData, setFullOrderData] = useState(orderData);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Sync internal state with prop
  useEffect(() => {
    if (orderData) setFullOrderData(orderData);
  }, [orderData]);

  // Fetch full details if only ID is provided
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
      const paymentMethodStr = String(fullOrderData.paymentMethod || '').toUpperCase();
      const isGcash = paymentMethodStr.includes('GCASH');

      // 1. Confirm the price first
      let confirmedOrder;
      try {
        confirmedOrder = await bookings.confirmPrice(fullOrderData);
      } catch (confirmErr) {
        // Handle Forbidden (CSRF or Role issue)
        if (confirmErr.message?.includes('Forbidden')) {
          Alert.alert(
            'Action Restricted',
            'You do not have permission to confirm this price. Please try logging in again.',
            [{ text: 'OK' }]
          );
          return;
        }

        throw new Error(`Price confirmation failed: ${confirmErr.message}`);
      }

      // 2. If GCash, trigger PayMongo Checkout
      if (isGcash) {
        try {
          const checkoutTarget = confirmedOrder?.trackingNumber || fullOrderData?.trackingNumber;

          if (!checkoutTarget) throw new Error('Tracking number missing for checkout.');

          const response = await payments.initiateGcashCheckout(checkoutTarget);
          // Handle both {data: {checkoutUrl}} and {checkoutUrl} structures
          const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;

          if (!checkoutUrl) {
            throw new Error('PayMongo checkout URL is missing from response.');
          }

          const browserResult = await WebBrowser.openBrowserAsync(checkoutUrl, {
            showTitle: true,
            toolbarColor: '#2563EB',
            controlsColor: '#ffffff',
            enableBarCollapsing: true,
          });

          if (browserResult.type === 'cancel') {
            Alert.alert(
              'Payment Link Sent',
              'We have initiated your GCash payment. You can complete it via the browser or the "Pay Now" button in your history.',
              [{ text: 'OK', onPress: () => onConfirmed?.() }]
            );
            return;
          }
        } catch (paymentErr) {
          Alert.alert(
            'Checkout Issue',
            `Could not start GCash session: ${paymentErr.message}\n\nYou can pay later via order history.`,
            [{ text: 'OK', onPress: () => onConfirmed?.() }]
          );
          return;
        }
      }

      onConfirmed && onConfirmed();
    } catch (e) {
      Alert.alert('Unable to Proceed', e?.message || 'Failed to confirm. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    if (!fullOrderData) return;
    const isPaid = String(fullOrderData.paymentStatus || '').toLowerCase() === 'paid';
    const message = isPaid
      ? 'Are you sure you want to reject the final price?\n\nFor paid orders, branch staff will review payment/refund handling.'
      : 'Are you sure you want to reject the final price? This will cancel your order.';
    Alert.alert(
      'Reject Final Price',
      message,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Reject & Cancel',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              await bookings.rejectFinalPrice(fullOrderData.trackingNumber);
              Alert.alert(
                'Price Rejected',
                'Final price rejected. Your order has been cancelled.',
                [{ text: 'OK', onPress: () => onRejected?.() }]
              );
            } catch (e) {
              Alert.alert('Error', e?.message || 'Failed to reject. Please try again.');
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  const handleCallBranch = () => {
    Linking.openURL('tel:09691737924').catch(() =>
      Alert.alert('Error', 'Cannot open dialer.')
    );
  };

  if (!fullOrderData) return null;

  const logo = String(fullOrderData.branchName || '').toLowerCase().includes('makati') ? logoLaundryHubs : logoSpeedyWash;

  // Recalculate breakdown using the same engine as Web
  const p = computeOrderPricing(
    fullOrderData,
    fullOrderData.actualWeightKg || 0,
    fullOrderData.loadKg > 7 ? 'PURE_CLOTHES' : 'WITH_TOWELS',
    fullOrderData.deliveryPrice || 0,
    fullOrderData.manualAdjustment || 0
  );

  const displayTrackingNumber = fullOrderData.trackingNumber 
    ? String(fullOrderData.trackingNumber).replace(/^WA-/, '')
    : String(fullOrderData.id || '');
  
  const weight = fullOrderData.actualWeightKg ? `${fullOrderData.actualWeightKg} kg` : null;
  const serviceName = fullOrderData.serviceName || fullOrderData.serviceType || 'Laundry Service';
  const paymentMethod = String(fullOrderData.paymentMethod || 'Cash on Delivery').replace('_', ' ');

  const dateStr = new Date().toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={S.overlay}>
        <Animated.View style={[S.card, { transform: [{ translateY: slideAnim }] }]}>
          <View style={S.headerControls}>
            <View style={S.notchBar} />
            <TouchableOpacity style={S.closeBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={32} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <View style={S.receiptTop} />

          <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header */}
            <View style={S.receiptHeader}>
              <View style={S.logoWrapper}>
                <Image source={logo} style={S.logoImg} resizeMode="contain" />
              </View>
              <Text style={S.brandName}>WashAlert</Text>
              <Text style={S.receiptSubtitle}>Official Receipt</Text>
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

            {/* Weight + loads info */}
            {fullOrderData.estimatedWeightKg ? (
              <View style={[S.weightBadge, {backgroundColor:'#F8FAFC', borderColor:'#E2E8F0'}]}>
                <Ionicons name="scale-outline" size={15} color="#64748B" />
                <Text style={[S.weightTxt, {color:'#475569'}]}>Est. weight: <Text style={{fontWeight:'900'}}>{fullOrderData.estimatedWeightKg} kg</Text></Text>
              </View>
            ) : null}
            {weight ? (
              <View style={S.weightBadge}>
                <Ionicons name="checkmark-circle-outline" size={15} color="#16A34A" />
                <Text style={S.weightTxt}>Actual weight: <Text style={{fontWeight:'900'}}>{weight}</Text></Text>
              </View>
            ) : null}
            {p && p.numberOfLoads > 0 ? (
              <View style={[S.weightBadge, {backgroundColor:'#EFF6FF', borderColor:'#BFDBFE'}]}>
                <Ionicons name="layers-outline" size={15} color="#2563EB" />
                <Text style={[S.weightTxt, {color:'#1D4ED8'}]}>No. of loads: <Text style={{fontWeight:'900'}}>{p.numberOfLoads}</Text></Text>
              </View>
            ) : null}
            {fullOrderData.loadSize ? (
              <View style={[S.weightBadge, {backgroundColor:'#F5F3FF', borderColor:'#DDD6FE'}]}>
                <Ionicons name="shirt-outline" size={15} color="#7C3AED" />
                <Text style={[S.weightTxt, {color:'#6D28D9'}]}>
                  Load classification: <Text style={{fontWeight:'900'}}>
                    {String(fullOrderData.loadSize).charAt(0).toUpperCase() + String(fullOrderData.loadSize).slice(1).toLowerCase()}
                  </Text>
                </Text>
              </View>
            ) : null}

            <View style={S.dashedSep} />

            {/* DETAILED LINE ITEMS */}
            <ReceiptRow label={serviceName} value={fmt(p.serviceTotal)} bold />
            
            {p.madnessFee > 0 && (
              <ReceiptRow label="Madness Surcharge" value={fmt(p.madnessFee)} accent />
            )}

            {p.detCost > 0 && (
              <ReceiptRow
                label={`${fullOrderData.detergent || 'Detergent'} ×${p.detQty} pack${p.detQty !== 1 ? 's' : ''} (₱${p.detPPP}/pk)`}
                value={fmt(p.detCost)}
              />
            )}
            {p.conCost > 0 && (
              <ReceiptRow
                label={`${fullOrderData.conditioner || 'Conditioner'} ×${p.conQty} pack${p.conQty !== 1 ? 's' : ''} (₱${p.conPPP}/pk)`}
                value={fmt(p.conCost)}
              />
            )}

            {Number(p.deliveryFee) > 0 && (
              <ReceiptRow label="Logistics & Delivery" value={fmt(p.deliveryFee)} />
            )}
            
            <ReceiptRow label="Convenience Fee" value={fmt(p.convenienceFee)} />

            {p.manualAdjustment !== 0 && (
              <ReceiptRow 
                label="Staff Adjustment" 
                value={fmt(p.manualAdjustment)} 
                accent={p.manualAdjustment > 0} 
              />
            )}

            {/* Total box */}
            <View style={S.totalBox}>
              <View>
                <Text style={S.totalLabel}>TOTAL AMOUNT DUE</Text>
                <Text style={S.totalAmount}>{fmt(p.grandTotal)}</Text>
              </View>
              <View style={S.payBox}>
                <Text style={S.payLabel}>PAYMENT</Text>
                <Text style={S.payMethod}>{paymentMethod}</Text>
                {fullOrderData.paymentStatus ? (
                  <Text style={S.payStatus}>{String(fullOrderData.paymentStatus)}</Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity style={[S.confirmBtn, (loading || rejecting) && { opacity: 0.6 }]} onPress={handleConfirm} disabled={loading || rejecting} activeOpacity={0.88}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.confirmBtnTxt}>
                    {String(fullOrderData.paymentMethod || '').toUpperCase().includes('GCASH')
                      ? 'Confirm & Pay with GCash'
                      : 'Confirm & start washing'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={[S.rejectBtn, (loading || rejecting) && { opacity: 0.5 }]} onPress={handleReject} disabled={loading || rejecting} activeOpacity={0.88}>
              {rejecting
                ? <ActivityIndicator color="#EF4444" />
                : <Text style={S.rejectBtnTxt}>Reject Final Price</Text>
              }
            </TouchableOpacity>

            <Text style={S.systemGenNote}>This receipt is system-generated.</Text>

            <Text style={S.legalTxt}>
              By confirming, you agree to the total above. Washing begins only pagkatapos ng iyong confirmation.
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
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.88)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%', elevation: 24 },
  headerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, position: 'relative' },
  closeBtn: { position: 'absolute', right: 16, top: 12 },
  notchBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },
  receiptTop: { height: 4, backgroundColor: '#1E293B', marginBottom: 0 },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  receiptHeader: { alignItems: 'center', marginBottom: 16 },
  logoWrapper: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  logoImg: { width: 40, height: 40 },
  brandName: { fontSize: 20, fontWeight: '900', color: '#1E293B', letterSpacing: -0.3 },
  receiptSubtitle: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 1 },
  branchName: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  trackingBox: { alignItems: 'center', marginBottom: 16 },
  trackingLabel: { fontSize: 28, fontWeight: '900', color: '#2563EB', letterSpacing: -1.5 },
  dateLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  custName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  custPhone: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  serviceChip: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  serviceChipTxt: { fontSize: 10, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase' },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCFCE7', marginBottom: 14 },
  weightTxt: { fontSize: 13, color: '#15803D', fontWeight: '600' },
  dashedSep: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14, height: 0 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  receiptRowLabel: { fontSize: 13, color: '#64748B', fontWeight: '500', flex: 1, paddingRight: 8 },
  receiptRowValue: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  totalBox: { backgroundColor: '#1E293B', borderRadius: 18, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 20 },
  totalLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5 },
  totalAmount: { fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 2 },
  payBox: { alignItems: 'flex-end' },
  payLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5 },
  payMethod: { fontSize: 12, fontWeight: '800', color: '#FBBF24', marginTop: 2 },
  payStatus: { fontSize: 9, color: '#94A3B8', marginTop: 1 },
  systemGenNote: { fontSize: 10, color: '#CBD5E1', textAlign: 'center', fontStyle: 'italic', marginTop: 8, marginBottom: 4 },
  confirmBtn: { backgroundColor: '#2563EB', borderRadius: 16, height: 58, alignItems: 'center', justifyContent: 'center' },
  confirmBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  rejectBtn: { borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  rejectBtnTxt: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  legalTxt: { fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 16, marginTop: 14, paddingHorizontal: 8 },
  contactLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', marginTop: 12, paddingVertical: 6 },
  contactLinkTxt: { fontSize: 13, fontWeight: '700', color: '#2563EB', textDecorationLine: 'underline' },
});
