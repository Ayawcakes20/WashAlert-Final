import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookings } from '../../services/api';
import { computeOrderPricing } from '../../utils/pricingUtils';
import logoLaundryHubs from '../../../assets/images/logo-laundryhubs.webp';
import logoSpeedyWash from '../../../assets/images/logo-speedywash.webp';

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

// Full-screen receipt.
//
// This was previously a bottom-sheet Modal (PriceConfirmationModal) whose card sized itself
// with `maxHeight` only, never a real height, while its ScrollView used `flex: 1`. Per React
// Native's docs, `flex: 1` implicitly sets `flexBasis: 0`, and "a component can only expand to
// fill available space if its parent has dimensions greater than 0" — a maxHeight is a cap, not
// a dimension, so the ScrollView had no free space to grow into and collapsed to zero height.
// The card then rendered as a ~45px sliver of header at the bottom of the screen with no way to
// pull it up, which is exactly what device recordings showed. A screen gets a real, definite
// height from the navigator, so `flex: 1` resolves normally and this whole class of bug is gone.
export default function ReceiptScreen({ navigation, route }) {
  const orderData = route?.params?.orderData ?? null;
  const [loading, setLoading] = useState(false);
  const [fullOrderData, setFullOrderData] = useState(orderData);

  // Sync internal state with param
  useEffect(() => {
    if (orderData) setFullOrderData(orderData);
  }, [orderData]);

  // Fetch full details if only ID is provided
  useEffect(() => {
    if (orderData && (!orderData.amount || !orderData.serviceName)) {
      (async () => {
        try {
          const id = orderData.id || orderData.dbId;
          if (id) {
            const full = await bookings.getById(id);
            if (full) setFullOrderData(full);
          }
        } catch (e) {
          console.warn('[Receipt] Failed to fetch full details:', e);
        }
      })();
    }
  }, [orderData]);

  // Returns to Order Details, flagging what happened so that screen can refresh and, for an
  // unpaid GCash order, continue into the payment step (it previously did this from the
  // modal's onConfirmed/onRejected callbacks).
  //
  // navigate(name, params) — not the deprecated navigate({name, params, merge}) object form —
  // is what actually merges params into an existing screen already in the stack (OrderDetail,
  // since Receipt was pushed from it) while leaving its other params, like orderId, untouched.
  // The object form logged a "Passing an object... is deprecated" warning and, worse, replaced
  // OrderDetail's whole params object instead of merging into it: orderId was lost, order
  // stayed null after the refetch, and OrderDetailScreen fell into its own "Order not found"
  // fallback — confirmed by a captured logcat (the deprecation warning) alongside a screen
  // recording showing exactly that error after confirming a receipt.
  const closeWith = (outcome) => {
    navigation.navigate('OrderDetail', { receiptOutcome: outcome, receiptOutcomeAt: Date.now() });
  };

  const onConfirmed = () => closeWith('confirmed');
  const onDismiss = () => navigation.goBack();
  const onRejected = () => closeWith('rejected');

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
    return (
      <SafeAreaView style={S.screen} edges={['top', 'left', 'right']}>
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={S.loadingTxt}>Loading your receipt...</Text>
        </View>
      </SafeAreaView>
    );
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
    <SafeAreaView style={S.screen} edges={['top', 'left', 'right']}>
      <View style={S.card}>
          <View style={S.headerControls}>
            <TouchableOpacity style={S.backBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={S.headerTitle}>Receipt</Text>
            <View style={S.headerSpacer} />
          </View>

          <View style={S.receiptDivider} />

          <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>
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
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  // Every level here has a real, definite height: SafeAreaView flex:1 fills the screen the
  // navigator gives it, `card` flex:1 fills that, and the ScrollView's flex:1 finally has
  // actual free space to grow into. That chain is what the old bottom-sheet modal lacked —
  // its card had only a maxHeight cap, so nothing below the header ever got any height.
  screen: { flex: 1, backgroundColor: '#fff' },
  card: { flex: 1, backgroundColor: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  headerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  headerSpacer: { width: 40 },
  receiptDivider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 0 },
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
