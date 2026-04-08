import React, { useState, useEffect, useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Card, Button, LoadingSkeleton, EmptyState, StatusBadge } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { branches as branchesApi, bookings as bookingsApi } from '../../services/api';
import { typography } from '../../theme/typography';

const { width } = Dimensions.get('window');

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

  const handleRefresh = () => {
    loadData();
  };

  const renderBranchCard = ({ item }) => (
    <Card style={styles.branchCard}>
      <View style={styles.branchHeader}>
        <View>
          <Text style={styles.branchName}>{item.name}</Text>
          <Text style={styles.branchCity}>{item.city}</Text>
        </View>
        <View style={styles.distanceBadge}>
          <MaterialCommunityIcons name="map-marker" size={14} color={colors.warning} />
          <Text style={styles.distanceText}>{item.distance} km</Text>
        </View>
      </View>
      <Text style={styles.branchAddress}>{item.address}</Text>
      <View style={styles.branchFooter}>
        <View style={styles.hoursContainer}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.hoursText}>{item.hours}</Text>
        </View>
        <TouchableOpacity>
          <MaterialCommunityIcons name="phone" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderOrderCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      activeOpacity={0.7}
    >
      <Card style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderId}>{item.id}</Text>
            <Text style={styles.orderDate}>{item.date}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.orderAmount}>₱{item.amount}</Text>
      </Card>
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.fullName || 'Customer'}</Text>
            <Text style={styles.subtitle}>Ready for clean laundry?</Text>
          </View>
          <TouchableOpacity>
            <MaterialCommunityIcons name="bell-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Active Order Card */}
        {activeOrder ? (
          <Card style={styles.activeOrderCard}>
            <View style={styles.activeOrderHeader}>
              <Text style={styles.activeOrderLabel}>Active Order</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Tracking', { orderId: activeOrder.id })}>
                <Text style={styles.trackLink}>Track</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.activeOrderId}>{activeOrder.id}</Text>
            <Text style={styles.activeOrderStatus}>{activeOrder.status.toUpperCase()}</Text>
            <Text style={styles.activeOrderEta}>Estimated: {activeOrder.estimatedTime}</Text>
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
          </Card>
        ) : null}

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Book', { serviceId: 'wash-dry' })}
          >
            <MaterialCommunityIcons name="water" size={32} color={colors.primary} />
            <Text style={styles.actionBtnText}>Wash & Dry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Book', { serviceId: 'wash-fold' })}
          >
            <MaterialCommunityIcons name="content-cut" size={32} color={colors.success} />
            <Text style={styles.actionBtnText}>Wash & Fold</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Chat')}
          >
            <MaterialCommunityIcons name="chat-outline" size={32} color={colors.accent} />
            <Text style={styles.actionBtnText}>Support</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <MaterialCommunityIcons name="bell-outline" size={32} color={colors.warning} />
            <Text style={styles.actionBtnText}>Updates</Text>
          </TouchableOpacity>
        </View>

        {/* Nearby Branches */}
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
              gap={12}
            />
          ) : (
            <EmptyState title="No branches found" />
          )}
        </View>

        {/* Recent Orders */}
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
              gap={12}
            />
          ) : (
            <EmptyState
              icon="shopping-outline"
              title="No orders yet"
              description="Book your first laundry service today!"
              actionButton={
                <Button
                  title="Book Now"
                  onPress={() => navigation.navigate('Book')}
                  size="sm"
                />
              }
            />
          )}
        </View>

        <View style={styles.refreshButton}>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 12,
  },
  greeting: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: 4,
  },
  activeOrderCard: {
    backgroundColor: '#F0F9FF',
    borderColor: colors.primary,
    marginBottom: 24,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeOrderLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  trackLink: {
    fontSize: typography.caption.fontSize,
    color: colors.accent,
    fontWeight: '600',
  },
  activeOrderId: {
    fontSize: typography.bodyBold.fontSize,
    fontWeight: typography.bodyBold.fontWeight,
    color: colors.text,
    marginBottom: 4,
  },
  activeOrderStatus: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 8,
  },
  activeOrderEta: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  activeOrderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  actionBtn: {
    width: '48%',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.bodyBold.fontSize,
    fontWeight: typography.bodyBold.fontWeight,
    color: colors.text,
  },
  seeAll: {
    fontSize: typography.caption.fontSize,
    color: colors.primary,
    fontWeight: '600',
  },
  branchCard: {
    marginBottom: 12,
  },
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  branchName: {
    fontSize: typography.bodyBold.fontSize,
    fontWeight: typography.bodyBold.fontWeight,
    color: colors.text,
  },
  branchCity: {
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4E6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  distanceText: {
    fontSize: typography.small.fontSize,
    color: colors.warning,
    fontWeight: '600',
  },
  branchAddress: {
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  branchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hoursText: {
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
  },
  orderCard: {
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: typography.bodyBold.fontSize,
    fontWeight: typography.bodyBold.fontWeight,
    color: colors.text,
  },
  orderDate: {
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
  },
  orderAmount: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    color: colors.primary,
  },
  refreshButton: {
    marginTop: 8,
  },
});

export default HomeScreen;