import React, { useState, useCallback, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { bookings } from '../../services/api';
import { colors } from '../../theme/colors';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];
const ORDERS_PAGE_SIZE = 8;

const FILTER_TO_API_STATUS = {
  All: 'all',
  Active: 'active',
  Completed: 'completed',
  Cancelled: 'cancelled',
};

const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return colors.warning;
    case 'washing':
    case 'drying':
    case 'received': return colors.primary;
    case 'ready': return colors.accent;
    case 'delivering': return colors.info;
    case 'delivered':
    case 'completed': return colors.success;
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

const formatDateTimeLabel = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'N/A';
  const dateLabel = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} • ${timeLabel}`;
};

const OrdersScreen = ({ navigation }) => {
  const [filter, setFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async (requestedPage = 0, showLoading = true) => {
    try {
      setError('');
      if (showLoading) setLoading(true);
      const data = await bookings.getMyBookings(
        FILTER_TO_API_STATUS[filter] || 'all',
        ORDERS_PAGE_SIZE,
        requestedPage,
        searchText.trim(),
      );
      setOrders(data.bookings || []);
      setCurrentPage((data.page || 0) + 1);
      setTotalPages(Math.max(1, data.totalPages || 1));
      setHasNext(Boolean(data.hasNext));
      setHasPrevious(Boolean(data.hasPrevious));
      setTotalOrders(Number(data.total || 0));
    } catch (loadError) {
      console.error('Error loading orders:', loadError);
      setError(loadError?.message || 'Unable to load orders right now.');
      setOrders([]);
      setCurrentPage(1);
      setTotalPages(1);
      setHasNext(false);
      setHasPrevious(false);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  }, [filter, searchText]);

  useFocusEffect(
    useCallback(() => {
      loadOrders(0, true);
    }, [loadOrders]),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders(0, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [filter, searchText, loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders(Math.max(0, currentPage - 1), false);
    setRefreshing(false);
  }, [loadOrders, currentPage]);

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
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}1A` }]}>
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
          <Text style={styles.detailValue}>PHP {item.amountPaid || item.amount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{formatDateTimeLabel(item.dateBooked || item.date)}</Text>
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
        {searchText ? `No orders found matching "${searchText}"` : `No ${filter.toLowerCase()} orders yet`}
      </Text>
      <TouchableOpacity style={styles.bookNowBtn} onPress={() => navigation.navigate('Book')}>
        <Text style={styles.bookNowText}>Book Now</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !orders.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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

      <FlatList
        data={orders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => String(item.id ?? item.trackingNumber)}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageBtn, !hasPrevious && styles.pageBtnDisabled]}
                disabled={!hasPrevious}
                onPress={() => loadOrders(Math.max(0, currentPage - 2), true)}
              >
                <Text style={styles.pageBtnText}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.pageText}>Page {currentPage} of {totalPages}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, !hasNext && styles.pageBtnDisabled]}
                disabled={!hasNext}
                onPress={() => loadOrders(currentPage, true)}
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && !loading && totalOrders === 0 ? <Text style={styles.infoText}>No data available.</Text> : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  pageBtn: {
    minWidth: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  pageText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

export default OrdersScreen;
