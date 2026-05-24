import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, Linking, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MapView, Marker, PROVIDER_GOOGLE, AnimatedRegion, MapViewDirections } from '../../components/SafeMap';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors } from '../../theme/colors';
import { bookings as bookingsApi, deliveries as deliveriesApi } from '../../services/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAzAGBAijqpEZki3ZZBYe-9rxtzjF55RSY';
const { width: SCREEN_W } = Dimensions.get('window');
const SHEET_H = 310; // fixed px — never clips content

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#e8edf2' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7a8a99' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d8dfe6' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c5cdd6' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#edf0f3' }] },
];

// ── 4 clean milestones (industry standard like Grab / Lalamove) ───────────────
const MILESTONES = [
  { label: 'Pickup',     icon: 'truck-fast-outline',       mat: true },
  { label: 'Processing', icon: 'washing-machine',          mat: true },
  { label: 'Ready',      icon: 'package-variant-closed',   mat: true },
  { label: 'Delivery',   icon: 'bike-fast',                mat: true },
  { label: 'Done',       icon: 'check-circle-outline',     mat: true },
];

const statusToMilestone = (status) => {
  if (!status) return 0;
  const s = String(status).toUpperCase();
  
  if (['ASSIGNED_FOR_PICKUP', 'EN_ROUTE_TO_CUSTOMER', 'LAUNDRY_COLLECTED', 'EN_ROUTE_TO_BRANCH'].includes(s)) return 0;
  if (['ORDER_RECEIVED', 'AWAITING_PRICE_CONFIRMATION', 'PRICE_CONFIRMED', 'WASHING', 'DRYING'].includes(s)) return 1;
  if (['READY'].includes(s)) return 2;
  if (['ASSIGNED_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(s)) return 3;
  if (s === 'DELIVERED') return 5; // All steps done
  
  return 0;
};

const STATUS_HEADLINE = {
  PENDING:                'Order received!',
  ASSIGNED_FOR_PICKUP:    'Rider assigned for pickup',
  EN_ROUTE_TO_CUSTOMER:   'Rider is heading to your location',
  LAUNDRY_COLLECTED:      'Laundry collected by rider',
  EN_ROUTE_TO_BRANCH:     'Heading to our laundry branch',
  ORDER_RECEIVED:         'Laundry received at branch',
  WASHING:                'Laundry is being washed',
  DRYING:                 'Laundry is being dried',
  READY:                  'Ready for delivery!',
  ASSIGNED_FOR_DELIVERY:  'Rider assigned for delivery',
  OUT_FOR_DELIVERY:       'Your order is on its way!',
  DELIVERED:              'Successfully delivered!',
};

export default function TrackingScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const orderId = route?.params?.orderId;

  const [order,     setOrder]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [driverLoc, setDriverLoc] = useState(null);
  const [delivData, setDelivData] = useState(null);
  const [trackingWarning, setTrackingWarning] = useState('');
  const [etaData,   setEtaData]   = useState({ distance: null, duration: null });
  const [mapRef,    setMapRef]    = useState(null);

  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim  = useRef(new Animated.Value(0.95)).current;
  const driverCoord = useRef(new AnimatedRegion({
    latitude: 14.5995, longitude: 120.9842,
    latitudeDelta: 0.005, longitudeDelta: 0.005,
  })).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.15, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ])).start();
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50 }).start();
  }, []);

  useEffect(() => { loadOrder(); }, [orderId]);

  useEffect(() => {
    const trackingDocId = String(delivData?.id || order?.trackingNumber || '').trim();
    if (!trackingDocId) return;
    if (!db) {
      setTrackingWarning('Tracking unavailable right now. Please try again later.');
      return;
    }
    console.log('[Tracking] Listening for:', trackingDocId);
    try {
      const trackingRef = doc(db, 'delivery_tracking', trackingDocId);
      const unsub = onSnapshot(
        trackingRef,
        (snap) => {
          if (!snap.exists()) {
            // Document missing = driver not yet broadcasting GPS.
            // If the order status shows driver assigned, give a friendly message.
            const s = String(order?.status || '').toUpperCase();
            const statusUpper = String(order?.status || '').toUpperCase();
            const driverAssigned =
              Boolean(order?.assignedDriverId || delivData?.assignedDriverId || order?.assignedDriverName || delivData?.driverName) ||
              [
              'ASSIGNED_FOR_PICKUP', 'ASSIGNED_FOR_DELIVERY'
            ].includes(statusUpper);
            setTrackingWarning(
              driverAssigned
                ? 'Driver assigned. Live tracking starts when the driver begins pickup/delivery.'
                : 'Driver location not available yet.'
            );
            return;
          }
          const d = snap.data() || {};
          setDelivData(d);
          const lat = Number(d.lat);
          const lng = Number(d.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const c = { latitude: lat, longitude: lng };
            setDriverLoc(c);
            setTrackingWarning('');
            driverCoord.timing({ ...c, duration: 5000, useNativeDriver: false }).start();
          }
        },
        (error) => {
          console.warn('[Tracking] Firestore listener failed:', error?.message || error);
          setTrackingWarning('Tracking unavailable right now. Please check again later.');
        }
      );
      return () => unsub();
    } catch (error) {
      console.warn('[Tracking] Unable to subscribe to Firestore:', error?.message || error);
      setTrackingWarning('Tracking unavailable right now. Please check again later.');
      return undefined;
    }
  }, [order?.trackingNumber, order?.status, order?.assignedDriverId, order?.assignedDriverName, delivData?.id, delivData?.assignedDriverId, delivData?.driverName]);

  const loadOrder = async () => {
    if (!orderId) {
      setOrder(null);
      setTrackingWarning('Tracking unavailable: missing order reference.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const d = await bookingsApi.getById(orderId);
      setOrder(d);
      if (d?.trackingNumber) {
        const delivery = await deliveriesApi.trackByTrackingNumber(d.trackingNumber);
        if (delivery) {
          setDelivData((prev) => ({ ...(prev || {}), ...delivery }));
          const lat = Number(delivery.currentLatitude);
          const lng = Number(delivery.currentLongitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const c = { latitude: lat, longitude: lng };
            setDriverLoc(c);
            setTrackingWarning('');
            driverCoord.timing({ ...c, duration: 800, useNativeDriver: false }).start();
          } else if (
            delivery.assignedDriverId ||
            delivery.driverName ||
            ['ASSIGNED_FOR_PICKUP', 'ASSIGNED_FOR_DELIVERY'].includes(String(delivery.workflowStatus || '').toUpperCase())
          ) {
            setTrackingWarning('Driver assigned. Live tracking starts when the driver begins pickup/delivery.');
          }
        }
      }
    } catch (e) {
      console.error(e);
      setTrackingWarning('Tracking unavailable right now. Please try again later.');
    }
    finally { setLoading(false); }
  };

  if (loading) return (
    <View style={S.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={S.loadingText}>Loading your order...</Text>
    </View>
  );

  if (!order) return (
    <View style={S.center}>
      <Ionicons name="alert-circle-outline" size={52} color={colors.border} />
      <Text style={S.errorTitle}>Order not found</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={S.goBackBtn}>
        <Text style={S.goBackText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const statusUpper = String(order?.status || '').toUpperCase();
  const milestoneIdx  = statusToMilestone(order.status);
  // Phase check: are we in a status where tracking is relevant?
  const isTrackingPhase = (
    order.status === 'delivering' ||
    [
      'ASSIGNED_FOR_PICKUP', 'EN_ROUTE_TO_CUSTOMER', 'LAUNDRY_COLLECTED', 'EN_ROUTE_TO_BRANCH',
      'ASSIGNED_FOR_DELIVERY', 'OUT_FOR_DELIVERY'
    ].includes(statusUpper)
  );

  // We show the map if we are in the phase, even if driverLoc is temporarily missing
  // But we need driverLoc to show the Car and Route
  const isTrackingRider = isTrackingPhase;
  
  const driverPhone   = delivData?.driverPhone || order?.delivery?.phone || order?.assignedDriverPhone || '';
  const driverName    = delivData?.driverName || order?.delivery?.driver || order?.assignedDriverName || 'Assigned Driver';
  const driverPhoto   = delivData?.driverPhotoUrl || order?.delivery?.driverPhotoUrl || order?.assignedDriverPhotoUrl || null;

  const callDriver = async () => {
    try {
      const p = driverPhone.replace(/[^0-9+]/g, '');
      if (!p) { Alert.alert('No Contact', 'No contact number available.'); return; }
      const url = `tel:${p}`;
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Error', 'Your device cannot open this action.');
    } catch {
      Alert.alert('Error', 'Your device cannot open this action.');
    }
  };
  const smsDriver = async () => {
    try {
      const p = driverPhone.replace(/[^0-9+]/g, '');
      if (!p) { Alert.alert('No Contact', 'No contact number available.'); return; }
      const url = `sms:${p}`;
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Error', 'Your device cannot open this action.');
    } catch {
      Alert.alert('Error', 'Your device cannot open this action.');
    }
  };
  const headline =
    order.status === 'delivering' 
      ? (['LAUNDRY_COLLECTED', 'EN_ROUTE_TO_BRANCH'].includes(order.deliveryWorkflowStatus || '') ? 'Heading to our branch' : 'Heading to your location')
      : (STATUS_HEADLINE[statusUpper] || 'Tracking your order...');

  const isDelivering  = !!driverLoc && isTrackingPhase;
  const etaLabel      = isDelivering && etaData.duration ? etaData.duration : (order.estimatedTime || 'Pending');

  // Determine destination based on phase
  const isLegToBranch = ['LAUNDRY_COLLECTED', 'EN_ROUTE_TO_BRANCH'].includes(order.deliveryWorkflowStatus || statusUpper);
  const destLoc = isLegToBranch 
    ? { latitude: order.branchLatitude || 14.5995, longitude: order.branchLongitude || 120.9842 }
    : { latitude: order.deliveryLatitude || 14.5995, longitude: order.deliveryLongitude || 120.9842 };
  const topOffset = insets.top + 10;
  const navBannerTop = topOffset + 56;
  const etaBannerTop = navBannerTop + (trackingWarning ? 84 : 0);

  return (
    <View style={S.root}>

      {/* ── MAP AREA — flex:1 fills all space above the sheet ── */}
      <View style={S.mapWrap}>
        {isTrackingRider ? (
          <MapView
            ref={r => setMapRef(r)}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            customMapStyle={MAP_STYLE}
            initialRegion={{ ...(driverLoc || destLoc), latitudeDelta: 0.025, longitudeDelta: 0.025 }}
          >
            {driverLoc && (
              <MapViewDirections
                origin={driverLoc}
                destination={destLoc}
                apikey={GOOGLE_MAPS_API_KEY}
                strokeWidth={4}
                strokeColor={colors.primary}
                mode="DRIVING"
                onReady={r => {
                  setEtaData({
                    distance: `${r.distance.toFixed(1)} km`,
                    duration: `${Math.ceil(r.duration)} min`,
                  });
                  mapRef?.fitToCoordinates(r.coordinates, {
                    edgePadding: { top: 120, right: 50, bottom: SHEET_H + 40, left: 50 },
                  });
                }}
              />
            )}
            <Marker coordinate={destLoc}>
              <View style={[S.pinDest, { backgroundColor: isLegToBranch ? colors.accent : colors.text }]}>
                <Ionicons name={isLegToBranch ? "business" : "home"} size={14} color="#FFF" />
              </View>
            </Marker>
            {driverLoc && (
              <Marker.Animated coordinate={driverCoord} flat anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[S.pinDriver, {
                  transform: [{ rotate: `${delivData?.heading || 0}deg` }],
                }]}>
                  <MaterialCommunityIcons name="car-back" size={22} color="#FFF" />
                </View>
              </Marker.Animated>
            )}
          </MapView>
        ) : (
          /* ── PREMIUM STATIC STATE ── */
          <View style={S.staticBg}>
            <View style={S.staticInner}>
              <View style={S.staticIconRing}>
                <View style={S.staticIconRingInner}>
                  <MaterialCommunityIcons
                    name={
                      statusUpper === 'WASHING' || statusUpper === 'DRYING'
                        ? 'washing-machine'
                        : statusUpper === 'READY'
                        ? 'package-variant-closed-check'
                        : 'truck-delivery-outline'
                    }
                    size={38}
                    color={colors.primary}
                  />
                </View>
              </View>
              <Text style={S.staticLabel}>
                {statusUpper === 'WASHING' ? 'Washing in progress...'
                  : statusUpper === 'DRYING' ? 'Drying in progress...'
                  : statusUpper === 'READY'  ? 'Ready for delivery!'
                  : 'Order confirmed'}
              </Text>
            </View>
          </View>
        )}

        {trackingWarning ? (
          <View style={[S.navOverlay, { top: navBannerTop, backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
            <View style={S.navTextBox}>
              <Text style={[S.navSubText, { color: '#92400E' }]}>Tracking unavailable</Text>
              <Text style={[S.navMainText, { color: '#92400E', fontSize: 12 }]}>{trackingWarning}</Text>
            </View>
          </View>
        ) : null}

        {/* Premium Navigation Instructions for Customer */}
        {isTrackingRider && etaData.duration && (
          <View style={[S.navOverlay, { top: etaBannerTop }]}>
            <View style={S.navIconBox}>
              <MaterialCommunityIcons name="navigation-variant" size={20} color="#FFF" />
            </View>
            <View style={S.navTextBox}>
              <Text style={S.navSubText}>{isLegToBranch ? 'Heading to Branch' : 'Heading to your Location'}</Text>
              <Text style={S.navMainText}>{etaData.duration} • {etaData.distance}</Text>
            </View>
          </View>
        )}

        {/* Floating back */}
        <TouchableOpacity
          style={[S.fabBack, { top: topOffset }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
          <Text style={S.fabBackText}>Back</Text>
        </TouchableOpacity>

        {/* Floating order tag */}
        <View style={[S.fabTag, { top: topOffset }]}>
          <Ionicons name="receipt-outline" size={12} color={colors.primary} />
          <Text style={S.fabTagText}>{order.trackingNumber || `#${order.id}`}</Text>
        </View>
      </View>

      {/* ── BOTTOM SHEET — fixed height, sits below map ── */}
      <View style={[S.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={S.sheetHandle} />

        {/* Status + ETA */}
        <View style={S.sheetHead}>
          <Text style={S.sheetHeadline}>{headline}</Text>
          <View style={S.etaBadge}>
            <Ionicons name="time-outline" size={13} color={colors.primary} />
            <Text style={S.etaBadgeText}>{etaLabel}</Text>
          </View>
        </View>

        {/* ── 4-STEP MILESTONE TRACKER ── */}
        <View style={S.milestoneRow}>
          {MILESTONES.map((m, i) => {
            const done    = i < milestoneIdx;
            const active  = i === milestoneIdx;
            const upcoming = i > milestoneIdx;
            return (
              <React.Fragment key={m.label}>
                <View style={S.milestoneNode}>
                  {/* Circle */}
                  <View style={[
                    S.mCircle,
                    done    && S.mCircleDone,
                    active  && S.mCircleActive,
                    upcoming && S.mCircleUpcoming,
                  ]}>
                    {done ? (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    ) : (
                      <Ionicons
                        name={m.icon}
                        size={16}
                        color={active ? '#FFF' : '#B0BEC5'}
                      />
                    )}
                  </View>
                  {/* Active glow ring */}
                  {active && <View style={S.mGlowRing} />}
                  {/* Label */}
                  <Text style={[
                    S.mLabel,
                    done    && S.mLabelDone,
                    active  && S.mLabelActive,
                    upcoming && S.mLabelUpcoming,
                  ]}>
                    {m.label}
                  </Text>
                </View>

                {/* Connector */}
                {i < MILESTONES.length - 1 && (
                  <View style={S.connector}>
                    <View style={[S.connLine, done && S.connLineDone]} />
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* ── DRIVER CARD ── */}
        {order.delivery ? (
          <View style={S.driverCard}>
            <View style={S.driverAvatarWrap}>
              {driverPhoto ? (
                <Image source={{ uri: driverPhoto }} style={S.driverPhoto} />
              ) : (
                <Ionicons name="person" size={24} color={colors.primary} />
              )}
              {isDelivering && (
                <Animated.View style={[S.liveRing, { opacity: pulseAnim }]} />
              )}
            </View>

            <View style={S.driverMeta}>
              <Text style={S.driverName} numberOfLines={1}>
                {driverName}
              </Text>
              <View style={S.driverSubRow}>
                {isDelivering && (
                  <View style={S.livePill}>
                    <View style={S.liveDot} />
                    <Text style={S.livePillText}>Live</Text>
                  </View>
                )}
                <Text style={S.driverRole}>Courier</Text>
              </View>
            </View>

            <View style={S.driverBtns}>
              <TouchableOpacity style={S.roundBtn} onPress={callDriver} activeOpacity={0.75}>
                <Ionicons name="call" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={S.roundBtn} onPress={smsDriver} activeOpacity={0.75}>
                <Ionicons name="chatbubble-ellipses" size={17} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={S.noDriverCard}>
            <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
            <Text style={S.noDriverText}>Driver will be assigned soon</Text>
          </View>
        )}

        {/* Details link */}
        <TouchableOpacity
          style={S.detailsLink}
          onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
          activeOpacity={0.7}
        >
          <Text style={S.detailsLinkText}>View Full Details</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#EDF2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#F4F7FA' },
  loadingText: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  errorTitle:  { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  goBackBtn:   { marginTop: 14, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: colors.primaryLight, borderRadius: 14 },
  goBackText:  { fontSize: 14, fontWeight: '700', color: colors.primary },

  /* Map — flex:1 so it grows to fill all space ABOVE the sheet */
  mapWrap:  { flex: 1, overflow: 'hidden' },

  /* Static state */
  staticBg: { flex: 1, backgroundColor: '#EDF2F7', alignItems: 'center', justifyContent: 'center' },
  staticInner: { alignItems: 'center', gap: 14 },
  staticIconRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(28,47,62,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  staticIconRingInner: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(28,47,62,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  staticLabel: { fontSize: 14, fontWeight: '700', color: colors.primary, opacity: 0.75 },

  /* Floating buttons over map */
  fabBack: {
    position: 'absolute', left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  fabBackText: { fontSize: 14, fontWeight: '700', color: colors.text },
  fabTag: {
    position: 'absolute', right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 13, paddingVertical: 10,
    borderRadius: 50,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  fabTagText: { fontSize: 12, fontWeight: '700', color: colors.text },
  
  /* Premium Nav Overlay */
  navOverlay: {
    position: 'absolute', left: 14, right: 14,
    backgroundColor: '#FFF', borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  navIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  navTextBox: { marginLeft: 12, flex: 1 },
  navSubText: { fontSize: 9, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  navMainText: { fontSize: 14, fontWeight: '900', color: colors.text, marginTop: 1 },

  /* Map markers */
  pinDest: { backgroundColor: colors.text, padding: 9, borderRadius: 50, borderWidth: 2.5, borderColor: '#FFF' },
  pinDriver: { backgroundColor: '#2E86C1', padding: 9, borderRadius: 50, borderWidth: 2.5, borderColor: '#FFF' },

  /* Bottom Sheet — fixed height, sits below map naturally in flex column */
  sheet: {
    height: SHEET_H,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.10, shadowRadius: 18, elevation: 20,
  },
  sheetHandle: {
    alignSelf: 'center', width: 36, height: 4,
    backgroundColor: '#DDE3EB', borderRadius: 4, marginBottom: 14,
  },

  /* Sheet head — row: headline left, ETA badge right */
  sheetHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetHeadline: { fontSize: 16, fontWeight: '800', color: colors.text, flex: 1, marginRight: 10 },
  sheetSub:      { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  etaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EBF4FF', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 50, flexShrink: 0,
  },
  etaBadgeText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  /* Milestone tracker — compact to fit fixed sheet height */
  milestoneRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, paddingHorizontal: 2,
  },
  milestoneNode: { alignItems: 'center', position: 'relative' },

  mCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EDF2F7', marginBottom: 5,
  },
  mCircleDone:     { backgroundColor: colors.primary },
  mCircleActive:   {
    backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  mCircleUpcoming: { backgroundColor: '#EDF2F7' },
  mGlowRing: {
    position: 'absolute', top: -5, width: 50, height: 50,
    borderRadius: 25, borderWidth: 1.5, borderColor: `${colors.primary}28`,
  },

  mLabel:        { fontSize: 10, color: '#B0BEC5', fontWeight: '600', textAlign: 'center', maxWidth: 56 },
  mLabelActive:  { color: colors.primary, fontWeight: '800' },
  mLabelDone:    { color: colors.textSecondary, fontWeight: '700' },
  mLabelUpcoming:{ color: '#C8D0DB' },

  /* Connectors */
  connector: { flex: 1, alignItems: 'center', marginBottom: 15, paddingHorizontal: 2 },
  connLine:  { width: '100%', height: 2.5, backgroundColor: '#E8EDF3', borderRadius: 2 },
  connLineDone: { backgroundColor: colors.primary },

  /* Driver card — compact */
  driverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#EDF2F7',
  },
  driverAvatarWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#E8EFF4',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10, position: 'relative',
    overflow: 'hidden',
  },
  driverPhoto: { width: 42, height: 42, borderRadius: 21 },
  liveRing: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: '#22C55E', top: -4, left: -4,
  },
  driverMeta: { flex: 1, gap: 2 },
  driverName: { fontSize: 14, fontWeight: '800', color: colors.text },
  driverSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverRole: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 50,
  },
  liveDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E' },
  livePillText:{ fontSize: 9, fontWeight: '800', color: '#16A34A' },
  driverBtns: { flexDirection: 'row', gap: 7, marginLeft: 6 },
  roundBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E8EDF3',
  },
  noDriverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8,
  },
  noDriverText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  detailsLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 6,
  },
  detailsLinkText: { fontSize: 13, fontWeight: '700', color: '#2E86C1' },
});
