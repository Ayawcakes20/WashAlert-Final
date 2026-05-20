import React, { useState, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, FlatList,
  TouchableOpacity, Image, Animated,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors } from '../../theme/colors';
import { LoadingSkeleton } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { bookings as bookingsApi } from '../../services/api';
import S from './HomeScreenStyles';

// ─── Static Service Data ──────────────────────────────────────────────────────
const SERVICES = [
  { id: 'w7',  img: require('../../../assets/images/svc_wash_v3.png'),   tag: 'Standard', tagColor: '#2E86C1', tagBg: '#D6EAF8', price: '₱80 / 7kg',  name: 'Wash'         },
  { id: 'd7',  img: require('../../../assets/images/svc_dry_v3.png'),    tag: 'Standard', tagColor: '#E11D48', tagBg: '#FFF1F2', price: '₱90 / 7kg',  name: 'Dry'          },
  { id: 'eco', img: require('../../../assets/images/svc_wash.png'),       tag: 'Eco',      tagColor: '#059669', tagBg: '#D1FAE5', price: '₱220 / 5kg', name: 'Ecowash Full' },
  { id: 'b7',  img: require('../../../assets/images/svc_fullservice.png'),tag: '',         tagColor: 'transparent', tagBg: 'transparent', price: '₱245 / 8kg', name: 'Basic Full Service'   },
  { id: 'p7',  img: require('../../../assets/images/svc_dry.png'),        tag: '',         tagColor: 'transparent', tagBg: 'transparent', price: '₱275 / 8kg', name: 'Premium Full Service' },
  { id: 'hw',  img: require('../../../assets/images/svc_handwash.png'),   tag: 'Hand',     tagColor: '#1C2F3E', tagBg: '#E8EFF4', price: '₱150/kg',    name: 'Handwash'     },
];

// ─── Branch Data ──────────────────────────────────────────────────────────────
const LAUNDRYHUBS = [
  { id: 'lh1', name: 'Makati Branch', address: '7605 Dela Rosa, Corner Wilson St. (inside R&R Carwash), Makati City, Metro Manila' },
];
const SPEEDYWASH = [
  { id: 'sw1', name: 'Chestnut Branch',         address: '244A Upper Republic Ave., West Fairview Park, Quezon City' },
  { id: 'sw2', name: 'Republic Branch',          address: 'Republic Ave., West Fairview, Quezon City' },
  { id: 'sw3', name: 'Holy Spirit Branch',       address: 'Faustino St., Brgy. Holy Spirit, Quezon City' },
  { id: 'sw4', name: 'Sta. Catalina Branch',     address: '408 Sta. Catalina St., Quezon City' },
  { id: 'sw5', name: 'Brookside Branch',         address: 'Sunset Drive, Brookside Hills Subdivision, Cainta, Rizal' },
  { id: 'sw6', name: 'JP Rizal Branch',          address: 'J.P. Rizal Ave., Binangonan, Rizal' },
  { id: 'sw7', name: 'Luzon Branch',             address: 'Luzon Ave., Matandang Balara, Quezon City' },
  { id: 'sw8', name: 'St. Anthony Branch',       address: 'St. Anthony Street, Quezon City' },
  { id: 'sw9', name: 'UP Diliman / San Vicente', address: 'San Vicente, Diliman, Quezon City' },
];

// ─── Order Status Config ──────────────────────────────────────────────────────
const STATUS_STEPS = ['pending', 'received', 'washing', 'drying', 'ready'];
const STATUS_STEP_LABELS = ['Pending', 'Received', 'Washing', 'Drying', 'Ready'];

const STATUS_DISPLAY = {
  pending:        'Pending Confirmation',
  received:       'Order Received',
  awaiting_price: 'Awaiting Price',
  washing:        'Washing in Progress',
  drying:         'Drying in Progress',
  ready:          'Ready for Pickup',
  delivering:     'Out for Delivery',
  delivered:      'Delivered',
  cancelled:      'Cancelled',
};

const STATUS_COLOR = {
  pending:    '#F59E0B',
  received:   '#3B82F6',
  washing:    '#8B5CF6',
  drying:     '#8B5CF6',
  ready:      '#10B981',
  delivering: colors.primary,
  delivered:  '#10B981',
  cancelled:  '#EF4444',
};

const ACTIVE_STATUSES = ['pending', 'received', 'awaiting_price', 'washing', 'drying', 'ready', 'delivering'];

// Normalize backend status strings
const normalize = (s) => {
  const raw = String(s || '').trim().toLowerCase().replace(/ /g, '_');
  const map = {
    received: 'received', pending: 'pending',
    awaiting_price: 'awaiting_price', awaiting_price_confirmation: 'awaiting_price',
    price_approved: 'washing',
    washing: 'washing', drying: 'drying', ready: 'ready',
    pending_pickup: 'ready', en_route_to_pickup: 'delivering',
    picked_up: 'delivering', in_transit: 'delivering', delivering: 'delivering',
    delivered: 'delivered', cancelled: 'cancelled', failed: 'cancelled',
  };
  return map[raw] || raw;
};

// ─── Active Order Card Component ──────────────────────────────────────────────
function ActiveOrderCard({ order, navigation }) {
  const [status, setStatus] = useState(normalize(order.status));

  // Real-time Firestore listener
  React.useEffect(() => {
    const tn = order.trackingNumber || String(order.id);
    const unsub = onSnapshot(
      doc(db, 'orders', tn),
      snap => {
        if (snap.exists()) {
          const raw = (snap.data().status || '').toLowerCase();
          const mapped = normalize(raw);
          if (mapped) setStatus(mapped);
        }
      },
      err => console.warn('[HomeScreen] Firestore:', err.message)
    );
    return () => unsub();
  }, [order.trackingNumber, order.id]);

  const stepIdx   = STATUS_STEPS.indexOf(status);
  const displayStatus = STATUS_DISPLAY[status] || status.replace(/_/g, ' ');
  const dotColor  = STATUS_COLOR[status] || colors.primary;
  const isActive  = ACTIVE_STATUSES.includes(status);

  return (
    <View style={activeCardStyles.card}>
      {/* Top row: ACTIVE badge + Track Live */}
      <View style={activeCardStyles.topRow}>
        <View style={activeCardStyles.activeBadge}>
          <View style={[activeCardStyles.activeDot, { backgroundColor: dotColor }]} />
          <Text style={[activeCardStyles.activeBadgeText, { color: dotColor }]}>
            {isActive ? 'ACTIVE' : status.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          style={activeCardStyles.trackLiveBtn}
          onPress={() => navigation.navigate('Tracking', { orderId: order.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={14} color="#fff" />
          <Text style={activeCardStyles.trackLiveTxt}>Track Live</Text>
        </TouchableOpacity>
      </View>

      {/* Status label + Order number */}
      <Text style={activeCardStyles.statusLabel}>{displayStatus}</Text>
      <Text style={activeCardStyles.orderNum}>
        Order #{order.trackingNumber || order.id}
      </Text>

      {/* 5-step progress bar */}
      <View style={activeCardStyles.stepsRow}>
        {STATUS_STEPS.map((step, i) => {
          const done   = i < stepIdx;
          const active = i === stepIdx;
          return (
            <View key={step} style={activeCardStyles.stepItem}>
              <View style={activeCardStyles.stepDotWrap}>
                {i > 0 && (
                  <View style={[
                    activeCardStyles.stepLine,
                    done || active ? activeCardStyles.stepLineDone : activeCardStyles.stepLineOff,
                  ]} />
                )}
                <View style={[
                  activeCardStyles.stepDot,
                  done   && activeCardStyles.stepDotDone,
                  active && { ...activeCardStyles.stepDotDone, backgroundColor: '#1C2F3E', width: 16, height: 16, borderRadius: 8 },
                ]} />
              </View>
              <Text style={[
                activeCardStyles.stepLabel,
                active && activeCardStyles.stepLabelActive,
              ]}>
                {STATUS_STEP_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>

      {/* View Details button */}
      <TouchableOpacity
        style={activeCardStyles.detailsBtn}
        onPress={() => navigation.navigate('Orders', { screen: 'OrderDetail', params: { orderId: order.id } })}
        activeOpacity={0.85}
      >
        <Ionicons name="document-text-outline" size={16} color={colors.text} />
        <Text style={activeCardStyles.detailsBtnTxt}>View Details</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading]     = useState(true);
  const [activeOrders, setActive] = useState([]);
  const [branchTab, setBranchTab] = useState('speedywash');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 850, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await bookingsApi.getMyBookings('all');
      const all = res.bookings || [];
      const active = all.filter(o => ACTIVE_STATUSES.includes(normalize(o.status)));
      setActive(active.slice(0, 3));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const firstName    = user?.fullName?.split(' ')[0] || 'there';
  const activeBranches = branchTab === 'laundryhubs' ? LAUNDRYHUBS : SPEEDYWASH;

  const renderServiceCard = ({ item }) => (
    <TouchableOpacity style={S.svcCard} activeOpacity={0.82} onPress={() => navigation.navigate('Book')}>
      <Image source={item.img} style={S.svcImg} resizeMode="cover" />
      <View style={S.svcBottom}>
        <View style={S.svcTagRow}>
          {item.tag ? (
            <View style={[S.svcTag, { backgroundColor: item.tagBg }]}>
              <Text style={[S.svcTagTxt, { color: item.tagColor }]}>{item.tag}</Text>
            </View>
          ) : null}
          <View style={S.svcArrowBtn}>
            <Ionicons name="arrow-up-outline" size={13} color={colors.accent}
              style={{ transform: [{ rotate: '45deg' }] }} />
          </View>
        </View>
        <Text style={S.svcPrice}>{item.price}</Text>
        <Text style={S.svcName}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderBranchItem = (item, idx) => (
    <View key={item.id} style={S.branchItem}>
      <View style={S.branchNumBox}>
        <Text style={S.branchNum}>{idx + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.branchName}>{item.name}</Text>
        <Text style={S.branchAddr}>{item.address}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={S.container} edges={['top']}>
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Image source={require('../../../assets/images/icon.png')} style={S.headerLogo} resizeMode="contain" />
            <Text style={S.headerTitle}>WashAlert</Text>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <LoadingSkeleton width="100%" height={200} count={1} />
          </View>
          <View style={S.bodySheet}>
            <LoadingSkeleton width="100%" height={120} count={2} gap={14} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.container} edges={['top']}>

      {/* HEADER */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <Image source={require('../../../assets/images/icon.png')} style={S.headerLogo} resizeMode="contain" />
          <Text style={S.headerTitle}>WashAlert</Text>
        </View>
        <View style={S.headerRight}>
          <TouchableOpacity style={S.iconBtn} onPress={() => navigation.navigate('Chat')}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={S.scroll}>

        {/* ── Hero Card (Services) ─────────────────────────────────────── */}
        <View style={S.heroCard}>
          <View style={S.greetPad}>
            <Text style={S.greetLine1}>
              {'Hi '}
              <Text style={S.greetName}>{firstName}</Text>
              {', '}<Text style={S.greetAccent}>{"Here's"}</Text>
            </Text>
            <Text style={S.greetTitle}>Our Laundry Services.</Text>
          </View>

          <FlatList
            data={SERVICES}
            renderItem={renderServiceCard}
            keyExtractor={i => i.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.svcList}
            ListFooterComponent={
              <TouchableOpacity style={S.svcSeeAll} activeOpacity={0.8} onPress={() => navigation.navigate('Book')}>
                <Ionicons name="arrow-forward" size={22} color={colors.primary} />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={S.servicesDetailBtn}
            onPress={() => navigation.navigate('Services')}
            activeOpacity={0.85}
          >
            <Ionicons name="list-outline" size={15} color={colors.primary} />
            <Text style={S.servicesDetailBtnTxt}>View Package Details & Inclusions</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Body Sheet ───────────────────────────────────────────────── */}
        <View style={S.bodySheet}>

          {/* ── Active Orders Section ──────────────────────────────────── */}
          {activeOrders.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 }}>Active Orders</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>See all</Text>
                </TouchableOpacity>
              </View>
              {activeOrders.map(order => (
                <ActiveOrderCard key={order.id} order={order} navigation={navigation} />
              ))}
            </View>
          )}

          {/* ── Our Branches ───────────────────────────────────────────── */}
          <View style={S.branchesWrap}>
            <View style={S.sectionRow}>
              <Text style={S.sectionTitle}>Our Branches</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={12} color={colors.success} />
                <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>7AM – 10PM</Text>
              </View>
            </View>

            <View style={S.branchTabs}>
              {[
                { key: 'speedywash',  label: 'Speedywash (9)'  },
                { key: 'laundryhubs', label: 'Laundryhubs (1)' },
              ].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[S.branchTab, branchTab === t.key && S.branchTabActive]}
                  onPress={() => setBranchTab(t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[S.branchTabTxt, branchTab === t.key && S.branchTabTxtActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={S.brandBar}>
              <Image
                source={
                  branchTab === 'laundryhubs'
                    ? require('../../../assets/images/logo-laundryhubs.webp')
                    : require('../../../assets/images/logo-speedywash.webp')
                }
                style={S.brandLogo}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={S.brandName}>
                  {branchTab === 'laundryhubs' ? 'Triplets Laundryhubs' : 'Triplets Speedywash'}
                </Text>
                <Text style={S.brandMeta}>
                  {branchTab === 'laundryhubs' ? '1 Branch · Makati City' : '9 Branches · Metro Manila & Rizal'}
                </Text>
                <Text style={S.brandHours}>● Open Daily 7AM – 10PM</Text>
              </View>
            </View>

            {activeBranches.map((b, i) => renderBranchItem(b, i))}
          </View>

          {/* Refresh */}
          <TouchableOpacity style={S.refreshRow} onPress={loadData}>
            <MaterialCommunityIcons name="refresh" size={14} color={colors.textTertiary} />
            <Text style={S.refreshTxt}>Refresh</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Active Order Card Styles ─────────────────────────────────────────────────
import { StyleSheet } from 'react-native';
const activeCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    gap: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  trackLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2F3E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 6,
  },
  trackLiveTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  statusLabel: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C2F3E',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  orderNum: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 18,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    marginBottom: 6,
  },
  stepLine: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: '50%',
    top: 6,
  },
  stepLineDone: { backgroundColor: '#1C2F3E' },
  stepLineOff:  { backgroundColor: '#D1D5DB' },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D1D5DB',
    zIndex: 1,
  },
  stepDotDone: {
    backgroundColor: '#1C2F3E',
  },
  stepLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#1C2F3E',
    fontWeight: '700',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#1C2F3E',
    borderRadius: 100,
    paddingVertical: 13,
  },
  detailsBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2F3E',
  },
});