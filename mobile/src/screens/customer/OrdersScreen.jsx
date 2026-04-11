import React, { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { bookings } from '../../services/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];

const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return colors.warning;
    case 'washing': case 'drying': case 'received': return colors.primary;
    case 'ready': return colors.accent;
    case 'delivering': return colors.info;
    case 'delivered': case 'completed': return colors.success;
    case 'cancelled': return colors.error;
    default: return colors.textSecondary;
  }
};

const getStatusLabel = (status) => {
  const labels = {
    pending: 'Pending',
    received: 'Received',
    washing: 'Washing',
    drying: 'Drying',
    ready: 'Ready',
    delivering: 'Delivering',
    delivered: 'Completed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
};

const OrdersScreen = ({ navigation }) => {
  const [filter, setFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bookings.getMyBookings('all', 100);
      setAllOrders(data.bookings || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const getFilteredOrders = useCallback(() => {
    let filtered = [...allOrders];

    if (filter !== 'All') {
      const statusMap = {
        Active: ['pending', 'received', 'washing', 'drying', 'ready'],
        Completed: ['delivered', 'completed'],
        Cancelled: ['cancelled'],
      };
      filtered = filtered.filter((order) =>
        statusMap[filter]?.includes(order.status)
      );
    }

    if (searchText) {
      filtered = filtered.filter(
        (order) =>
          (order.trackingNumber || '').toLowerCase().includes(searchText.toLowerCase()) ||
          (order.branchName || '').toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return filtered;
  }, [allOrders, filter, searchText]);

  const filteredOrders = getFilteredOrders();

  const renderOrderCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      activeOpacity={0.7}
      style={[styles.orderCard, { borderLeftColor: getStatusColor(item.status) }]}
    >
      <View style={styles.orderHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.trackingNumber}>{item.trackingNumber}</Text>
          <Text style={styles.branchName}>{item.branchName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '1A' }]}>
          <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Service</Text>
          <Text style={styles.detailValue}>{item.serviceType}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>₱{item.amountPaid || item.amount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {item.date || new Date(item.dateBooked).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.viewDetailsBtn}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      >
        <Text style={styles.viewDetailsText}>View Details</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="package-variant" size={64} color={colors.border} />
      <Text style={styles.emptyTitle}>No Orders</Text>
      <Text style={styles.emptyMessage}>
        {searchText
          ? `No orders found matching "${searchText}"`
          : `No ${filter.toLowerCase()} orders yet`}
      </Text>
      <TouchableOpacity
        style={styles.bookNowBtn}
        onPress={() => navigation.navigate('Book')}
      >
        <Text style={styles.bookNowText}>Book Now</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders..."
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        {FILTERS.map((filterItem) => (
          <TouchableOpacity
            key={filterItem}
            style={[
              styles.filterButton,
              filter === filterItem && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(filterItem)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === filterItem && styles.filterButtonTextActive,
              ]}
            >
              {filterItem}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110,
    flexGrow: 1,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trackingNumber: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 2,
  },
  branchName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    gap: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  bookNowBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookNowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OrdersScreen;