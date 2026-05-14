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
  ASSIGNED_FOR_PICKUP: { label: 'PICKUP ASSIGNED', color: '#3B82F6', icon: 'package-variant' },
  EN_ROUTE_TO_CUSTOMER: { label: 'EN ROUTE TO PICKUP', color: '#F59E0B', icon: 'truck-delivery' },
  LAUNDRY_COLLECTED: { label: 'LAUNDRY COLLECTED', color: '#10B981', icon: 'check-circle' },
  ASSIGNED_FOR_DELIVERY: { label: 'DELIVERY ASSIGNED', color: '#3B82F6', icon: 'package-variant' },
  OUT_FOR_DELIVERY: { label: 'OUT FOR DELIVERY', color: '#F59E0B', icon: 'truck-delivery' },
  DELIVERED: { label: 'DELIVERED', color: '#10B981', icon: 'check-decagram' },
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
            <Text style={s.brandName}>WashAlert Driver</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('DriverNotifications')}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Performance Stats Bar */}
        <View style={s.statsCard}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{tasks.length}</Text>
            <Text style={s.statLabel}>Total Tasks</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#10B981' }]}>{completed}</Text>
            <Text style={s.statLabel}>Completed</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#F59E0B' }]}>{assigned}</Text>
            <Text style={s.statLabel}>Assigned</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={s.body} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Performance / History Tile */}
        <TouchableOpacity 
          style={s.historyTile} 
          onPress={() => navigation.navigate('DriverActivityHistory')}
        >
          <View style={s.historyIcon}>
            <MaterialCommunityIcons name="chart-line" size={28} color="#fff" />
          </View>
          <View style={s.historyInfo}>
            <Text style={s.historyTitle}>Activity History</Text>
            <Text style={s.historySub}>View your performance metrics and logs</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Active & Pending Tasks</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
            <Text style={s.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {tasks.filter(t => t.status !== 'DELIVERED').length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No pending tasks assigned to you.</Text>
          </View>
        ) : (
          tasks.filter(t => t.status !== 'DELIVERED').map(item => {
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
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0F2044', padding: 24, paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  statsCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 20, borderRadius: 24, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 15 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase', marginTop: 4 },
  divider: { width: 1, height: '100%', backgroundColor: '#F1F5F9' },
  body: { padding: 24, marginTop: -16 },
  historyTile: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 32, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  historyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  historySub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 14, fontWeight: '700', color: colors.primary },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 24, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  taskIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  taskInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '800', color: colors.text },
  address: { fontSize: 13, color: colors.textTertiary, marginVertical: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
