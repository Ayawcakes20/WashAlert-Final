import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Card, Button, LoadingSkeleton, EmptyState, StatusBadge } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { branches as branchesApi, bookings as bookingsApi } from '../../services/api';
import { typography } from '../../theme/typography';

const { width } = Dimensions.get('window');

const QUICK_ACTIONS = [
  {
    id: 'wash-dry',
    label: 'Wash & Dry',
    icon: 'washing-machine',
    screen: 'Book',
    params: { serviceId: 'wash-dry' },
    iconColor: colors.primary,
    iconBg: colors.primaryLight,
  },
  {
    id: 'wash-fold',
    label: 'Wash & Fold',
    icon: 'tshirt-crew-outline',
    screen: 'Book',
    params: { serviceId: 'wash-fold' },
    iconColor: colors.success,
    iconBg: colors.successLight,
  },
  {
    id: 'support',
    label: 'IkotAsk',
    icon: 'chat-processing-outline',
    screen: 'Chat',
    params: {},
    iconColor: colors.accent,
    iconBg: colors.accentLight,
  },
  {
    id: 'updates',
    label: 'Notifications',
    icon: 'bell-ring-outline',
    screen: 'Notifications',
    params: {},
    iconColor: colors.warning,
    iconBg: colors.warningLight,
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

const STATUS_BORDER_COLOR = {
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

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

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
        (order) => ['pending', 'received', 'washing', 'drying', 'ready'].includes(order.status)
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
    <Card style={styles.branchCard}>
      <View style={styles.branchRow}>
        <View style={styles.branchIconBox}>
          <MaterialCommunityIcons name="store-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.branchName}>{item.name}</Text>
          <Text style={styles.branchCity}>{item.city}</Text>
        </View>
        <View style={styles.distancePill}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.warning} />
          <Text style={styles.distanceText}>{item.distance} km</Text>
        </View>
      </View>
      <Text style={styles.branchAddress}>{item.address}</Text>
      <View style={styles.branchFooter}>
        <View style={styles.hoursRow}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.hoursText}>{item.hours}</Text>
        </View>
        <TouchableOpacity>
          <MaterialCommunityIcons name="phone-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderOrderCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      activeOpacity={0.7}
    >
      <View style={[styles.orderCard, { borderLeftColor: STATUS_BORDER_COLOR[item.status] || colors.border }]}>
        <View style={styles.orderCardRow}>
          <View>
            <Text style={styles.orderId}>{item.id}</Text>
            <Text style={styles.orderDate}>{item.date}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.orderAmount}>₱{item.amount}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <LoadingSkeleton width="70%" height={32} count={1} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LoadingSkeleton width="100%" height={120} count={3} gap={16} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Image
            source={require('../../../assets/images/icon.png')}
            style={styles.topLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.greeting}>
              Hello, {user?.fullName?.split(' ')[0] || 'Customer'} 👋
            </Text>
            <Text style={styles.greetingSub}>Ready for clean laundry?</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Active Order ─────────────────────────────────────────────── */}
        {activeOrder ? (
          <View style={styles.activeOrderCard}>
            <View style={styles.activeOrderTopRow}>
              <View style={styles.activeOrderBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeOrderBadgeText}>Active Order</Text>
              </View>
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => navigation.navigate('Tracking', { orderId: activeOrder.id })}
              >
                <Ionicons name="navigate-outline" size={13} color={colors.primary} />
                <Text style={styles.trackBtnText}>Track</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.activeOrderId}>{activeOrder.id}</Text>
            <Text style={styles.activeOrderStatus}>
              {STATUS_LABELS[activeOrder.status] || activeOrder.status}
            </Text>

            {/* Step progress */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${getStatusProgress(activeOrder.status) * 100}%`,
              }]} />
            </View>
            <View style={styles.progressLabels}>
              {STATUS_STEPS.map((s, i) => (
                <Text
                  key={s}
                  style={[
                    styles.progressStep,
                    STATUS_STEPS.indexOf(activeOrder.status) >= i && styles.progressStepActive,
                  ]}
                  numberOfLines={1}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              ))}
            </View>

            <View style={styles.activeOrderActions}>
              <Button
                title="View Details"
                variant="secondary"
                size="sm"
                onPress={() => navigation.navigate('OrderDetail', { orderId: activeOrder.id })}
                style={styles.actionButton}
              />
              <Button
                title="Chat Support"
                variant="ghost"
                size="sm"
                onPress={() => navigation.navigate('Chat')}
                style={styles.actionButton}
              />
            </View>
          </View>
        ) : null}

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionTile}
              onPress={() => navigation.navigate(action.screen, action.params)}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconBox, { backgroundColor: action.iconBg }]}>
                <MaterialCommunityIcons name={action.icon} size={24} color={action.iconColor} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Nearby Branches ──────────────────────────────────────────── */}
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

        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <Button
            title="Refresh"
            variant="ghost"
            size="sm"
            onPress={handleRefresh}
            icon={<MaterialCommunityIcons name="refresh" size={16} color={colors.primary} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── Header ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  greetingSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110, // extra room for floating tab bar
  },

  // ── Active Order ────────────────────────────────────────────────────────
  activeOrderCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  activeOrderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  activeOrderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  trackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  activeOrderId: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  activeOrderStatus: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 3,
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
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
    gap: 8,
  },
  actionButton: { flex: 1 },

  // ── Quick Actions ───────────────────────────────────────────────────────
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },

  // ── Sections ────────────────────────────────────────────────────────────
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },

  // ── Branch Card ─────────────────────────────────────────────────────────
  branchCard: { marginBottom: 0 },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  branchIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    marginTop: 1,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '700',
  },
  branchAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
    marginLeft: 48,
  },
  branchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hoursText: { fontSize: 12, color: colors.textSecondary },

  // ── Order Card ──────────────────────────────────────────────────────────
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  orderCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: { fontSize: 14, fontWeight: '700', color: colors.text },
  orderDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  orderAmount: { fontSize: 18, fontWeight: '800', color: colors.primary },

  // loading header
  header: { paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 },
});

export default HomeScreen;