import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { driverOrders } from '../../services/api';

export default function DriverActivityHistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await driverOrders.getTasks(0, 100);
      // Filter only completed (Delivered) tasks
      const filtered = (res.content || []).filter(t => t.status === 'DELIVERED');
      setHistory(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadHistory(); }, [loadHistory]);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: item.id })}
    >
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="check-decagram" size={24} color="#16A34A" />
      </View>
      <View style={styles.info}>
        <Text style={styles.customerName}>{item.contactName || item.customerName}</Text>
        <Text style={styles.address} numberOfLines={1}>{item.deliveryAddress || 'Branch'}</Text>
        <Text style={styles.date}>{new Date(item.updatedAt).toLocaleDateString()} · {new Date(item.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeTxt}>DONE</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Activity History</Text>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{history.length}</Text>
          <Text style={styles.statLbl}>Tasks Completed</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={t => t.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="history" size={48} color={colors.border} />
              <Text style={styles.emptyTxt}>No completed activities yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  statsBar: { backgroundColor: colors.primary, padding: 20, margin: 16, borderRadius: 20, flexDirection: 'row', justifyContent: 'center' },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 32, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  list: { padding: 16 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '800', color: colors.text },
  address: { fontSize: 13, color: '#64748B', marginTop: 2 },
  date: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  badge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontWeight: '900', color: '#16A34A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 12 },
  emptyTxt: { color: '#94A3B8', fontWeight: '600' }
});
