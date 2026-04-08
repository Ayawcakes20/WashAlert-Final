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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { deliveries as deliveriesApi } from '../../services/api';

const DriverDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Driver';

  const loadData = useCallback(async () => {
    try {
      setError('');
      const data = await deliveriesApi.getAssigned('all');
      setDeliveries(data.deliveries || []);
    } catch (e) {
      setDeliveries([]);
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
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const pending = deliveries.filter((item) => item.status === 'pending' || item.status === 'en_route').length;
  const completed = deliveries.filter((item) => item.status === 'completed').length;
  const active = deliveries.find((item) => item.status === 'in_progress' || item.status === 'picked_up');

  const getStatusLabel = (status) => {
    if (status === 'pending') return 'Pending Pickup';
    if (status === 'en_route') return 'En Route';
    if (status === 'picked_up') return 'Picked Up';
    if (status === 'in_progress') return 'In Transit';
    if (status === 'completed') return 'Completed';
    if (status === 'failed') return 'Failed';
    return 'Pending';
  };

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.greetingText}>{greeting},</Text>
          <Text style={styles.nameText}>{firstName}!</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryCard}
        >
          <Text style={styles.summaryLabel}>TODAY'S SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="cube-outline" size={20} color={colors.card} />
              </View>
              <Text style={styles.summaryVal}>{deliveries.length}</Text>
              <Text style={styles.summarySub}>Total</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.card} />
              </View>
              <Text style={styles.summaryVal}>{completed}</Text>
              <Text style={styles.summarySub}>Done</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="time-outline" size={20} color={colors.card} />
              </View>
              <Text style={styles.summaryVal}>{pending}</Text>
              <Text style={styles.summarySub}>Pending</Text>
            </View>
          </View>
        </LinearGradient>

        {active ? (
          <View style={styles.activeDeliveryBox}>
            <View style={styles.activeHeaderRow}>
              <Ionicons name="bus-outline" size={20} color={colors.accent} />
              <Text style={styles.activeDeliveryTitle}>Active Delivery</Text>
            </View>
            <Text style={styles.activeCustomer}>{active.customerName}</Text>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.addressText}>{active.deliveryAddress}</Text>
            </View>

            <TouchableOpacity
              style={styles.goBtn}
              onPress={() => navigation.navigate('Deliveries')}
            >
              <Text style={styles.goBtnText}>Go to Delivery</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.card} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Deliveries</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.listContainer}>
            {!deliveries.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No deliveries found.</Text>
              </View>
            ) : (
              deliveries.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.deliveryCard}>
                  <View style={styles.delHeader}>
                    <Text style={styles.delCustomer}>{item.customerName}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        item.status === 'completed'
                          ? styles.statusCompleted
                          : item.status === 'in_progress'
                          ? styles.statusActive
                          : item.status === 'failed'
                          ? styles.statusFailed
                          : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.status === 'completed'
                            ? styles.statusTextCompleted
                            : item.status === 'in_progress'
                            ? styles.statusTextActive
                            : item.status === 'failed'
                            ? styles.statusTextFailed
                            : styles.statusTextPending,
                        ]}
                      >
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.addressRow, { marginTop: 4 }]}>
                    <Ionicons name="map-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.addressText}>
                      {item.leg === 'PICKUP_FROM_CUSTOMER' ? "Pickup: " : "Deliver to: "}
                      {item.leg === 'PICKUP_FROM_CUSTOMER' ? item.customerName : item.deliveryAddress}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { marginBottom: 24 },
  greetingText: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  nameText: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  errorText: { fontSize: 12, color: colors.error, marginBottom: 16 },

  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryVal: { fontSize: 24, fontWeight: 'bold', color: colors.card },
  summarySub: { fontSize: 10, color: 'rgba(255,255,255,0.85)' },

  activeDeliveryBox: {
    backgroundColor: 'hsla(174, 79%, 44%, 0.1)',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  activeHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  activeDeliveryTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginLeft: 8 },
  activeCustomer: { fontSize: 14, fontWeight: '600', color: colors.text },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addressText: { fontSize: 12, color: colors.textSecondary, marginLeft: 4, flex: 1 },
  goBtn: {
    marginTop: 12,
    width: '100%',
    height: 40,
    backgroundColor: colors.accent,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtnText: { fontSize: 14, fontWeight: '600', color: colors.card, marginRight: 4 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  seeAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  listContainer: { gap: 12 },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyText: { fontSize: 12, color: colors.textSecondary },
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
  delHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  delCustomer: { fontSize: 14, fontWeight: 'bold', color: colors.text, flex: 1, paddingRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusCompleted: { backgroundColor: 'hsla(156, 87%, 34%, 0.1)' },
  statusActive: { backgroundColor: 'hsla(174, 79%, 44%, 0.1)' },
  statusPending: { backgroundColor: 'hsla(16, 100%, 56%, 0.1)' },
  statusFailed: { backgroundColor: 'hsla(0, 84%, 60%, 0.1)' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  statusTextCompleted: { color: colors.success },
  statusTextActive: { color: colors.accent },
  statusTextPending: { color: colors.warning },
  statusTextFailed: { color: colors.error },
});

export default DriverDashboardScreen;
