import React, { useCallback, useState } from 'react';
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

const getStatusColor = (status) => {
  switch (status) {
    case 'pending':
      return { bg: 'hsla(16, 100%, 56%, 0.1)', text: colors.warning };
    case 'in_progress':
      return { bg: 'hsla(174, 79%, 44%, 0.1)', text: colors.accent };
    case 'completed':
      return { bg: 'hsla(156, 87%, 34%, 0.1)', text: colors.success };
    case 'failed':
      return { bg: 'hsla(0, 84%, 60%, 0.1)', text: colors.error };
    default:
      return { bg: colors.border, text: colors.textSecondary };
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
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

  const loadDeliveries = useCallback(async () => {
    try {
      setError('');
      if (tab === 'available') {
        const data = await deliveriesApi.getAvailable();
        setAvailableOrders(data.orders || []);
        setDeliveries([]);
      } else {
        const data = await deliveriesApi.getAssigned(tab);
        setDeliveries(data.deliveries || []);
        setAvailableOrders([]);
      }
    } catch (e) {
      setDeliveries([]);
      setAvailableOrders([]);
      setError(e?.message || 'Unable to load deliveries right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDeliveries();
    }, [loadDeliveries])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDeliveries();
  }, [loadDeliveries]);

  const onChangeTab = useCallback((nextTab) => {
    setTab(nextTab);
  }, []);

  const handleAcceptBooking = useCallback(
    (trackingNumber) => {
      if (!trackingNumber || acceptingTracking) return;
      Alert.alert(
        'Accept Booking',
        `Accept booking ${trackingNumber}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept',
            onPress: async () => {
              try {
                setAcceptingTracking(trackingNumber);
                await deliveriesApi.acceptBooking(trackingNumber);
                Alert.alert('Accepted', 'Booking accepted successfully.');
                setTab('pending');
              } catch (error) {
                Alert.alert('Accept Failed', error?.message || 'Unable to accept booking.');
              } finally {
                setAcceptingTracking('');
              }
            },
          },
        ]
      );
    },
    [acceptingTracking]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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

        {(tab === 'available' ? availableOrders.length === 0 : deliveries.length === 0) ? (
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
              ? availableOrders.map((order) => (
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
              : deliveries.map((delivery) => {
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
});

export default DriverDeliveriesScreen;
