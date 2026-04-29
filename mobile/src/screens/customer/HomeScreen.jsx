import React, { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, FlatList,
  TouchableOpacity, Image, Animated,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { StatusBadge, Button, LoadingSkeleton } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { bookings as bookingsApi } from '../../services/api';
import S from './HomeScreenStyles';

// ─── Static Service Data (6 unique images, no repeats) ───────────────────────
const SERVICES = [
  { id: 'w7',  img: require('../../../assets/images/svc_wash_v3.png'),   tag: 'Standard', tagColor: '#2E86C1', tagBg: '#D6EAF8', price: '₱80 / 7kg',  name: 'Wash'         },
  { id: 'd7',  img: require('../../../assets/images/svc_dry_v3.png'),    tag: 'Standard', tagColor: '#E11D48', tagBg: '#FFF1F2', price: '₱90 / 7kg',  name: 'Dry'          },
  { id: 'eco', img: require('../../../assets/images/svc_wash.png'),        tag: 'Eco',      tagColor: '#059669', tagBg: '#D1FAE5', price: '₱220 / 5kg', name: 'Ecowash Full' },
  { id: 'b7',  img: require('../../../assets/images/svc_fullservice.png'), tag: 'Basic',    tagColor: '#7C3AED', tagBg: '#F5F3FF', price: '₱240 / 7kg', name: 'Basic Full'   },
  { id: 'p7',  img: require('../../../assets/images/svc_dry.png'),         tag: 'Premium',  tagColor: '#EA580C', tagBg: '#FFF7ED', price: '₱270 / 7kg', name: 'Premium Full' },
  { id: 'hw',  img: require('../../../assets/images/svc_handwash.png'),    tag: 'Hand',     tagColor: '#1C2F3E', tagBg: '#E8EFF4', price: '₱150/kg',    name: 'Handwash'     },
];

// ─── Branch Data ─────────────────────────────────────────────────────────────
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

// ─── Order Helpers ────────────────────────────────────────────────────────────
const STATUS_STEPS = ['pending', 'received', 'washing', 'drying', 'ready'];
const STATUS_LABELS = {
  pending: 'Pending Confirmation', received: 'Order Received',
  washing: 'Washing in Progress',  drying:   'Drying in Progress',
  ready:   'Ready for Pickup / Delivery', delivering: 'Out for Delivery',
};
const STATUS_COLOR = {
  pending: colors.warning,  received: colors.info,
  washing: colors.accent,   drying:   colors.accent,
  ready:   colors.success,  delivering: colors.primary,
  delivered: colors.success, completed: colors.success, cancelled: colors.error,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading]     = useState(true);
  const [activeOrder, setActive]  = useState(null);
  const [branchTab, setBranchTab] = useState('speedywash');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 850, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: true }),
        ])
      ).start();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await bookingsApi.getMyBookings('all');
      const all = res.bookings || [];
      setActive(
        all.find(o => ['pending','received','washing','drying','ready','delivering'].includes(o.status)) || null
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const activeBranches = branchTab === 'laundryhubs' ? LAUNDRYHUBS : SPEEDYWASH;

  // ── Renders ───────────────────────────────────────────────────────────────
  const renderServiceCard = ({ item }) => (
    <TouchableOpacity style={S.svcCard} activeOpacity={0.82} onPress={() => navigation.navigate('Book')}>
      <Image source={item.img} style={S.svcImg} resizeMode="cover" />
      <View style={S.svcBottom}>
        <View style={S.svcTagRow}>
          <View style={[S.svcTag, { backgroundColor: item.tagBg }]}>
            <Text style={[S.svcTagTxt, { color: item.tagColor }]}>{item.tag}</Text>
          </View>
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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={S.container} edges={['top']}>
        {/* Header skeleton */}
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

  // ── Main Layout ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={S.container} edges={['top']}>

      {/* ══ HEADER — ONLY: Logo · WashAlert · IkoTask(Chat) · Bell ══════════ */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <Image
            source={require('../../../assets/images/icon.png')}
            style={S.headerLogo}
            resizeMode="contain"
          />
          <Text style={S.headerTitle}>WashAlert</Text>
        </View>
        <View style={S.headerRight}>
          {/* IkoTask icon → Chat */}
          <TouchableOpacity style={S.iconBtn} onPress={() => navigation.navigate('Chat')}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          </TouchableOpacity>
          {/* Notification bell */}
          <TouchableOpacity style={S.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ SCROLL BODY — everything below header scrolls ═══════════════════ */}
      <ScrollView showsVerticalScrollIndicator={false} style={S.scroll}>

        {/* ── Hero white card (on dark navy bg) ─────────────────────────── */}
        <View style={S.heroCard}>

          {/* "Hi [Name], Here's / Our Laundry Services." */}
          <View style={S.greetPad}>
            <Text style={S.greetLine1}>
              {'Hi '}
              <Text style={S.greetName}>{firstName}</Text>
              {', '}<Text style={S.greetAccent}>Here's</Text>
            </Text>
            <Text style={S.greetTitle}>Our Laundry Services.</Text>
          </View>

          {/* Service price cards — horizontal scroll */}
          <FlatList
            data={SERVICES}
            renderItem={renderServiceCard}
            keyExtractor={i => i.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.svcList}
            ListFooterComponent={
              <TouchableOpacity
                style={S.svcSeeAll}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Book')}
              >
                <Ionicons name="arrow-forward" size={22} color={colors.primary} />
              </TouchableOpacity>
            }
          />
        </View>

        {/* ── Body sheet (light bg, rounded top) ────────────────────────── */}
        <View style={S.bodySheet}>

          {/* Active Orders ─────────────────────────────────────────────── */}
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Active Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
              <Text style={S.seeAllTxt}>See all</Text>
            </TouchableOpacity>
          </View>

          {activeOrder ? (
            <View style={S.activeCard}>
              <View style={S.activeStrip} />
              <View style={S.activeBody}>
                <View style={S.activeTopRow}>
                  <View style={S.activeBadge}>
                    <Animated.View style={[S.activeDot, { transform: [{ scale: pulseAnim }] }]} />
                    <Text style={S.activeBadgeTxt}>ACTIVE</Text>
                  </View>
                  <TouchableOpacity
                    style={S.trackBtn}
                    onPress={() => navigation.navigate('Tracking', { orderId: activeOrder.id })}
                  >
                    <Ionicons name="navigate" size={12} color="#fff" />
                    <Text style={S.trackBtnTxt}>Track Live</Text>
                  </TouchableOpacity>
                </View>

                <Text style={S.activeHeadline}>
                  {STATUS_LABELS[activeOrder.status] || 'Order in Progress'}
                </Text>
                <Text style={S.activeSubline}>Order #{activeOrder.id}</Text>

                <View style={S.progressRow}>
                  {STATUS_STEPS.map((s, i) => {
                    const idx = STATUS_STEPS.indexOf(activeOrder.status);
                    const done = i < idx, cur = i === idx;
                    return (
                      <React.Fragment key={s}>
                        <View style={[S.stepDot, (done || cur) && S.stepDotActive, cur && S.stepDotCurrent]}>
                          {done && <Ionicons name="checkmark" size={8} color="#fff" />}
                        </View>
                        {i < STATUS_STEPS.length - 1 && (
                          <View style={[S.stepLine, done && S.stepLineActive]} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
                <View style={S.progressLabels}>
                  {STATUS_STEPS.map((s, i) => (
                    <Text key={s}
                      style={[S.progressLbl, STATUS_STEPS.indexOf(activeOrder.status) >= i && S.progressLblActive]}
                      numberOfLines={1}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  ))}
                </View>

                <TouchableOpacity
                  style={S.detailPill}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: activeOrder.id })}
                >
                  <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                  <Text style={S.detailPillTxt}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[S.activeCard, { marginBottom: 24 }]}>
              <View style={S.activeBody}>
                <View style={S.emptyBox}>
                  <MaterialCommunityIcons name="washing-machine" size={36} color={colors.border} />
                  <Text style={S.emptyTxt}>No active orders</Text>
                  <Text style={S.emptyDesc}>Book a laundry service to get started</Text>
                  <Button title="Book Now" onPress={() => navigation.navigate('Book')} size="sm" style={{ marginTop: 10 }} />
                </View>
              </View>
            </View>
          )}

          {/* Our Branches ──────────────────────────────────────────────── */}
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
        {/* end bodySheet */}

      </ScrollView>
    </SafeAreaView>
  );
}