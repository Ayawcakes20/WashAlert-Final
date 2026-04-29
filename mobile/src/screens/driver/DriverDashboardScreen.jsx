import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { deliveries as deliveriesApi } from '../../services/api';

const STATUS_CONFIG = {
  accepted:           { label: 'Heading to Pickup',  color: '#3B82F6', bg: 'hsla(214,88%,57%,0.12)' },
  at_customer:        { label: 'At Customer',        color: '#F59E0B', bg: 'hsla(38,96%,58%,0.12)'  },
  picked_up:          { label: 'Picked Up',          color: colors.accent, bg: colors.accentLight    },
  at_branch:          { label: 'At Branch',          color: '#7C3AED', bg: 'hsla(263,70%,58%,0.12)' },
  handed_over:        { label: 'Handed Over',        color: '#7C3AED', bg: 'hsla(263,70%,58%,0.12)' },
  ready_for_dispatch: { label: 'Ready to Deliver',   color: colors.success, bg: colors.successLight  },
  en_route:           { label: 'Out for Delivery',   color: '#3B82F6', bg: 'hsla(214,88%,57%,0.12)' },
  at_delivery:        { label: 'At Customer',        color: '#F59E0B', bg: 'hsla(38,96%,58%,0.12)'  },
  pending:            { label: 'New Order',          color: colors.warning, bg: colors.warningLight  },
  in_progress:        { label: 'In Transit',         color: colors.primary, bg: colors.primaryLight  },
  completed:          { label: 'Completed',          color: colors.success, bg: colors.successLight  },
  failed:             { label: 'Failed',             color: colors.error, bg: colors.errorLight      },
};
const getCfg = (s) => STATUS_CONFIG[s] || { label: s, color: colors.textSecondary, bg: colors.surfaceVariant };

const ACTIVE_STATUSES = ['accepted','at_customer','picked_up','at_branch','handed_over','ready_for_dispatch','en_route','at_delivery','in_progress'];

export default function DriverDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const firstName = user?.fullName?.split(' ')[0] || 'Driver';

  const loadData = useCallback(async () => {
    try {
      setError('');
      const data = await deliveriesApi.getAssigned('all');
      setDeliveries(data.deliveries || []);
    } catch (e) {
      setDeliveries([]);
      setError(e?.message || 'Unable to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 850, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: true }),
        ])
      ).start();
      const poll = setInterval(loadData, 30000);
      return () => clearInterval(poll);
    }, [loadData])
  );

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const pending   = deliveries.filter(d => d.status === 'pending').length;
  const completed = deliveries.filter(d => d.status === 'completed').length;
  const active    = deliveries.find(d => ACTIVE_STATUSES.includes(d.status));

  return (
    <SafeAreaView style={S.container} edges={['top']}>

      {/* ══ HEADER — Logo · WashAlert · Notifications ══════════════════════ */}
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
          <TouchableOpacity style={S.iconBtn} onPress={() => navigation.navigate('Chat')}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={() => navigation.navigate('DriverNotifications')}>
            <Ionicons name="notifications-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ SCROLL — hero card + body sheet ════════════════════════════════ */}
      <ScrollView
        style={S.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >

        {/* ── Hero white card ─────────────────────────────────────────────── */}
        <View style={S.heroCard}>
          <View style={S.greetPad}>
            <Text style={S.greetLine}>
              {'Hi '}<Text style={S.greetName}>{firstName}</Text>
              {', '}<Text style={S.greetAccent}>Here's</Text>
            </Text>
            <Text style={S.greetTitle}>Your Delivery Dashboard.</Text>
            {error ? <Text style={S.errorTxt}>{error}</Text> : null}
          </View>

          {/* Summary tiles inside hero card */}
          <View style={S.tilesRow}>
            <View style={[S.tile, { borderTopColor: colors.primary }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} />
              <Text style={[S.tileValue, { color: colors.primary }]}>{deliveries.length}</Text>
              <Text style={S.tileLabel}>Total</Text>
            </View>
            <View style={[S.tile, { borderTopColor: colors.success }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
              <Text style={[S.tileValue, { color: colors.success }]}>{completed}</Text>
              <Text style={S.tileLabel}>Done</Text>
            </View>
            <View style={[S.tile, { borderTopColor: colors.warning }]}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={colors.warning} />
              <Text style={[S.tileValue, { color: colors.warning }]}>{pending}</Text>
              <Text style={S.tileLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* ── Body sheet (light bg) ────────────────────────────────────────── */}
        <View style={S.bodySheet}>

          {/* Active Delivery ─────────────────────────────────────────────── */}
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Active Delivery</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
              <Text style={S.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {active ? (
            <View style={S.activeCard}>
              <View style={[S.activeStrip, { backgroundColor: getCfg(active.status).color }]} />
              <View style={S.activeBody}>
                <View style={S.activeTopRow}>
                  <View style={[S.activeBadge, { backgroundColor: getCfg(active.status).bg }]}>
                    <Animated.View style={[S.activeDot, { backgroundColor: getCfg(active.status).color, transform: [{ scale: pulseAnim }] }]} />
                    <Text style={[S.activeBadgeTxt, { color: getCfg(active.status).color }]}>
                      {getCfg(active.status).label.toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={S.resumeBtn}
                    onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: active.id })}
                  >
                    <Text style={S.resumeBtnTxt}>Resume</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Text style={S.activeCustomer}>{active.customerName}</Text>
                <View style={S.addrRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={S.addrTxt} numberOfLines={2}>{active.deliveryAddress}</Text>
                </View>
              </View>
            </View>
          ) : pending > 0 ? (
            <TouchableOpacity
              style={[S.activeCard, { marginBottom: 24 }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Deliveries')}
            >
              <View style={[S.activeStrip, { backgroundColor: colors.warning }]} />
              <View style={S.activeBody}>
                <View style={S.activeTopRow}>
                  <View style={[S.activeBadge, { backgroundColor: colors.warningLight }]}>
                    <Ionicons name="notifications" size={12} color={colors.warning} />
                    <Text style={[S.activeBadgeTxt, { color: colors.warning }]}>
                      {pending} NEW ORDER{pending > 1 ? 'S' : ''}
                    </Text>
                  </View>
                  <View style={[S.resumeBtn, { backgroundColor: colors.warning }]}>
                    <Text style={S.resumeBtnTxt}>View</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </View>
                </View>
                <Text style={S.activeCustomer}>Tap to view & accept orders</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[S.activeCard, { marginBottom: 24 }]}>
              <View style={S.activeBody}>
                <View style={S.emptyBox}>
                  <MaterialCommunityIcons name="truck-check-outline" size={36} color={colors.border} />
                  <Text style={S.emptyTxt}>No active delivery</Text>
                  <Text style={S.emptyDesc}>Check Deliveries for new assignments</Text>
                </View>
              </View>
            </View>
          )}

          {/* Today's Deliveries list ──────────────────────────────────────── */}
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Today's Deliveries</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
              <Text style={S.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {!deliveries.length ? (
            <View style={S.emptyCard}>
              <MaterialCommunityIcons name="truck-outline" size={36} color={colors.border} />
              <Text style={S.emptyTxt}>All clear!</Text>
              <Text style={S.emptyDesc}>No deliveries assigned for today.</Text>
            </View>
          ) : (
            deliveries.slice(0, 5).map(item => {
              const cfg = getCfg(item.status);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[S.deliveryCard, { borderLeftColor: cfg.color }]}
                  onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: item.id })}
                  activeOpacity={0.75}
                >
                  <View style={S.deliveryTop}>
                    <Text style={S.customerName} numberOfLines={1}>{item.customerName}</Text>
                    <View style={[S.statusPill, { backgroundColor: cfg.bg }]}>
                      <View style={[S.statusDot, { backgroundColor: cfg.color }]} />
                      <Text style={[S.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <View style={S.addrRow}>
                    <Ionicons name="map-outline" size={12} color={colors.textSecondary} />
                    <Text style={S.addrTxt} numberOfLines={1}>
                      {item.leg === 'PICKUP_FROM_CUSTOMER' ? `Pickup: ${item.customerName}` : `Deliver: ${item.deliveryAddress}`}
                    </Text>
                  </View>
                  <View style={S.cardFooter}>
                    <Text style={S.cardFooterTxt}>View details</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Refresh */}
          <TouchableOpacity style={S.refreshRow} onPress={onRefresh}>
            <MaterialCommunityIcons name="refresh" size={14} color={colors.textTertiary} />
            <Text style={S.refreshTxt}>Refresh</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerLogo: { width: 36, height: 36, borderRadius: 18 },
  headerTitle: { fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  // Scroll
  scroll: { flex: 1, backgroundColor: colors.primary },

  // Hero card
  heroCard: {
    marginHorizontal: 16, borderRadius: 26,
    backgroundColor: colors.surface,
    paddingTop: 20, paddingBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  greetPad: { paddingHorizontal: 20, marginBottom: 16 },
  greetLine: { fontSize: 16, fontWeight: '600', color: colors.text },
  greetName: { fontWeight: '800', color: colors.text },
  greetAccent: { color: colors.accent, fontWeight: '700' },
  greetTitle: { fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.4, marginTop: 3, lineHeight: 26 },
  errorTxt: { fontSize: 12, color: colors.error, marginTop: 6, fontWeight: '500' },

  // Summary tiles
  tilesRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  tile: {
    flex: 1, backgroundColor: colors.background, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderTopWidth: 3,
  },
  tileValue: { fontSize: 20, fontWeight: '900' },
  tileLabel: { fontSize: 10, fontWeight: '600', color: colors.textTertiary },

  // Body sheet
  bodySheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    marginTop: 18, paddingHorizontal: 20,
    paddingTop: 24, paddingBottom: 110, minHeight: 400,
  },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  seeAll: { fontSize: 13, color: colors.accent, fontWeight: '700' },

  // Active card
  activeCard: {
    borderRadius: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, marginBottom: 24,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden',
  },
  activeStrip: { height: 4 },
  activeBody: { padding: 16 },
  activeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  activeBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  resumeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, paddingHorizontal: 13,
    paddingVertical: 6, borderRadius: 20,
  },
  resumeBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  activeCustomer: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  addrTxt: { fontSize: 12, color: colors.textSecondary, fontWeight: '500', flex: 1 },

  // Delivery card
  deliveryCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4,
  },
  deliveryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  customerName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, paddingRight: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusTxt: { fontSize: 10, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  cardFooterTxt: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },

  // Empty
  emptyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 6, marginBottom: 24 },
  emptyBox: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  emptyTxt: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  emptyDesc: { fontSize: 12, color: colors.textTertiary, fontWeight: '500', textAlign: 'center' },

  // Refresh
  refreshRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  refreshTxt: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
});
