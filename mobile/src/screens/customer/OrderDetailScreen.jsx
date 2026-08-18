import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Image, Dimensions, TextInput, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { bookings as bookingsApi, branches as branchesApi, payments } from '../../services/api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useFocusEffect } from '@react-navigation/native';
import PriceConfirmationModal from '../../components/PriceConfirmationModal';
import GcashQrModal from '../../components/GcashQrModal';

const { width: SW } = Dimensions.get('window');

// Returns the best available final total: staff-confirmed finalPrice wins over estimated amount.
const resolveTotal = (order) => order?.finalPrice ?? order?.amount ?? 0;

const STEPS = [
  { key: 'pending',        label: 'Booking Placed',                  icon: 'checkmark-circle-outline' },
  { key: 'pickup',         label: 'Rider Pickup',                    icon: 'bicycle-outline' },
  { key: 'received',       label: 'Order Received',                  icon: 'cube-outline' },
  { key: 'awaiting_price', label: 'Weighing & Price Confirmation',   icon: 'scale-outline' },
  { key: 'washing',        label: 'Washing in Progress',             icon: 'water-outline' },
  { key: 'drying',         label: 'Drying',                         icon: 'thermometer-outline' },
  { key: 'ready',          label: 'Ready for Pickup / Delivery',     icon: 'bag-check-outline' },
  { key: 'delivering',     label: 'Out for Delivery',                icon: 'navigate-outline' },
  { key: 'delivered',      label: 'Delivered Successfully',          icon: 'checkmark-done-circle-outline' },
];

// Step-label overrides applied for pickup-at-branch (DROP_OFF) orders, which have no
// delivery leg — the customer collects their laundry in person instead of it being
// delivered to them.
const PICKUP_STEP_LABELS = {
  ready: 'Ready for Pickup at Branch',
  delivered: 'Picked Up',
};

const STATUS_BADGE = {
  pending:        { bg: '#EFF6FF', text: '#3B82F6', label: 'Order Pending' },
  pickup:         { bg: '#EFF6FF', text: '#2563EB', label: 'Rider Assigned for Pickup' },
  received:       { bg: '#F0FDF4', text: '#10B981', label: 'Received' },
  awaiting_price: { bg: '#FFF7ED', text: '#EA580C', label: 'Awaiting Confirmation' },
  washing:        { bg: '#EFF6FF', text: '#2563EB', label: 'Washing' },
  drying:         { bg: '#F5F3FF', text: '#7C3AED', label: 'Drying' },
  ready:          { bg: '#F0FDF4', text: '#22C55E', label: 'Ready' },
  delivering:     { bg: '#F0FDF4', text: '#22C55E', label: 'Out for Delivery' },
  delivered:      { bg: '#F0FDF4', text: '#10B981', label: 'Delivered' },
  cancelled:      { bg: '#FEF2F2', text: '#EF4444', label: 'Cancelled' },
};

// Maps a raw order/delivery status to a timeline step key. Pickup-leg statuses
// (rider collecting from the customer) map to 'pickup', NOT 'delivering', so an
// order being picked up never shows "Out for Delivery".
const normalize = (s) => {
  const raw = String(s||'').trim().toLowerCase().replace(/ /g,'_');
  const map = {
    pending:'pending',
    // Pickup leg — rider on the way to collect laundry from the customer
    assigned_for_pickup:'pickup', en_route_to_customer:'pickup',
    en_route_to_pickup:'pickup', pending_pickup:'pickup',
    picked_up:'pickup', laundry_collected:'pickup', en_route_to_branch:'pickup',
    // Laundry at branch
    received:'received', order_received:'received',
    // Pricing
    awaiting_price:'awaiting_price', awaiting_price_confirmation:'awaiting_price',
    price_confirmed:'awaiting_price', price_approved:'washing',
    // Processing
    washing:'washing', in_transit:'washing', drying:'drying', ready:'ready',
    // Delivery leg — only 'delivering' once the leg is actually active
    assigned_for_delivery:'ready', picked_up_from_branch:'delivering',
    out_for_delivery:'delivering', delivering:'delivering',
    // Terminal
    collection_failed:'cancelled',
    delivered:'delivered', cancelled:'cancelled', failed:'cancelled',
  };
  return map[raw] || 'pending';
};

// Precise, customer-friendly badge label for sub-states that share a timeline step.
const rawStatusLabel = (s) => {
  const raw = String(s||'').trim().toLowerCase().replace(/ /g,'_');
  const labels = {
    assigned_for_pickup: 'Rider Assigned for Pickup',
    en_route_to_pickup: 'Rider on the Way for Pickup',
    en_route_to_customer: 'Rider on the Way for Pickup',
    pending_pickup: 'Awaiting Pickup',
    picked_up: 'Laundry Collected',
    laundry_collected: 'Laundry Collected',
    en_route_to_branch: 'Heading to Branch',
    assigned_for_delivery: 'Ready — Rider Assigned',
    picked_up_from_branch: 'Out for Delivery',
    out_for_delivery: 'Out for Delivery',
  };
  return labels[raw] || null;
};

// Returns true when payment is fully settled — covers all backend status aliases.
const isPaymentSettled = (o) => {
  if (!o) return false;
  if (o.isPaid === true || o.paid === true) return true;
  const s = String(o.paymentStatus || '').trim().toLowerCase().replace(/[\s_-]+/g, '_');
  return ['paid', 'verified', 'payment_confirmed', 'confirmed', 'success', 'succeeded'].includes(s);
};

// Active step pulse ring
const PulseRing = ({ color }) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[
      { position:'absolute', width:28, height:28, borderRadius:14, borderWidth:2, borderColor:color, opacity:0.4 },
      { transform:[{ scale:anim }] }
    ]} />
  );
};

// Simple percentage ring using nested Views (no SVG dependency)
const Ring = ({ pct, status }) => {
  const sb = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return (
    <View style={ringStyles.wrap}>
      <View style={[ringStyles.outer, { borderColor: sb.text + '22' }]}>
        <View style={[ringStyles.inner, { borderColor: sb.text }]}>
          <Text style={[ringStyles.pct, { color: sb.text }]}>{pct}%</Text>
          <Text style={ringStyles.label}>done</Text>
        </View>
      </View>
    </View>
  );
};
const ringStyles = StyleSheet.create({
  wrap:  { alignItems: 'center', justifyContent: 'center' },
  outer: { width: 90, height: 90, borderRadius: 45, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pct:   { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 9, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
});

// Collapsible section
const Accordion = ({ title, icon, children, defaultOpen=false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.accordionHeader} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <View style={styles.accordionLeft}>
          <Ionicons name={icon} size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      {open && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
};

const Row = ({ label, value, valueStyle }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoKey}>{label}</Text>
    <Text style={[styles.infoVal, valueStyle]}>{value}</Text>
  </View>
);

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [branchPhones, setBP]   = useState({});
  const [showFullTL, setShowTL] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showGcashQrModal, setShowGcashQrModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [feedbackRating, setFeedbackRating]     = useState(0);
  const [feedbackComment, setFeedbackComment]   = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone]         = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:0.3, duration:800, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:1,   duration:800, useNativeDriver:true }),
    ]));
    p.start(); return () => p.stop();
  }, []);

  useEffect(() => { load(); }, [orderId]);

  useEffect(() => {
    (async () => {
      try {
        const all = await branchesApi.getAll();
        const m = (all?.branches||[]).reduce((a,b) => {
          const k = String(b?.name||'').trim().toLowerCase();
          if (k && b?.phone) a[k] = String(b.phone); return a;
        }, {});
        setBP(m);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!order?.id) return;
    const tn = order.trackingNumber || order.id;
    if (!tn || String(tn).toLowerCase() === 'undefined') return;
    if (!db) return;
    try {
      const unsub = onSnapshot(doc(db, 'orders', String(tn)), snap => {
        if (snap.exists()) {
          const data = snap.data();
          const raw = (data.status || '').toLowerCase();
          const mapped = normalize(raw);
          setOrder(prev => {
            if (!prev) return prev;
            const updates = {};
            // Store the raw status so the precise badge label (e.g. "Rider on the
            // Way for Pickup") is preserved; only update when the phase changes.
            if (mapped && mapped !== normalize(prev.status)) updates.status = raw;
            // Sync isPaid from Firestore so Pay Now button hides immediately
            // after the webhook fires without needing a full reload.
            // The synced doc stores the boolean under "paid" (Jackson strips the "is"
            // prefix from isPaid()), so check both keys plus the payment status.
            const firestoreIsPaid = data.isPaid === true || data.paid === true || data.paymentStatus === 'PAID' || data.paymentStatus === 'VERIFIED';
            if (firestoreIsPaid && !prev.isPaid) {
              updates.isPaid = true;
              updates.paymentStatus = 'Paid';
            }
            return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
          });
        }
      }, err => console.warn('[OrderDetail] Firestore listener failed:', err?.message || err));
      return () => unsub();
    } catch (error) {
      console.warn('[OrderDetail] Firestore subscription skipped:', error?.message || error);
      return undefined;
    }
  }, [order?.id, order?.trackingNumber]);

  // Re-fetch the order whenever the screen regains focus (e.g., returning from
  // the GCash browser). This ensures payment status is fresh from the backend.
  useFocusEffect(
    React.useCallback(() => {
      if (orderId) load();
    }, [orderId])
  );

  const load = async () => {
    try {
      setLoading(true);
      const d = await bookingsApi.getById(orderId);
      setOrder(d);
      const statusNorm = normalize(d?.status || '');
      if (statusNorm === 'delivered' || statusNorm === 'ready') {
        const tn = d?.trackingNumber || d?.orderId;
        if (tn) {
          try {
            const fb = await bookingsApi.getMyFeedback(tn);
            if (fb?.customerRating) {
              setExistingFeedback(fb);
              setFeedbackRating(fb.customerRating);
              setFeedbackComment(fb.customerComment || '');
              setFeedbackDone(true);
            }
          } catch {}
        }
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const submitFeedback = async () => {
    if (feedbackRating < 1) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }
    const tn = order?.trackingNumber || order?.orderId;
    if (!tn) return;
    setFeedbackSubmitting(true);
    try {
      await bookingsApi.submitFeedback(tn, feedbackRating, feedbackComment.trim());
      setFeedbackDone(true);
      Alert.alert('Thank You!', 'Your feedback has been submitted.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={colors.primary}/></View>
  );
  if (!order) return (
    <View style={styles.center}>
      <Text style={{color:colors.textSecondary}}>Order not found</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop:12}}>
        <Text style={{color:colors.primary, fontWeight:'600'}}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const ns  = normalize(order.status);
  const sb  = STATUS_BADGE[ns] || STATUS_BADGE.pending;

  // DROP_OFF orders have no rider pickup leg and no delivery leg — skip both steps.
  // Checked against the raw backend enum (serviceTypeRaw), not the human-readable
  // serviceType label, which never equals 'DROP_OFF'/'PICK_UP'.
  const isPickupOrder = !order.delivery && order.serviceTypeRaw === 'DROP_OFF';
  const stepsForOrder = isPickupOrder
    ? STEPS
        .filter(s => s.key !== 'delivering' && s.key !== 'pickup')
        .map(s => PICKUP_STEP_LABELS[s.key] ? { ...s, label: PICKUP_STEP_LABELS[s.key] } : s)
    : STEPS;

  // Precise label for sub-states (pickup/delivery legs), falling back to the step label.
  // For pickup orders, the terminal state reads "Picked Up" instead of "Delivered".
  const badgeLabel = (isPickupOrder && ns === 'delivered')
    ? 'Picked Up'
    : rawStatusLabel(order.status) || sb.label;

  const idx = stepsForOrder.findIndex(s => s.key === ns);
  const pct = Math.max(5, Math.round(((idx>=0?idx+1:1)/stepsForOrder.length)*100));

  const branchKey = String(order?.branchName||order?.branch||'').trim().toLowerCase();
  const branchPhone = branchPhones[branchKey] || '';

  // Normalize PH numbers: keep digits/+, convert leading 0 → +63.
  const dial = v => {
    let raw = String(v||'').replace(/[^0-9+]/g,'');
    if (raw.startsWith('0')) raw = '+63' + raw.slice(1);
    else if (raw && !raw.startsWith('+')) raw = '+63' + raw;
    return raw;
  };

  // Robust fallback chain for assigned driver phone:
  // delivery.driverPhone (from DeliveryResponse, prefers mobileNumber) →
  // order.assignedDriverPhone (from JobOrderResponse) → null
  const resolvedDriverPhone = (
    order?.delivery?.driverPhone ||
    order?.assignedDriverPhone ||
    null
  );

  // NOTE: do NOT gate tel:/sms: on Linking.canOpenURL — on Android canOpenURL('tel:')
  // returns false unless CALL_PHONE is in the manifest, which blocked the dialer.
  const call = async phone => {
    const p = dial(phone);
    if (!p) return Alert.alert('Phone number is not available yet.', 'No contact number is on record for this order.');
    try {
      await Linking.openURL(`tel:${p}`);
    } catch {
      Alert.alert('Open Dialer Manually', `Could not open the dialer automatically.\nPlease call: ${p}`);
    }
  };
  const sms = async phone => {
    const p = dial(phone);
    if (!p) return Alert.alert('Phone number is not available yet.', 'No contact number is on record for this order.');
    try {
      await Linking.openURL(`sms:${p}`);
    } catch {
      Alert.alert('Unable to open messaging app.', 'Please try again later.');
    }
  };

  // Driver contact is relevant during both the pickup and delivery legs.
  const driverVisible = ns === 'delivering' || ns === 'pickup';
  // Footer Call/Message target the assigned driver when there is one, otherwise the branch.
  const footerContactPhone = resolvedDriverPhone || branchPhone;
  const footerContactLabel = resolvedDriverPhone ? 'Driver' : 'Branch';

  // 3-point condensed timeline
  const prevStep = idx > 0 ? STEPS[idx-1] : null;
  const currStep = STEPS[idx>=0?idx:0];
  const nextStep = idx < STEPS.length-1 ? STEPS[idx+1] : null;

  const timeline = (order.timeline && order.timeline.length
    ? order.timeline
    : STEPS.map((s,i) => ({step:s.label, time: i===0?order.date:'', done:i<=idx})));

  const payNow = async () => {
    try {
      setPaying(true);
      const tracking = order?.trackingNumber || String(order?.id || '');
      const result = await payments.initiateGcashCheckout(tracking || order);
      const checkoutUrl = result?.checkoutUrl;
      if (checkoutUrl) {
        await WebBrowser.openBrowserAsync(checkoutUrl);
        navigation.navigate('PaymentSuccess', {
          trackingNumber: tracking,
          amount: resolveTotal(order),
        });
        return;
      }
    } catch (err) {
      console.warn('[OrderDetailScreen] PayMongo live checkout failed:', err);
      Alert.alert(
        'PayMongo Online Checkout',
        err.message || 'Unable to open live PayMongo checkout page. Falling back to manual receipt upload.'
      );
    } finally {
      setPaying(false);
    }
    setShowGcashQrModal(true);
  };

  const cancelOrder = () => {
    Alert.alert('Cancel Order','Are you sure you want to cancel this booking?',[
      {text:'No', style:'cancel'},
      {text:'Yes, Cancel', style:'destructive', onPress: async () => {
        try {
          await bookingsApi.cancel(order.trackingNumber || String(order.id));
          Alert.alert('Cancelled','Your booking has been cancelled.');
          navigation.goBack();
        } catch(e) {
          const msg = e?.message || 'Failed to cancel.';
          const friendly = msg.includes('Forbidden') || msg.includes('403')
            ? 'You can only cancel your own orders. If the order is already being processed, it can no longer be cancelled.'
            : msg.includes('no longer') || msg.includes('cannot') || msg.includes('only')
            ? msg
            : 'Unable to cancel this order. It may already be in progress.';
          Alert.alert('Cannot Cancel', friendly);
        }
      }}
    ]);
  };

  const handleShareReceipt = async () => {
    try {
      const tracking = order.trackingNumber ? `WA-${String(order.trackingNumber).replace(/^WA-/, '')}` : `#${order.id}`;
      const branch = order.branchName || order.branch || 'WashAlert Branch';
      const customer = order.customerName || 'Customer';
      const date = order.dateBooked
        ? new Date(order.dateBooked).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      const service = order.serviceName || order.serviceType || 'Laundry Service';
      const fmt = (n) => `PHP ${Number(n || 0).toFixed(2)}`;

      const lines = [
        '━━━━━━━━━━━━━━━━━━━━━━━',
        '       WashAlert Receipt',
        '━━━━━━━━━━━━━━━━━━━━━━━',
        `Branch:   ${branch}`,
        `Order:    ${tracking}`,
        `Date:     ${date}`,
        '─────────────────────────',
        `Customer: ${customer}`,
        order.customerPhone ? `Phone:    ${order.customerPhone}` : null,
        `Service:  ${service}`,
        order.serviceTypeRaw === 'PICKUP_DELIVERY' ? 'Type:     Pickup & Delivery' : 'Type:     Drop-Off',
        order.loadSize ? `Load:     ${String(order.loadSize).charAt(0) + String(order.loadSize).slice(1).toLowerCase()}` : null,
        order.laundryType ? `Laundry:  ${order.laundryType}` : null,
        order.estimatedWeightKg ? `Est. Wt:  ${order.estimatedWeightKg} kg` : null,
        order.actualWeightKg ? `Act. Wt:  ${order.actualWeightKg} kg` : null,
        '─────────────────────────',
        order.servicePrice > 0 ? `${service.padEnd(20)} ${fmt(order.servicePrice)}` : null,
        order.rushPrice > 0 ? `Rush Fee                 ${fmt(order.rushPrice)}` : null,
        order.detergent && order.detergent !== 'None' && order.detergent !== 'Customer Provided' ? `Detergent (×${order.detergentQty || 1})           ${fmt((order.detergent.toLowerCase().includes('ariel') ? 30 : 25) * (order.detergentQty || 1))}` : null,
        order.conditioner && order.conditioner !== 'None' && order.conditioner !== 'Customer Provided' ? `Conditioner (×${order.conditionerQty || 1})         ${fmt((order.conditioner.toLowerCase().includes('downy') ? 25 : 15) * (order.conditionerQty || 1))}` : null,
        order.deliveryPrice > 0 ? `Delivery Fee             ${fmt(order.deliveryPrice)}` : null,
        '─────────────────────────',
        `TOTAL DUE:               ${fmt(resolveTotal(order))}`,
        '━━━━━━━━━━━━━━━━━━━━━━━',
        `Payment:  ${(order.paymentMethod || 'Cash on Delivery').replace(/_/g, ' ')}`,
        order.paymentStatus ? `Status:   ${order.paymentStatus}` : null,
        '─────────────────────────',
        'Thank you for choosing WashAlert!',
        'This receipt is system-generated.',
        '━━━━━━━━━━━━━━━━━━━━━━━',
      ].filter(Boolean).join('\n');

      await Share.share({ message: lines, title: `WashAlert Receipt — ${tracking}` });
    } catch {
      Alert.alert('Share Failed', 'Unable to share receipt. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text}/>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Order Details</Text>
        {order.trackingNumber
          ? <View style={styles.liveTag}>
              <Animated.View style={[styles.liveDot,{opacity:pulseAnim}]}/>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          : <View style={{width:48}}/>
        }
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* PRICE CONFIRMATION ACTION CARD */}
        {ns === 'awaiting_price' && (
          <TouchableOpacity 
            style={styles.confirmCard}
            activeOpacity={0.9}
            onPress={() => {
              console.log('[ReceiptDebug] card tapped, ns=', ns, 'order id=', order?.id, 'trackingNumber=', order?.trackingNumber, 'amount=', order?.amount, 'finalPrice=', order?.finalPrice);
              setShowReceiptModal(true);
            }}
          >
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIconWrap}>
                <Ionicons name="receipt" size={24} color="#EA580C" />
              </View>
              <View style={{flex:1}}>
                <Text style={styles.confirmTitle}>Your Receipt is Ready</Text>
                <Text style={styles.confirmSub}>Staff has finalized your order amount.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#EA580C" />
            </View>
            
            <View style={styles.receiptTeaser}>
              <Text style={styles.teaserLabel}>Total Amount Due</Text>
              <Text style={styles.teaserAmount}>₱{resolveTotal(order).toLocaleString()}</Text>
              <View style={styles.teaserAction}>
                <Text style={styles.teaserActionTxt}>Tap to view your receipt</Text>
                <Ionicons name="arrow-forward-circle" size={14} color="#EA580C" />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {ns === 'received' && (
          <View style={[styles.confirmCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderStyle: 'solid' }]}>
            <View style={styles.confirmHeader}>
              <View style={[styles.confirmIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="scale" size={24} color="#3B82F6" />
              </View>
              <View style={{flex:1}}>
                <Text style={[styles.confirmTitle, { color: '#1E293B' }]}>Order Received</Text>
                <Text style={[styles.confirmSub, { color: '#64748B' }]}>Our staff is currently weighing your laundry. You&apos;ll get a notification once the receipt is ready.</Text>
              </View>
            </View>
          </View>
        )}

        <PriceConfirmationModal
          visible={showReceiptModal}
          orderData={order}
          onConfirmed={() => {
            setShowReceiptModal(false);
            load().then((refreshed) => {
              const isGcash = String(order?.paymentMethod || '').toLowerCase() === 'gcash';
              if (isGcash && !isPaymentSettled(order)) {
                setShowGcashQrModal(true);
              } else {
                Alert.alert('✅ Confirmed!', 'Price confirmed! We are now washing your laundry.');
              }
            });
          }}
          onDismiss={() => setShowReceiptModal(false)}
          onRejected={() => {
            setShowReceiptModal(false);
            load();
          }}
        />

        <GcashQrModal
          visible={showGcashQrModal}
          order={order}
          branchPhone={branchPhone}
          onClose={() => setShowGcashQrModal(false)}
          onPaymentSubmitted={() => {
            load();
          }}
        />

        {/* HERO STATUS CARD */}
        <View style={styles.heroCard}>
          <Ring pct={pct} status={ns}/>
          <View style={styles.heroRight}>
            <Text style={styles.heroOrderId}>{order.trackingNumber || `#${order.id}`}</Text>
            <View style={[styles.badge,{backgroundColor:sb.bg}]}>
              <Text style={[styles.badgeText,{color:sb.text}]}>{badgeLabel}</Text>
            </View>
            <Text style={styles.heroDate}>{order.date}</Text>
            {/* Hide price when awaiting_price — it's already shown in the orange card above */}
            {ns !== 'awaiting_price' && (
              <Text style={styles.heroAmount}>₱{resolveTotal(order).toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* VERTICAL ORDER STEPPER */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Progress</Text>
          <View style={{marginTop:14}}>
            {stepsForOrder.map((step, i) => {
              const stepIdx  = stepsForOrder.findIndex(s => s.key === ns);
              const isDone   = i < stepIdx;
              const isActive = i === stepIdx;
              const isPend   = i > stepIdx;
              const sb2      = STATUS_BADGE[step.key] || STATUS_BADGE.pending;
              const isLast   = i === stepsForOrder.length - 1;
              return (
                <View key={step.key} style={{flexDirection:'row',alignItems:'flex-start'}}>
                  {/* Icon column */}
                  <View style={{width:36, alignItems:'center'}}>
                    <View style={{alignItems:'center',justifyContent:'center',position:'relative',width:28,height:28}}>
                      {isActive && <PulseRing color={sb2.text} />}
                      <View style={[
                        {width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center'},
                        isDone  && {backgroundColor:'#2563EB'},
                        isActive&& {backgroundColor:sb2.text},
                        isPend  && {borderWidth:2,borderColor:'#D1D5DB',backgroundColor:'#fff'},
                      ]}>
                        {isDone
                          ? <Ionicons name="checkmark" size={12} color="#fff"/>
                          : <Ionicons name={step.icon} size={11} color={isActive?'#fff':'#9CA3AF'}/>
                        }
                      </View>
                    </View>
                    {!isLast && (
                      <View style={{width:2,flex:1,minHeight:24,marginTop:2,
                        backgroundColor:isDone?'#2563EB':'#E5E7EB'}}/>
                    )}
                  </View>
                  {/* Label column */}
                  <View style={{flex:1,paddingBottom:isLast?0:16,paddingLeft:10,paddingTop:3}}>
                    <Text style={[
                      {fontSize:14,fontWeight:'600'},
                      isDone  && {color:'#374151'},
                      isActive&& {color:sb2.text,fontWeight:'800'},
                      isPend  && {color:'#9CA3AF'},
                    ]}>
                      {step.label}
                    </Text>
                    {isActive && !isLast && (
                      <Text style={{fontSize:11,color:sb2.text,marginTop:2,fontWeight:'600'}}>
                        In progress...
                      </Text>
                    )}
                    {isActive && step.key === 'awaiting_price' && (
                      <Text style={{fontSize:11,color:'#92400E',marginTop:4,lineHeight:15}}>
                        Check your notifications to confirm the price.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>


        {/* DRIVER CARD — shown when driver is assigned or active */}
        {driverVisible && order.delivery && (
          <View style={styles.driverCard}>
            <View style={styles.driverTop}>
              <View style={styles.driverAvatar}>
                {order.delivery.driverPhotoUrl
                  ? <Image source={{uri:order.delivery.driverPhotoUrl}} style={styles.driverAvatarImg}/>
                  : <Ionicons name="person" size={28} color={colors.primary}/>
                }
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{order.delivery.driver||'Driver'}</Text>
                <Text style={styles.driverSub}>{order.delivery.driverVehicle||'Vehicle N/A'}</Text>
              </View>
              <View style={styles.driverContact}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => call(resolvedDriverPhone)}>
                  <Ionicons name="call-outline" size={18} color={colors.primary}/>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => sms(resolvedDriverPhone)}>
                  <Ionicons name="chatbubble-outline" size={18} color={colors.primary}/>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.trackBtn}
              onPress={() => navigation.navigate('Tracking',{orderId:order.id})}>
              <Ionicons name="navigate" size={16} color="#FFF"/>
              <Text style={styles.trackBtnText}>Track Live Location</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LAUNDRY SERVICES ACCORDION */}
        <Accordion title="Laundry Services" icon="shirt-outline" defaultOpen={true}>
          <Row label="Package"     value={order.serviceName || order.serviceType || order.service}/>
          <Row label="Actual Weight" value={order.actualWeightKg ? `${order.actualWeightKg} kg` : (order.loadKg ? `~${order.loadKg} kg (Est.)` : 'TBD')}/>
          <Row label="Detergent"   value={order.detergent||'Customer Provided'}/>
          <Row label="Conditioner" value={order.conditioner||'Customer Provided'}/>
          {order.instructions&&<Row label="Instructions" value={order.instructions}/>}
        </Accordion>

        {/* LOGISTICS ACCORDION */}
        <Accordion title="Logistics" icon="bus-outline">
          <Row label="Branch" value={order.branchName||order.branch}/>
          {order.scheduleDate&&<Row label="Pickup Schedule" value={`${order.scheduleDate}  ${order.scheduleTime||''}`}/>}
        </Accordion>

        {/* PAYMENT ACCORDION */}
        <Accordion title="Payment Summary" icon="receipt-outline">
          {order.actualWeightKg && (
            <Row label="Actual Weight" value={`${order.actualWeightKg} kg`} valueStyle={{fontWeight:'700', color:colors.primary}}/>
          )}
          {order.servicePrice > 0 && (
            <Row label="Service Fee" value={`₱${order.servicePrice.toFixed(2)}`}/>
          )}
          
          {/* Itemized Supplies Breakdown */}
          {order.detergent && order.detergent !== 'None' && order.detergent !== 'Customer Provided' && (
            <Row 
              label={`Detergent: ${order.detergent}`} 
              value={`x${order.detergentQty || 1}  (₱${((order.detergent.toLowerCase().includes('premium') || order.detergent.toLowerCase().includes('ariel') ? 30 : 25) * (order.detergentQty || 1)).toFixed(2)})`} 
              valueStyle={{fontWeight:'600'}}
            />
          )}
          {order.conditioner && order.conditioner !== 'None' && order.conditioner !== 'Customer Provided' && (
            <Row 
              label={`Fabcon: ${order.conditioner}`} 
              value={`x${order.conditionerQty || 1}  (₱${((order.conditioner.toLowerCase().includes('premium') || order.conditioner.toLowerCase().includes('downy') ? 25 : 15) * (order.conditionerQty || 1)).toFixed(2)})`} 
              valueStyle={{fontWeight:'600'}}
            />
          )}
          {order.suppliesPrice > 0 && (
            <Row label="Supplies Total" value={`₱${order.suppliesPrice.toFixed(2)}`}/>
          )}

          {order.deliveryPrice > 0 && (
            <Row label="Delivery Fee" value={`₱${order.deliveryPrice.toFixed(2)}`}/>
          )}
          {order.rushPrice > 0 && (
            <Row label="Rush Service" value={`₱${order.rushPrice.toFixed(2)}`}/>
          )}
          <View style={styles.divider}/>
          <Row
            label="Total Due"
            value={`₱${resolveTotal(order).toFixed(2)}`}
            valueStyle={{fontWeight:'900', color:colors.primary, fontSize:18}}
          />
          <Row label="Payment" value={order.paymentMethod || '—'}/>

          {/* Pay Now button for GCash — hidden once payment is settled (PAID, VERIFIED, or isPaid) */}
          {String(order.paymentMethod || '').toLowerCase() === 'gcash' &&
           !isPaymentSettled(order) &&
           ['price_approved', 'washing', 'drying', 'ready', 'delivering'].includes(ns) && (
            <TouchableOpacity
              style={styles.payNowBtn}
              onPress={payNow}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="cellphone-wireless" size={18} color="#fff" />
              <Text style={styles.payNowTxt}>Pay via GCash Now</Text>
            </TouchableOpacity>
          )}

          {resolveTotal(order) > 0 && (
            <TouchableOpacity style={styles.shareReceiptBtn} onPress={handleShareReceipt} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={16} color={colors.primary} />
              <Text style={styles.shareReceiptTxt}>Share Receipt</Text>
            </TouchableOpacity>
          )}
        </Accordion>

        {/* DELIVERY ADDRESS (if applicable) */}
        {order.delivery&&(
          <Accordion title="Delivery Information" icon="location-outline">
            <Row label="Address" value={order.delivery.address}/>
            {order.deliveryUnitFloor ? <Row label="Unit / Floor" value={order.deliveryUnitFloor}/> : null}
            {order.deliveryContactName ? <Row label="Contact Name" value={order.deliveryContactName}/> : null}
            {order.deliveryContactPhone ? <Row label="Contact Phone" value={order.deliveryContactPhone}/> : null}
            <Row label="ETA" value={order.delivery.eta ? new Date(order.delivery.eta).toLocaleString() : 'Calculating'}/>
          </Accordion>
        )}

        {/* CONFIRMATION CODE */}
        {ns==='delivering'&&order.confirmationCode&&(
          <View style={styles.codeCard}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary}/>
            <Text style={styles.codeTitle}>Show this PIN to your rider</Text>
            <View style={styles.pinRow}>
              {String(order.confirmationCode).split('').map((d,i)=>(
                <View key={i} style={styles.pinBox}><Text style={styles.pinDigit}>{d}</Text></View>
              ))}
            </View>
          </View>
        )}

        {(ns === 'delivered' || ns === 'ready') && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, {marginBottom:12}]}>
              {feedbackDone ? '⭐ Your Feedback' : 'Rate Your Experience'}
            </Text>
            {/* Star selector */}
            <View style={{flexDirection:'row', gap:8, marginBottom:12}}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => { if (!feedbackDone) setFeedbackRating(star); }}
                  activeOpacity={feedbackDone ? 1 : 0.7}
                >
                  <Text style={{fontSize:30, color: star <= feedbackRating ? '#F59E0B' : '#D1D5DB'}}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!feedbackDone && (
              <>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Share your experience (optional, max 200 chars)"
                  placeholderTextColor="#9CA3AF"
                  value={feedbackComment}
                  onChangeText={t => setFeedbackComment(t.slice(0, 200))}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
                <Text style={{fontSize:10, color:'#9CA3AF', textAlign:'right', marginBottom:10}}>
                  {feedbackComment.length}/200
                </Text>
                <TouchableOpacity
                  style={[styles.footerPrimary, {marginTop:0}]}
                  onPress={submitFeedback}
                  disabled={feedbackSubmitting}
                  activeOpacity={0.8}
                >
                  {feedbackSubmitting
                    ? <ActivityIndicator size="small" color="#fff"/>
                    : <Text style={styles.footerPrimaryText}>Submit Feedback</Text>
                  }
                </TouchableOpacity>
              </>
            )}
            {feedbackDone && (
              feedbackComment
                ? <Text style={{fontSize:13, color:'#374151', fontStyle:'italic', lineHeight:20}}>&ldquo;{feedbackComment}&rdquo;</Text>
                : <Text style={{fontSize:12, color:'#9CA3AF'}}>No comment added.</Text>
            )}
            {feedbackDone && existingFeedback?.feedbackSubmittedAt && (
              <Text style={{fontSize:10, color:'#9CA3AF', marginTop:8}}>
                Submitted {new Date(existingFeedback.feedbackSubmittedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        <View style={{height:100}}/>
      </ScrollView>

      {/* STICKY FOOTER */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.footerOutline, !footerContactPhone && { opacity: 0.45, borderColor: colors.border }]}
            onPress={() => call(footerContactPhone)}
            disabled={!footerContactPhone}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={18} color={footerContactPhone ? colors.primary : colors.disabled}/>
            <Text
              style={[styles.footerOutlineText, !footerContactPhone && { color: colors.disabled }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {footerContactPhone ? `Call ${footerContactLabel}` : 'No Phone'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerOutline, !footerContactPhone && { opacity: 0.45, borderColor: colors.border }]}
            onPress={() => sms(footerContactPhone)}
            disabled={!footerContactPhone}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={18} color={footerContactPhone ? colors.primary : colors.disabled}/>
            <Text
              style={[styles.footerOutlineText, !footerContactPhone && { color: colors.disabled }]}
              numberOfLines={1}
            >
              Message
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerPrimary}
            onPress={() => navigation.navigate('Tracking', { orderId: order.id })}>
            <Ionicons name="location-outline" size={18} color="#FFF"/>
            <Text style={styles.footerPrimaryText}>Track Order</Text>
          </TouchableOpacity>
        </View>
        {/* Cancel button — visible for pre-processing statuses only */}
        {(ns === 'pending' || ns === 'received') ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelOrder} activeOpacity={0.8}>
            <Ionicons name="close-circle-outline" size={15} color={colors.error}/>
            <Text style={styles.cancelText}>Cancel Booking</Text>
          </TouchableOpacity>
        ) : (ns !== 'delivered' && ns !== 'cancelled') ? (
          <View style={styles.cancelBlockedRow}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} style={styles.cancelBlockedIcon}/>
            <Text style={styles.cancelBlockedText}>
              {(ns === 'awaiting_price' || ns === 'washing' || ns === 'drying')
                ? 'Your laundry is already being processed and cannot be cancelled.'
                : (ns === 'ready' || ns === 'delivering')
                ? 'Your order is ready or on its way — cancellation is no longer available.'
                : 'Cancellation is no longer available for this order.'}
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex:1, backgroundColor:colors.background },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  scroll: { paddingHorizontal:16, paddingTop:8 },

  navBar:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12, backgroundColor:colors.background },
  navBack:  { width:40, height:40, justifyContent:'center' },
  navTitle: { fontSize:17, fontWeight:'700', color:colors.text },

  liveTag:  { flexDirection:'row', alignItems:'center', backgroundColor:'#F0FDF4', paddingHorizontal:10, paddingVertical:4, borderRadius:100, gap:5 },
  liveDot:  { width:6, height:6, borderRadius:3, backgroundColor:'#22C55E' },
  liveText: { fontSize:10, fontWeight:'800', color:'#22C55E', letterSpacing:0.8 },

  // HERO
  heroCard: { flexDirection:'row', alignItems:'center', gap:20, backgroundColor:'#FFF', borderRadius:20, padding:20, marginBottom:12, borderWidth:1, borderColor:colors.border, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  heroRight:{ flex:1, gap:6 },
  heroOrderId: { fontSize:12, color:colors.textTertiary, fontWeight:'600', letterSpacing:0.4 },
  heroDate:    { fontSize:12, color:colors.textSecondary },
  heroAmount:  { fontSize:22, fontWeight:'900', color:colors.text },
  badge:       { alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:4, borderRadius:100 },
  badgeText:   { fontSize:13, fontWeight:'700' },

  // CARDS
  card:     { backgroundColor:'#FFF', borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:colors.border },
  cardHeaderRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  cardTitle: { fontSize:14, fontWeight:'700', color:colors.text },
  viewAll:   { fontSize:12, fontWeight:'600', color:colors.accent },
  accordionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  accordionLeft:   { flexDirection:'row', alignItems:'center', gap:8 },
  accordionBody:   { marginTop:14 },

  // 3-POINT TIMELINE
  threePoint: { gap:14 },
  tpRow:   { flexDirection:'row', alignItems:'flex-start', gap:12 },
  tpActive:{ backgroundColor:colors.primaryLight, borderRadius:12, padding:10, marginHorizontal:-6 },
  tpDot:   { width:10, height:10, borderRadius:5, marginTop:4 },
  tpLabel: { fontSize:10, fontWeight:'600', color:colors.textSecondary, letterSpacing:0.4, textTransform:'uppercase' },
  tpStep:  { fontSize:14, fontWeight:'700', color:colors.text, marginTop:2 },

  // Price Confirmation Card
  confirmCard:{backgroundColor:'#FFF7ED',borderRadius:24,padding:20,marginBottom:16,borderWidth:1.5,borderColor:'#FFEDD5',gap:16,shadowColor:'#EA580C',shadowOffset:{width:0,height:6},shadowOpacity:0.15,shadowRadius:12,elevation:6},
  confirmHeader:{flexDirection:'row',alignItems:'center',gap:12},
  confirmIconWrap:{width:48,height:48,borderRadius:16,backgroundColor:'#FFEDD5',alignItems:'center',justifyContent:'center'},
  confirmTitle:{fontSize:17,fontWeight:'900',color:'#9A3412',letterSpacing:-0.3},
  confirmSub:{fontSize:12,color:'#C2410C',marginTop:1,fontWeight:'600'},
  receiptTeaser:{backgroundColor:'#fff',borderRadius:16,padding:16,alignItems:'center',borderWidth:1,borderColor:'#FFEDD5',borderStyle:'dashed'},
  teaserLabel:{fontSize:10,fontWeight:'800',color:'#C2410C',textTransform:'uppercase',letterSpacing:1},
  teaserAmount:{fontSize:28,fontWeight:'900',color:'#EA580C',marginVertical:4},
  teaserAction:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},
  teaserActionTxt:{fontSize:11,fontWeight:'700',color:'#9A3412'},

  // FULL TIMELINE
  tlRow:     { flexDirection:'row', height:48 },
  tlIconCol: { alignItems:'center', width:20, marginRight:14 },
  tlDot:     { width:12, height:12, borderRadius:6 },
  tlDotOn:   { backgroundColor:colors.primary },
  tlDotOff:  { backgroundColor:colors.border },
  tlLine:    { width:2, flex:1, marginTop:-2, marginBottom:-10 },
  tlLineOn:  { backgroundColor:colors.primary },
  tlLineOff: { backgroundColor:colors.border },
  tlContent: { flex:1, paddingBottom:14 },
  tlStep:    { fontSize:14, fontWeight:'600' },
  tlTime:    { fontSize:11, color:colors.textTertiary, marginTop:2 },

  // DRIVER CARD
  driverCard:    { backgroundColor:'#FFF', borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:colors.border },
  driverTop:     { flexDirection:'row', alignItems:'center', marginBottom:14 },
  driverAvatar:  { width:52, height:52, borderRadius:26, backgroundColor:colors.primaryLight, alignItems:'center', justifyContent:'center', marginRight:12 },
  driverAvatarImg:{ width:52, height:52, borderRadius:26 },
  driverInfo:    { flex:1 },
  driverName:    { fontSize:16, fontWeight:'800', color:colors.text },
  driverSub:     { fontSize:13, color:colors.textSecondary, marginTop:2 },
  driverContact: { flexDirection:'row', gap:8 },
  contactBtn:    { width:40, height:40, borderRadius:20, backgroundColor:colors.primaryLight, alignItems:'center', justifyContent:'center' },

  trackBtn:      { height:48, backgroundColor:colors.primary, borderRadius:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  trackBtnText:  { color:'#FFF', fontSize:15, fontWeight:'700' },

  // INFO ROWS
  infoRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:10, alignItems:'center' },
  infoKey: { fontSize:13, color:colors.textSecondary },
  infoVal: { fontSize:13, fontWeight:'600', color:colors.text, maxWidth:'60%', textAlign:'right', flexShrink:1 },
  divider: { height:1, backgroundColor:colors.border, marginVertical:10 },

  // CODE CARD
  codeCard:  { backgroundColor:colors.primaryLight, borderRadius:16, padding:20, marginBottom:12, alignItems:'center', gap:10, borderWidth:1, borderColor:colors.border },
  codeTitle: { fontSize:13, fontWeight:'700', color:colors.primary },
  pinRow:    { flexDirection:'row', gap:10 },
  pinBox:    { width:48, height:60, borderRadius:12, backgroundColor:'#FFF', borderWidth:2, borderColor:colors.primary, alignItems:'center', justifyContent:'center' },
  pinDigit:  { fontSize:28, fontWeight:'900', color:colors.primary },

  // STICKY FOOTER
  stickyFooter:  { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#FFF', paddingHorizontal:16, paddingTop:12, paddingBottom:28, borderTopWidth:1, borderTopColor:colors.border, shadowColor:'#000', shadowOffset:{width:0,height:-4}, shadowOpacity:0.06, shadowRadius:8, elevation:8 },
  footerRow:     { flexDirection:'row', gap:10, marginBottom:8 },
  // flex:1 (shared proportionally with footerPrimary) instead of a fixed 72px width —
  // a fixed box wrapped longer dynamic labels ("Call Driver") onto two lines and threw
  // off alignment against the single-line "Message" button next to it.
  footerOutline: { flex:1, height:48, borderWidth:1.5, borderColor:colors.border, borderRadius:14, alignItems:'center', justifyContent:'center', gap:2, paddingHorizontal:4 },
  footerOutlineText: { fontSize:11, fontWeight:'600', color:colors.primary },
  footerPrimary: { flex:1.4, height:48, backgroundColor:colors.primary, borderRadius:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  footerPrimaryText: { fontSize:15, fontWeight:'700', color:'#FFF' },
  cancelBtn:  {
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
    marginTop:4, paddingVertical:10, borderRadius:12,
    borderWidth:1, borderColor:'#FEE2E2', backgroundColor:'#FEF2F2',
  },
  cancelText: { fontSize:13, fontWeight:'700', color:colors.error },
  cancelBlockedRow: {
    flexDirection:'row', alignItems:'flex-start', gap:8,
    marginTop:4, padding:10, borderRadius:12, backgroundColor:'#F9FAFB',
  },
  cancelBlockedIcon: { marginTop:2 },
  cancelBlockedText: { flex:1, fontSize:12, color:colors.textSecondary, lineHeight:18 },

  // Pay Now Button
  payNowBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  payNowTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  shareReceiptBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  shareReceiptTxt: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  feedbackInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#374151',
    textAlignVertical: 'top',
    minHeight: 72,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
  },
});
