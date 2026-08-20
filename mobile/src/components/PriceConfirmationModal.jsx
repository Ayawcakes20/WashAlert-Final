import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, Alert, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { bookings, payments } from '../services/api';
import { computeOrderPricing } from '../utils/pricingUtils';
import logoLaundryHubs from '../../assets/images/logo-laundryhubs.webp';
import logoSpeedyWash from '../../assets/images/logo-speedywash.webp';

const fmt = (n) => `\u20b1${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReceiptRow = ({ label, value, bold, accent, sub }) => (
  <View style={S.receiptRow}>
    <View style={S.receiptRowLeft}>
      <Text style={[S.receiptRowLabel, bold && { fontWeight: '700', color: '#1E293B' }]}>{label}</Text>
      {sub ? <Text style={S.receiptRowSub}>{sub}</Text> : null}
    </View>
    <Text style={[S.receiptRowValue, accent && { color: '#2563EB', fontSize: 15, fontWeight: '900' }]}>{value}</Text>
  </View>
);

export default function PriceConfirmationModal({ visible, orderData, onConfirmed, onDismiss, onRejected }) {
  const [loading, setLoading] = useState(false);
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

  // Reset for next open. The slide-IN animation itself is triggered from the Modal's onShow
  // callback below (not from this visible-prop effect) — see the Modal JSX for why.
  useEffect(() => {
    if (!visible) {
      slideAnim.setValue(400);
    }
  }, [visible]);

  // Starts the slide-up once the native modal has actually finished mounting/showing, per
  // React Native's own documented pattern (reactnative.dev/docs/modal#onshow) for animations
  // tied to a manually-controlled Modal. A `useEffect(() => {...}, [visible])` fires as soon as
  // React re-renders, which can race ahead of the native Android Dialog window actually being
  // attached and laid out — especially with animationType="none", where there's no native
  // transition to implicitly wait for. That race left the card animated to a view that wasn't
  // attached yet: the dark overlay rendered, but the receipt content never appeared, confirmed
  // by screen recordings showing 10+ seconds of a dim, empty backdrop. useNativeDriver: false
  // also avoids a separate, documented native-driver conflict inside custom-controlled Modals
  // (facebook/react-native#21552, react-native-modal/react-native-modal#730).
  const handleModalShow = () => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
  };

  const handleConfirm = async () => {
    if (!fullOrderData) return;
    setLoading(true);
    try {
      const paymentMethodStr = String(fullOrderData.paymentMethod || '').toUpperCase();
      const isGcash = paymentMethodStr.includes('GCASH');
      const isPaid = ['paid', 'verified'].includes(String(fullOrderData.paymentStatus || '').toLowerCase());

      // 1. Confirm the price first (if not already confirmed/washing on backend)
      const currentStatus = String(fullOrderData.status || '').toUpperCase();
      const isAlreadyConfirmedOrPast = [
        // Mapped mobile values
        'PRICE_APPROVED', 'WASHING', 'DRYING', 'READY', 'DELIVERING', 'DELIVERED', 'COMPLETED',
        // Raw backend values
        'PRICE_CONFIRMED', 'WASHING', 'DRYING', 'READY', 'ASSIGNED_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'
      ].includes(currentStatus);

      let confirmedOrder = fullOrderData;
      if (!isAlreadyConfirmedOrPast) {
        try {
          confirmedOrder = await bookings.confirmPrice(fullOrderData);
        } catch (confirmErr) {
          // Handle Forbidden (CSRF or Role issue)
          if (confirmErr.message?.includes('Forbidden') || confirmErr.message?.includes('Unauthorized')) {
            Alert.alert(
              'Action Restricted',
              'You do not have permission to confirm this price. Please try logging in again.',
              [{ text: 'OK' }]
            );
            return;
          }

          throw new Error(`Price confirmation failed: ${confirmErr.message}`);
        }
      }

      // Manual GCash QR code check will be handled by the parent screen on confirmation

      onConfirmed && onConfirmed();
    } catch (e) {
      Alert.alert('Unable to Proceed', e?.message || 'Failed to confirm. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!fullOrderData) {
    return null;
  }

  const logo = String(fullOrderData.branchName || '').toLowerCase().includes('makati') ? logoLaundryHubs : logoSpeedyWash;

  // mapJobOrderToMobile uses detergentQty/conditionerQty; pricingUtils expects
  // detergentQuantity/conditionerQuantity — bridge the mismatch here.
  const p = computeOrderPricing(
    {
      ...fullOrderData,
      detergentQuantity: fullOrderData.detergentQty ?? fullOrderData.detergentQuantity ?? 0,
      conditionerQuantity: fullOrderData.conditionerQty ?? fullOrderData.conditionerQuantity ?? 0,
    },
    fullOrderData.actualWeightKg || 0,
    fullOrderData.loadKg > 7 ? 'PURE_CLOTHES' : 'WITH_TOWELS',
    fullOrderData.deliveryPrice || 0,
    fullOrderData.manualAdjustment || 0
  );

  // Prefer backend-confirmed total (set by staff) to guard against load-type heuristic mismatch.
  // GCash checkout uses the same totalPrice/finalPrice from the backend.
  const backendTotal = Number(fullOrderData.finalPrice || fullOrderData.amount || 0);
  const confirmedTotal = backendTotal > 0 ? backendTotal : p.grandTotal;

  const displayTrackingNumber = fullOrderData.trackingNumber
    ? String(fullOrderData.trackingNumber).replace(/^WA-/, '')
    : String(fullOrderData.id || '');

  const weight = fullOrderData.actualWeightKg ? `${fullOrderData.actualWeightKg} kg` : null;
  const serviceName = fullOrderData.serviceName || fullOrderData.serviceType || 'Laundry Service';
  const paymentMethod = String(fullOrderData.paymentMethod || 'Cash on Delivery').replace('_', ' ');

  // Service breakdown sub-text: formula shown below the service name
  const isHandwash = String(serviceName).toLowerCase().includes('handwash');
  const serviceSubText = p && p.pricePerLoad > 0
    ? (isHandwash
        ? `₱${p.pricePerLoad}/kg × ${fullOrderData.actualWeightKg} kg`
        : `₱${p.pricePerLoad}/load × ${p.numberOfLoads} load${p.numberOfLoads !== 1 ? 's' : ''}`)
    : null;

  const dateStr = new Date().toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    // onRequestClose fires on Android hardware back-press/back-gesture and, per RN's Modal
    // implementation, always wins over any BackHandler listener even one registered inside
    // this same component (facebook/react-native#19147) — so it can't be blocked that way.
    // Left as a no-op instead of wiring it to onDismiss: an accidental edge-swipe while
    // scrolling the receipt must not silently close it before the customer can confirm the
    // price. The X button remains the only way to dismiss.
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
      onShow={handleModalShow}
    >
      <View style={S.overlay}>
        <Animated.View style={[S.card, { transform: [{ translateY: slideAnim }] }]}>
          <View style={S.headerControls}>
            <View style={S.notchBar} />
            <TouchableOpacity style={S.closeBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={32} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <View style={S.receiptDivider} />

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

            {/* CHARGES */}
            <Text style={S.chargesSectionLabel}>CHARGES</Text>

            {/* Service fee */}
            <ReceiptRow label={serviceName} value={fmt(p.serviceTotal)} bold sub={serviceSubText} />

            {/* Madness surcharge (excess weight) */}
            {p.madnessFee > 0 && (
              <ReceiptRow
                label="Madness Surcharge"
                value={fmt(p.madnessFee)}
                accent
                sub={`${p.madnessKg != null ? Number(p.madnessKg).toFixed(1) : '?'} kg over capacity × ₱50`}
              />
            )}

            {/* Rush fee */}
            {p.rushFee > 0 && (
              <ReceiptRow
                label="Rush Service Fee"
                value={fmt(p.rushFee)}
                accent
                sub={`₱150/load × ${p.numberOfLoads} load${p.numberOfLoads !== 1 ? 's' : ''}`}
              />
            )}

            {/* Detergent */}
            {p.detCost > 0 && (
              <ReceiptRow
                label={fullOrderData.detergent || 'Detergent'}
                value={fmt(p.detCost)}
                sub={`₱${p.detPPP}/sachet × ${p.detQty} sachet${p.detQty !== 1 ? 's' : ''}`}
              />
            )}

            {/* Fabric conditioner */}
            {p.conCost > 0 && (
              <ReceiptRow
                label={fullOrderData.conditioner || 'Fabric Conditioner'}
                value={fmt(p.conCost)}
                sub={`₱${p.conPPP}/sachet × ${p.conQty} sachet${p.conQty !== 1 ? 's' : ''}`}
              />
            )}

            {/* Delivery */}
            {Number(p.deliveryFee) > 0 && (
              <ReceiptRow label="Logistics & Delivery" value={fmt(p.deliveryFee)} sub="Location-based rate" />
            )}

            {/* Convenience fee */}
            <ReceiptRow label="Convenience Fee" value={fmt(p.convenienceFee)} sub="Online booking fee" />

            {/* Staff adjustment (if any survived into the backend total) */}
            {p.manualAdjustment !== 0 && (
              <ReceiptRow
                label="Staff Adjustment"
                value={fmt(p.manualAdjustment)}
                accent={p.manualAdjustment > 0}
              />
            )}

            {/* Total box — uses backend-confirmed value so it matches GCash checkout */}
            <View style={S.totalBox}>
              <View>
                <Text style={S.totalLabel}>TOTAL AMOUNT DUE</Text>
                <Text style={S.totalAmount}>{fmt(confirmedTotal)}</Text>
              </View>
              <View style={S.payBox}>
                <Text style={S.payLabel}>PAYMENT</Text>
                <Text style={S.payMethod}>{paymentMethod}</Text>
                {fullOrderData.paymentStatus ? (
                  <Text style={S.payStatus}>{String(fullOrderData.paymentStatus)}</Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity style={[S.confirmBtn, loading && { opacity: 0.6 }]} onPress={handleConfirm} disabled={loading} activeOpacity={0.88}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.confirmBtnTxt}>
                    {(() => {
                      const isGcash = String(fullOrderData.paymentMethod || '').toUpperCase().includes('GCASH');
                      const isPaid = ['paid', 'verified'].includes(String(fullOrderData.paymentStatus || '').toLowerCase());
                      if (isGcash && !isPaid) return 'Confirm & Pay with GCash';
                      return 'Confirm & start washing';
                    })()}
                  </Text>
              }
            </TouchableOpacity>

            <Text style={S.systemGenNote}>This receipt is system-generated.</Text>

            <Text style={S.legalTxt}>
              By confirming, you agree to the total above. Washing begins only pagkatapos ng iyong confirmation.
            </Text>

            <Text style={S.contactSupportTxt}>Question about the price? Contact the branch through support.</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.88)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%', elevation: 24, overflow: 'hidden' },
  headerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, position: 'relative' },
  closeBtn: { position: 'absolute', right: 16, top: 12 },
  notchBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },
  receiptDivider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 0 },
  // flex: 1 (not flexGrow: 0) bounds the ScrollView to the remaining space inside
  // card's capped maxHeight, so content past the fold scrolls into view instead of
  // rendering past the bottom of the screen (this hid the "Confirm & Pay" button).
  scroll: { flex: 1 },
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
  dashedSep: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8, height: 0 },
  chargesSectionLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' },
  receiptRowLeft: { flex: 1, paddingRight: 10 },
  receiptRowLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  receiptRowSub: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontVariant: ['tabular-nums'] },
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
  legalTxt: { fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 16, marginTop: 14, paddingHorizontal: 8 },
  contactSupportTxt: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
});
