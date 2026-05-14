import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { driverOrders } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_CONFIG = {
  ASSIGNED_FOR_PICKUP: { label: 'Pickup Assigned', color: '#3B82F6', icon: 'package-variant' },
  EN_ROUTE_TO_CUSTOMER: { label: 'En Route to Pickup', color: '#F59E0B', icon: 'truck-delivery' },
  LAUNDRY_COLLECTED: { label: 'Collected', color: '#10B981', icon: 'check-circle' },
  ASSIGNED_FOR_DELIVERY: { label: 'Delivery Assigned', color: '#3B82F6', icon: 'package-variant' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: '#F59E0B', icon: 'truck-delivery' },
  DELIVERED: { label: 'Delivered', color: '#10B981', icon: 'check-decagram' },
};

const getStatusCfg = (s) => STATUS_CONFIG[s] || { label: s, color: colors.textSecondary, icon: 'help-circle' };

export default function DriverDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await driverOrders.getTasks(0, 100);
      setTasks(res.content || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const completed = tasks.filter(t => t.status === 'DELIVERED').length;
  const assigned = tasks.filter(t => t.status.includes('ASSIGNED')).length;
  const active = tasks.filter(t => t.status.includes('EN_ROUTE') || t.status === 'OUT_FOR_DELIVERY').length;

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerTop}>
          <View style={s.brandRow}>
            <MaterialCommunityIcons name="washing-machine" size={24} color="#fff" />
            <Text style={s.brandName}>WashAlert</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('DriverNotifications')}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={s.greet}>Good morning,</Text>
        <Text style={s.name}>{user?.fullName || 'Driver'}</Text>

        <View style={s.statsCard}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{tasks.length}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#10B981' }]}>{completed}</Text>
            <Text style={s.statLabel}>Done</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#F59E0B' }]}>{assigned}</Text>
            <Text style={s.statLabel}>Assigned</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#3B82F6' }]}>{active}</Text>
            <Text style={s.statLabel}>Active</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={s.body} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Active Tasks ({active + assigned})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
            <Text style={s.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {tasks.filter(t => t.status !== 'DELIVERED').map(item => {
          const cfg = getStatusCfg(item.status);
          return (
            <TouchableOpacity 
              key={item.id} 
              style={s.taskCard}
              onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: item.id })}
            >
              <View style={s.taskIcon}>
                <MaterialCommunityIcons name={cfg.icon} size={24} color={cfg.color} />
              </View>
              <View style={s.taskInfo}>
                <Text style={s.customerName}>{item.contactName || item.customerName}</Text>
                <Text style={s.address} numberOfLines={1}>{item.deliveryAddress || 'Branch Pickup'}</Text>
                <View style={[s.badge, { backgroundColor: cfg.color + '15' }]}>
                  <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        })}

        <Text style={s.sectionTitle}>Quick Access</Text>
        <View style={s.quickGrid}>
          <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Deliveries')}>
            <MaterialCommunityIcons name="truck-delivery" size={28} color={colors.primary} />
            <Text style={s.quickText}>All Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('DriverActivityHistory')}>
            <MaterialCommunityIcons name="history" size={28} color="#10B981" />
            <Text style={s.quickText}>Activity History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('DriverProfile')}>
            <MaterialCommunityIcons name="account-circle" size={28} color="#7C3AED" />
            <Text style={s.quickText}>My Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0F2044', padding: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  greet: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  name: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 24 },
  statsCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 20, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', marginTop: 4 },
  divider: { width: 1, height: '100%', backgroundColor: '#F1F5F9' },
  body: { padding: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  seeAll: { fontSize: 14, fontWeight: '600', color: colors.primary },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 24, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  taskIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  taskInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '800', color: colors.text },
  address: { fontSize: 13, color: colors.textTertiary, marginVertical: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quickBtn: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 24, alignItems: 'center', gap: 8, elevation: 2 },
  quickText: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
