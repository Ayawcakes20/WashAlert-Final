import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { deliveries as deliveriesApi } from '../../services/api';

const STATUS_CONFIG = {
  // Phase A — Inbound
  accepted:           { label: 'Heading to Pickup',  color: '#3B82F6',      bg: 'hsla(214,88%,57%,0.1)' },
  at_customer:        { label: 'At Customer',        color: '#F59E0B',      bg: 'hsla(38,96%,58%,0.1)' },
  picked_up:          { label: 'Picked Up',          color: colors.accent,  bg: colors.accentLight },
  at_branch:          { label: 'At Branch',          color: '#7C3AED',      bg: 'hsla(263,70%,58%,0.1)' },
  handed_over:        { label: 'Handed Over',        color: '#7C3AED',      bg: 'hsla(263,70%,58%,0.1)' },
  // Phase B — Outbound
  ready_for_dispatch: { label: 'Ready to Deliver',   color: colors.success, bg: colors.successLight },
  en_route:           { label: 'Out for Delivery',   color: '#3B82F6',      bg: 'hsla(214,88%,57%,0.1)' },
  at_delivery:        { label: 'At Customer',        color: '#F59E0B',      bg: 'hsla(38,96%,58%,0.1)' },
  // Generic
  pending:            { label: 'New Order',          color: colors.warning, bg: colors.warningLight },
  in_progress:        { label: 'In Transit',         color: colors.primary, bg: colors.primaryLight },
  completed:          { label: 'Completed',          color: colors.success, bg: colors.successLight },
  failed:             { label: 'Failed',             color: colors.error,   bg: colors.errorLight },
};

const getStatusCfg = (status) =>
  STATUS_CONFIG[status] || { label: status, color: colors.textSecondary, bg: colors.surfaceVariant };

const DriverDashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [visibleDeliveries, setVisibleDeliveries] = useState(4);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Driver';

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [assignedResult, availableResult] = await Promise.allSettled([
        deliveriesApi.getAssigned('all'),
        deliveriesApi.getAvailable(),
      ]);

      const assignedData = assignedResult.status === 'fulfilled' ? assignedResult.value : { deliveries: [] };
      const availableData = availableResult.status === 'fulfilled' ? availableResult.value : { orders: [] };

      setDeliveries(assignedData?.deliveries || []);
      setAvailableCount((availableData?.orders || []).length);
      setVisibleDeliveries(4);

      if (assignedResult.status === 'rejected') {
        throw assignedResult.reason;
      }
    } catch (e) {
      setDeliveries([]);
      setAvailableCount(0);
      setError(e?.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      // Poll every 30 s while screen is focused — catches new order assignments
      const poll = setInterval(loadData, 30000);
      return () => clearInterval(poll);
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setVisibleDeliveries(4);
    loadData();
  }, [loadData]);

  // All statuses that mean a delivery is actively in-flight
  const ACTIVE_STATUSES = ['accepted', 'at_customer', 'picked_up', 'at_branch', 'ready_for_dispatch', 'en_route', 'at_delivery', 'in_progress'];
  const pending   = availableCount;
  const completed = deliveries.filter((d) => d.status === 'completed').length;
  const active    = deliveries.find((d) => ACTIVE_STATUSES.includes(d.status));

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>{greeting} 👋</Text>
            <Text style={styles.nameText}>{firstName}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{firstName.charAt(0)}</Text>
          </View>
        </View>

        {/* ── Summary tiles ────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Today&apos;s Summary</Text>
        <View style={styles.tilesRow}>
          <View style={[styles.tile, styles.tilePrimary]}>
            <MaterialCommunityIcons name="package-variant-closed" size={22} color={colors.primary} />
            <Text style={styles.tileValue}>{deliveries.length}</Text>
            <Text style={styles.tileLabel}>Total</Text>
          </View>
          <View style={[styles.tile, styles.tileSuccess]}>
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.success} />
            <Text style={[styles.tileValue, { color: colors.success }]}>{completed}</Text>
            <Text style={styles.tileLabel}>Done</Text>
          </View>
          <View style={[styles.tile, styles.tilePending]}>
            <MaterialCommunityIcons name="clock-outline" size={22} color={colors.warning} />
            <Text style={[styles.tileValue, { color: colors.warning }]}>{pending}</Text>
            <Text style={styles.tileLabel}>Pending</Text>
          </View>
        </View>

        {/* ── Active delivery banner ───────────────────────────────────── */}
        {active ? (
          <View style={styles.activeBanner}>
            <View style={styles.activeBannerLeft}>
              <View style={styles.activePulse}>
                <View style={styles.activeDot} />
              </View>
              <View>
                <Text style={styles.activeBannerLabel}>
                  {getStatusCfg(active.status).label.toUpperCase()}
                </Text>
                <Text style={styles.activeBannerCustomer}>{active.customerName}</Text>
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.addressText} numberOfLines={1}>{active.deliveryAddress}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.goBtn}
              onPress={() => {
                if (!active?.id) return;
                navigation.navigate('DeliveryDetail', { deliveryId: active.id });
              }}
            >
              <Text style={styles.goBtnText}>Resume</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : pending > 0 ? (
          <TouchableOpacity
            style={[styles.activeBanner, styles.pendingBanner]}
            onPress={() => navigation.navigate('Deliveries')}
            activeOpacity={0.85}
          >
            <View style={styles.activeBannerLeft}>
              <View style={[styles.activePulse, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="notifications" size={14} color={colors.warning} />
              </View>
              <View>
                <Text style={[styles.activeBannerLabel, { color: colors.warning }]}>
                  {pending} NEW ORDER{pending > 1 ? 'S' : ''} AVAILABLE
                </Text>
                <Text style={styles.activeBannerCustomer}>Tap to view & accept</Text>
              </View>
            </View>
            <View style={[styles.goBtn, { backgroundColor: colors.warning }]}>
              <Text style={styles.goBtnText}>View</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* ── Today's deliveries list ──────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today&apos;s Deliveries</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {!deliveries.length ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="truck-check-outline" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptyMsg}>No deliveries assigned for today.</Text>
            </View>
          ) : (
            <>
              {deliveries.slice(0, visibleDeliveries).map((item) => {
                const cfg = getStatusCfg(item.status);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.deliveryCard, { borderLeftColor: cfg.color }]}
                    onPress={() => {
                      if (!item?.id) return;
                      navigation.navigate('DeliveryDetail', { deliveryId: item.id });
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.deliveryCardTop}>
                      <Text style={styles.customerName}>{item.customerName}</Text>
                      <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    <View style={styles.addressRow}>
                      <Ionicons name="map-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.addressText} numberOfLines={1}>
                        {item.leg === 'PICKUP_FROM_CUSTOMER' ? `Pickup: ${item.customerName}` : `Deliver: ${item.deliveryAddress}`}
                      </Text>
                    </View>
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardFooterText}>View details</Text>
                      <Ionicons name="chevron-forward" size={13} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                );
              })}
              {deliveries.length > visibleDeliveries ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setVisibleDeliveries((prev) => prev + 4)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loadMoreText}>Load More Deliveries</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: colors.textSecondary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greetingText: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  nameText: { fontSize: 24, fontWeight: '800', color: colors.text },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4 },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: colors.primary },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Summary tiles
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tilePrimary: { borderTopColor: colors.primary, borderTopWidth: 3 },
  tileSuccess:  { borderTopColor: colors.success, borderTopWidth: 3 },
  tilePending:  { borderTopColor: colors.warning, borderTopWidth: 3 },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  tileLabel: { fontSize: 10, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.2 },

  // Active delivery banner
  activeBanner: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingBanner: {
    borderLeftColor: colors.warning,
  },
  activeBannerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  activePulse: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  activeBannerLabel: { fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 0.5, marginBottom: 2 },
  activeBannerCustomer: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  addressText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  goBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Section
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.accent },

  // Empty
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyMsg: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  // Delivery card
  deliveryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  deliveryCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  customerName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, paddingRight: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardFooterText: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
  loadMoreBtn: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default DriverDashboardScreen;
