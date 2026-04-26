import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { deliveries as deliveriesApi } from '../../services/api';

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
];

const DELIVERIES_PAGE_SIZE = 8;

const getStatusColor = (status) => {
  switch (status) {
    case 'accepted': return { bg: 'hsla(214, 88%, 57%, 0.12)', text: '#3B82F6' };
    case 'at_customer': return { bg: 'hsla(38, 96%, 58%, 0.12)', text: '#F59E0B' };
    case 'picked_up': return { bg: 'hsla(158, 77%, 44%, 0.12)', text: colors.accent };
    case 'at_branch':
    case 'handed_over': return { bg: 'hsla(263, 70%, 58%, 0.12)', text: '#7C3AED' };
    case 'ready_for_dispatch': return { bg: 'hsla(158, 77%, 44%, 0.12)', text: colors.success };
    case 'en_route': return { bg: 'hsla(214, 88%, 57%, 0.12)', text: '#3B82F6' };
    case 'at_delivery': return { bg: 'hsla(38, 96%, 58%, 0.12)', text: '#F59E0B' };
    case 'pending': return { bg: 'hsla(16, 100%, 56%, 0.1)', text: colors.warning };
    case 'in_progress': return { bg: 'hsla(174, 79%, 44%, 0.1)', text: colors.accent };
    case 'completed': return { bg: 'hsla(156, 87%, 34%, 0.1)', text: colors.success };
    case 'failed': return { bg: 'hsla(0, 84%, 60%, 0.1)', text: colors.error };
    default: return { bg: colors.border, text: colors.textSecondary };
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'accepted': return 'Heading to Pickup';
    case 'at_customer': return 'At Customer';
    case 'picked_up': return 'Picked Up';
    case 'at_branch': return 'At Branch';
    case 'handed_over': return 'Handed Over';
    case 'ready_for_dispatch': return 'Ready to Deliver';
    case 'en_route': return 'Out for Delivery';
    case 'at_delivery': return 'At Customer';
    case 'pending': return 'New Order';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    default: return status ?? 'Unknown';
  }
};

const DriverDeliveriesScreen = ({ navigation }) => {
  const [tab, setTab] = useState('all');
  const [deliveries, setDeliveries] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [acceptingTracking, setAcceptingTracking] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const availablePageSlice = useMemo(() => {
    const start = Math.max(0, currentPage - 1) * DELIVERIES_PAGE_SIZE;
    return availableOrders.slice(start, start + DELIVERIES_PAGE_SIZE);
  }, [availableOrders, currentPage]);

  const loadDeliveries = useCallback(async (requestedPage = 0, showLoading = true) => {
    try {
      setError('');
      if (showLoading) setLoading(true);

      if (tab === 'available') {
        const data = await deliveriesApi.getAvailable();
        const orders = data.orders || [];
        setAvailableOrders(orders);
        setDeliveries([]);
        const localTotalPages = Math.max(1, Math.ceil(orders.length / DELIVERIES_PAGE_SIZE));
        const safePage = Math.min(localTotalPages, requestedPage + 1);
        setCurrentPage(Math.max(1, safePage));
        setTotalPages(localTotalPages);
        setHasPrevious(safePage > 1);
        setHasNext(safePage < localTotalPages);
        return;
      }

      const data = await deliveriesApi.getMyPaged(tab, requestedPage, DELIVERIES_PAGE_SIZE);
      setDeliveries(data.deliveries || []);
      setAvailableOrders([]);
      setCurrentPage((data.page || 0) + 1);
      setTotalPages(Math.max(1, data.totalPages || 1));
      setHasNext(Boolean(data.hasNext));
      setHasPrevious(Boolean(data.hasPrevious));
    } catch (loadError) {
      setDeliveries([]);
      setAvailableOrders([]);
      setCurrentPage(1);
      setTotalPages(1);
      setHasNext(false);
      setHasPrevious(false);
      setError(loadError?.message || 'Unable to load deliveries right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDeliveries(0, true);
    }, [loadDeliveries]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDeliveries(Math.max(0, currentPage - 1), false);
  }, [loadDeliveries, currentPage]);

  const onChangeTab = useCallback((nextTab) => {
    setTab(nextTab);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab]);

  const handleAcceptBooking = useCallback((trackingNumber) => {
    if (!trackingNumber || acceptingTracking) return;
    Alert.alert('Accept Booking', `Accept booking ${trackingNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            setAcceptingTracking(trackingNumber);
            await deliveriesApi.acceptBooking(trackingNumber);
            Alert.alert('Accepted', 'Booking accepted successfully.');
            setTab('pending');
          } catch (acceptError) {
            Alert.alert('Accept Failed', acceptError?.message || 'Unable to accept booking.');
          } finally {
            setAcceptingTracking('');
          }
        },
      },
    ]);
  }, [acceptingTracking]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const activeItems = tab === 'available' ? availablePageSlice : deliveries;
  const noData = tab === 'available' ? availableOrders.length === 0 : deliveries.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.scrollContent}>
        <Text style={styles.headerTitle}>My Deliveries</Text>

        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {TABS.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => onChangeTab(item.value)}
                style={[styles.tabBtn, tab === item.value ? styles.tabBtnActive : styles.tabBtnInactive]}
              >
                <Text style={[styles.tabText, tab === item.value ? styles.tabTextActive : styles.tabTextInactive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {noData ? (
          <ScrollView
            contentContainerStyle={styles.emptyState}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <Ionicons name="bicycle-outline" size={64} color={colors.border} />
            <Text style={styles.emptyText}>
              {tab === 'available' ? 'No available bookings right now' : 'No deliveries found'}
            </Text>
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {tab === 'available'
              ? activeItems.map((order) => (
                  <View key={order.trackingNumber} style={styles.deliveryCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.customerName}>{order.customerName || 'Customer'}</Text>
                      <View style={[styles.badge, { backgroundColor: 'hsla(16, 100%, 56%, 0.1)' }]}>
                        <Text style={[styles.badgeText, { color: colors.warning }]}>Available</Text>
                      </View>
                    </View>

                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.addressText}>{order.deliveryAddress || 'No address provided'}</Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.orderId}>Order: {order.trackingNumber}</Text>
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => handleAcceptBooking(order.trackingNumber)}
                        disabled={acceptingTracking === order.trackingNumber}
                      >
                        <Text style={styles.viewBtnText}>
                          {acceptingTracking === order.trackingNumber ? 'Accepting...' : 'Accept'}
                        </Text>
                        <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              : activeItems.map((delivery) => {
                  const statusColor = getStatusColor(delivery.status);
                  return (
                    <View key={delivery.id} style={styles.deliveryCard}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.customerName}>{delivery.customerName}</Text>
                        <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
                          <Text style={[styles.badgeText, { color: statusColor.text }]}> 
                            {getStatusLabel(delivery.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.addressRow}>
                        <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.addressText}>{delivery.deliveryAddress}</Text>
                      </View>

                      <View style={styles.cardFooter}>
                        <Text style={styles.orderId}>Order: {delivery.orderNumber}</Text>
                        <TouchableOpacity
                          style={styles.viewBtn}
                          onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: delivery.id })}
                        >
                          <Text style={styles.viewBtnText}>View Details</Text>
                          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

            {totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, !hasPrevious && styles.pageBtnDisabled]}
                  onPress={() => loadDeliveries(Math.max(0, currentPage - 2), true)}
                  disabled={!hasPrevious}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.pageText}>Page {currentPage} of {totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, !hasNext && styles.pageBtnDisabled]}
                  onPress={() => loadDeliveries(currentPage, true)}
                  disabled={!hasNext}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 16 },
  errorText: { color: colors.error, fontSize: 12, marginBottom: 12 },

  tabsContainer: { marginBottom: 20 },
  tabsScroll: { gap: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnInactive: { backgroundColor: colors.card, borderColor: colors.border },
  tabText: { fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: colors.card },
  tabTextInactive: { color: colors.textSecondary },

  listContent: { gap: 12 },
  deliveryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  customerName: { fontSize: 14, fontWeight: 'bold', color: colors.text, flex: 1, paddingRight: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingRight: 20 },
  addressText: { fontSize: 12, color: colors.textSecondary, marginLeft: 4, flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderId: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  viewBtn: { flexDirection: 'row', alignItems: 'center' },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary, marginRight: 2 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginTop: 16 },
  paginationRow: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pageBtn: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default DriverDeliveriesScreen;
