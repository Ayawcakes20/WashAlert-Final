import React, { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Card, Button, LoadingSkeleton, EmptyState, StatusBadge } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { branches as branchesApi, bookings as bookingsApi } from '../../services/api';
import { typography } from '../../theme/typography';

const { width, height } = Dimensions.get('window');

const QUICK_ACTIONS = [
  {
    id: 'wash-dry',
    label: 'Wash & Dry',
    icon: 'washing-machine',
    screen: 'Book',
    params: { serviceId: 'wash-dry' },
    iconColor: '#FFFFFF',
    gradientA: '#2563EB',
    gradientB: '#3B82F6',
  },
  {
    id: 'wash-fold',
    label: 'Wash & Fold',
    icon: 'tshirt-crew-outline',
    screen: 'Book',
    params: { serviceId: 'wash-fold' },
    iconColor: '#FFFFFF',
    gradientA: '#10B981',
    gradientB: '#34D399',
  },
  {
    id: 'support',
    label: 'Support',
    icon: 'chat-processing-outline',
    screen: 'Chat',
    params: {},
    iconColor: '#FFFFFF',
    gradientA: '#0EA5E9',
    gradientB: '#38BDF8',
  },
  {
    id: 'updates',
    label: 'Notifications',
    icon: 'bell-ring-outline',
    screen: 'Notifications',
    params: {},
    iconColor: '#FFFFFF',
    gradientA: '#F59E0B',
    gradientB: '#FCD34D',
  },
];

const STATUS_STEPS = ['pending', 'received', 'washing', 'drying', 'ready'];
const STATUS_LABELS = {
  pending: 'Pending Confirmation',
  received: 'Order Received',
  washing: 'Washing in Progress',
  drying: 'Drying',
  ready: 'Ready for Pickup / Delivery',
};

const STATUS_COLOR = {
  pending: colors.warning,
  received: colors.info,
  washing: colors.accent,
  drying: colors.accent,
  ready: colors.success,
  delivering: colors.primary,
  delivered: colors.success,
  completed: colors.success,
  cancelled: colors.error,
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      startPulse();
    }, [])
  );

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [branchesRes, ordersRes] = await Promise.all([
        branchesApi.getAll(),
        bookingsApi.getMyBookings('all'),
      ]);
      setBranches(branchesRes.branches || []);
      const allOrders = ordersRes.bookings || [];
      setRecentOrders(allOrders.slice(0, 3));
      const active = allOrders.find(
        (order) => ['pending', 'received', 'washing', 'drying', 'ready', 'delivering'].includes(order.status)
      );
      setActiveOrder(active || null);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => loadData();

  const getStatusProgress = (status) => {
    const idx = STATUS_STEPS.indexOf(status);
    return idx >= 0 ? (idx + 1) / STATUS_STEPS.length : 0;
  };

  const renderBranchCard = ({ item }) => (
    <TouchableOpacity
      style={styles.branchCard}
      activeOpacity={0.8}
      onPress={() => {}}
    >
      <View style={styles.branchIconBox}>
        <MaterialCommunityIcons name="store-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.branchName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.branchCity} numberOfLines={1}>{item.city}</Text>
      </View>
      <View style={styles.distancePill}>
        <MaterialCommunityIcons name="map-marker" size={11} color={colors.warning} />
        <Text style={styles.distanceText}>{item.distance} km</Text>
      </View>
    </TouchableOpacity>
  );

  const renderOrderCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      activeOpacity={0.75}
      style={styles.orderCard}
    >
      <View style={[styles.orderStatusBar, { backgroundColor: STATUS_COLOR[item.status] || colors.border }]} />
      <View style={styles.orderCardInner}>
        <View style={styles.orderCardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId} numberOfLines={1}>{item.id}</Text>
            <Text style={styles.orderDate}>{item.date}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.orderCardFooter}>
          <Text style={styles.orderAmount}>₱{item.amount}</Text>
          <View style={styles.orderChevron}>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.heroBanner}>
          <LoadingSkeleton width="60%" height={28} count={1} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LoadingSkeleton width="100%" height={130} count={3} gap={16} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <View style={styles.heroBanner}>
        <View style={styles.heroLeft}>
          <Image
            source={require('../../../assets/images/icon.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.heroGreeting}>{getGreeting()}, {user?.fullName?.split(' ')[0] || 'Customer'} 👋</Text>
            <Text style={styles.heroSub}>Ready for fresh clean laundry?</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Active Order Banner ───────────────────────────────────────── */}
        {activeOrder ? (
          <View style={styles.activeOrderCard}>
            {/* Gradient-like top strip */}
            <View style={styles.activeOrderStrip} />

            <View style={styles.activeOrderBody}>
              <View style={styles.activeOrderTopRow}>
                <View style={styles.activeOrderBadge}>
                  <Animated.View style={[styles.activeDot, { transform: [{ scale: pulseAnim }] }]} />
                  <Text style={styles.activeOrderBadgeText}>ACTIVE ORDER</Text>
                </View>
                <TouchableOpacity
                  style={styles.trackBtn}
                  onPress={() => navigation.navigate('Tracking', { orderId: activeOrder.id })}
                >
                  <Ionicons name="navigate" size={12} color="#FFF" />
                  <Text style={styles.trackBtnText}>Track Live</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.activeOrderId}>{activeOrder.id}</Text>
              <Text style={styles.activeOrderStatus}>
                {STATUS_LABELS[activeOrder.status] || activeOrder.status}
              </Text>

              {/* Progress steps */}
              <View style={styles.progressRow}>
                {STATUS_STEPS.map((s, i) => {
                  const idx = STATUS_STEPS.indexOf(activeOrder.status);
                  const done = i < idx;
                  const current = i === idx;
                  return (
                    <React.Fragment key={s}>
                      <View style={[
                        styles.stepDot,
                        (done || current) && styles.stepDotActive,
                        current && styles.stepDotCurrent,
                      ]}>
                        {done && <Ionicons name="checkmark" size={8} color="#FFF" />}
                      </View>
                      {i < STATUS_STEPS.length - 1 && (
                        <View style={[styles.stepLine, done && styles.stepLineActive]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={styles.progressLabels}>
                {STATUS_STEPS.map((s, i) => (
                  <Text key={s} style={[
                    styles.progressStep,
                    STATUS_STEPS.indexOf(activeOrder.status) >= i && styles.progressStepActive,
                  ]} numberOfLines={1}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                ))}
              </View>

              <View style={styles.activeOrderActions}>
                <TouchableOpacity
                  style={styles.actionPillOutline}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: activeOrder.id })}
                >
                  <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                  <Text style={styles.actionPillOutlineText}>View Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionPillOutline}
                  onPress={() => navigation.navigate('Chat')}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
                  <Text style={styles.actionPillOutlineText}>Chat Support</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionTile}
              onPress={() => navigation.navigate(action.screen, action.params)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: action.gradientA }]}>
                <MaterialCommunityIcons name={action.icon} size={26} color={action.iconColor} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Nearby Branches ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Branches</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {branches.length > 0 ? (
            <FlatList
              data={branches.slice(0, 3)}
              renderItem={renderBranchCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
          ) : (
            <EmptyState title="No branches found" />
          )}
        </View>

        {/* ── Recent Orders ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentOrders.length > 0 ? (
            <FlatList
              data={recentOrders}
              renderItem={renderOrderCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
          ) : (
            <EmptyState
              icon="shopping-outline"
              title="No orders yet"
              description="Book your first laundry service today!"
              actionButton={
                <Button title="Book Now" onPress={() => navigation.navigate('Book')} size="sm" />
              }
            />
          )}
        </View>

        <TouchableOpacity style={styles.refreshRow} onPress={handleRefresh}>
          <MaterialCommunityIcons name="refresh" size={15} color={colors.textTertiary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── Hero Header ──────────────────────────────────────────────────────────
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  heroGreeting: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
    fontWeight: '500',
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },

  // ── Active Order Card ────────────────────────────────────────────────────
  activeOrderCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeOrderStrip: {
    height: 4,
    backgroundColor: colors.primary,
  },
  activeOrderBody: {
    padding: 18,
  },
  activeOrderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeOrderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  trackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  activeOrderId: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  activeOrderStatus: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    fontWeight: '500',
  },

  // Step progress dots
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressStep: {
    fontSize: 9,
    color: colors.textTertiary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  progressStepActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  activeOrderActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionPillOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
  },
  actionPillOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // ── Quick Actions ────────────────────────────────────────────────────────
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionTile: {
    width: (width - 52) / 4,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },

  // ── Sections ─────────────────────────────────────────────────────────────
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },

  // ── Branch Card ───────────────────────────────────────────────────────────
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  branchIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  branchCity: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  distanceText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '700',
  },

  // ── Order Card ────────────────────────────────────────────────────────────
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderStatusBar: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  orderCardInner: {
    flex: 1,
    padding: 14,
  },
  orderCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderId: { fontSize: 14, fontWeight: '700', color: colors.text },
  orderDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderAmount: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 },
  orderChevron: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Refresh ───────────────────────────────────────────────────────────────
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  refreshText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
  },
});

export default HomeScreen;