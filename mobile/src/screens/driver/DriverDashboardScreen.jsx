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

const { width: SW } = Dimensions.get('window');
const NAV_BG = '#0F2044';

const STATUS_CONFIG = {
  ASSIGNED_FOR_DELIVERY: { label:'Assigned for Delivery', color:'#3B82F6', bg:'#EFF6FF', icon:'package-variant' },
  EN_ROUTE_TO_BRANCH:    { label:'En Route to Branch',   color:'#F59E0B', bg:'#FFFBEB', icon:'truck-delivery'   },
  PICKED_UP_FROM_BRANCH: { label:'Out for Delivery',     color:'#10B981', bg:'#F0FDF4', icon:'truck-fast'        },
  OUT_FOR_DELIVERY:      { label:'Out for Delivery',     color:'#10B981', bg:'#F0FDF4', icon:'truck-fast'        },
  DELIVERED:             { label:'Completed',            color:'#10B981', bg:'#F0FDF4', icon:'check-decagram'    },
  COLLECTION_FAILED:     { label:'Failed',               color:'#EF4444', bg:'#FEF2F2', icon:'alert-circle'      },
};
const getStatusCfg = s => STATUS_CONFIG[s] || { label:s, color:'#64748B', bg:'#F8FAFC', icon:'help-circle' };
const ACTIVE_STATUSES = ['ASSIGNED_FOR_DELIVERY','EN_ROUTE_TO_BRANCH','PICKED_UP_FROM_BRANCH','OUT_FOR_DELIVERY'];

export default function DriverDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Driver';

  const loadData = useCallback(async () => {
    try {
      setError('');
      const res = await driverOrders.getTasks(0, 100);
      const sorted = (res.content || []).sort((a,b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0));
      setTasks(sorted);
    } catch (e) {
      setError(e?.message || 'Unable to load tasks.');
      setTasks([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true); loadData();
    const poll = setInterval(loadData, 30000);
    return () => clearInterval(poll);
  }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const completed = tasks.filter(t => t.status === 'DELIVERED').length;
  const pending   = tasks.filter(t => t.status === 'ASSIGNED_FOR_DELIVERY').length;
  const active    = tasks.find(t => ACTIVE_STATUSES.includes(t.status));
  const activeTasks = tasks.filter(t => ACTIVE_STATUSES.includes(t.status));
  const recentCompleted = tasks.filter(t => t.status === 'DELIVERED').slice(0, 3);

  if (loading) return (
    <View style={s.loadScreen}>
      <ActivityIndicator size="large" color="#60A5FA" />
      <Text style={s.loadTxt}>Loading dashboard…</Text>
    </View>
  );

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <View style={s.brandRow}>
            <View style={s.logoBox}>
              <MaterialCommunityIcons name="washing-machine" size={22} color="#fff" />
            </View>
            <View>
              <Text style={s.brandName}>WashAlert</Text>
              <Text style={s.brandSub}>Driver Portal</Text>
            </View>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn}>
              <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.85)" />
              {pending > 0 && <View style={s.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.greetRow}>
          <Text style={s.greetText}>{greeting},</Text>
          <Text style={s.greetName}>{firstName} 👋</Text>
          {error ? <Text style={s.errTxt}>{error}</Text> : null}
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statTile}>
            <Text style={s.statVal}>{tasks.length}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statTile} onPress={() => navigation.navigate('DriverActivityHistory')}>
            <Text style={[s.statVal, { color:'#4ADE80' }]}>{completed}</Text>
            <Text style={s.statLabel}>✅ Done</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <View style={s.statTile}>
            <Text style={[s.statVal, { color:'#FCD34D' }]}>{pending}</Text>
            <Text style={s.statLabel}>🕐 Assigned</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statTile}>
            <Text style={[s.statVal, { color:'#60A5FA' }]}>{activeTasks.length}</Text>
            <Text style={s.statLabel}>🚛 Active</Text>
          </View>
        </View>
      </View>

      {/* Body */}
      <ScrollView
        style={s.body}
        contentContainerStyle={[s.bodyContent, { paddingBottom: 130 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Active Task Banner */}
        {active && (
          <TouchableOpacity
            style={s.activeBanner}
            onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: active.id })}
            activeOpacity={0.88}
          >
            <View style={s.bannerPulseRow}>
              <View style={s.pulseDot} />
              <Text style={s.bannerLiveLabel}>ACTIVE TASK</Text>
            </View>
            <Text style={s.bannerCustomer}>{active.contactName || active.customerName}</Text>
            <View style={s.bannerMeta}>
              <Ionicons name="location-sharp" size={14} color={colors.accent} />
              <Text style={s.bannerAddr} numberOfLines={1}>{active.deliveryAddress || 'Branch pickup'}</Text>
            </View>
            <View style={s.bannerFooter}>
              <View style={[s.bannerBadge, { backgroundColor: getStatusCfg(active.status).bg }]}>
                <Text style={[s.bannerBadgeTxt, { color: getStatusCfg(active.status).color }]}>
                  {getStatusCfg(active.status).label}
                </Text>
              </View>
              <View style={s.resumeBtn}>
                <Ionicons name="play" size={14} color="#fff" />
                <Text style={s.resumeTxt}>Resume</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Active Tasks Section */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Active Tasks ({activeTasks.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
            <Text style={s.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {activeTasks.length === 0 ? (
          <View style={s.emptyCard}>
            <MaterialCommunityIcons name="truck-check-outline" size={48} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No Active Tasks</Text>
            <Text style={s.emptyMsg}>You have no ongoing deliveries right now.</Text>
          </View>
        ) : (
          activeTasks.map(item => {
            const cfg = getStatusCfg(item.status);
            return (
              <TouchableOpacity
                key={item.id}
                style={s.taskCard}
                onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: item.id })}
                activeOpacity={0.8}
              >
                <View style={[s.taskIconBox, { backgroundColor: cfg.bg }]}>
                  <MaterialCommunityIcons name={cfg.icon} size={24} color={cfg.color} />
                </View>
                <View style={s.taskInfo}>
                  <Text style={s.taskCustomer}>{item.contactName || item.customerName}</Text>
                  <Text style={s.taskAddr} numberOfLines={1}>{item.deliveryAddress || 'Branch'}</Text>
                  <View style={[s.taskBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.taskBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            );
          })
        )}

        {/* Recent Completed */}
        {recentCompleted.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recently Completed</Text>
              <TouchableOpacity onPress={() => navigation.navigate('DriverActivityHistory')}>
                <Text style={s.seeAll}>View History →</Text>
              </TouchableOpacity>
            </View>
            {recentCompleted.map(item => (
              <View key={item.id} style={s.completedCard}>
                <View style={s.completedIconBox}>
                  <MaterialCommunityIcons name="check-decagram" size={22} color="#16A34A" />
                </View>
                <View style={s.taskInfo}>
                  <Text style={s.taskCustomer}>{item.contactName || item.customerName}</Text>
                  <Text style={s.taskAddr}>{item.deliveryAddress || 'Branch'}</Text>
                </View>
                <View style={s.doneBadge}>
                  <Text style={s.doneBadgeTxt}>DONE</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Quick Actions */}
        <Text style={[s.sectionTitle, { marginTop: 20, marginBottom: 14 }]}>Quick Access</Text>
        <View style={s.quickGrid}>
          <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate('Deliveries')}>
            <MaterialCommunityIcons name="truck-delivery" size={28} color={colors.primary} />
            <Text style={s.quickLabel}>All Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate('DriverActivityHistory')}>
            <MaterialCommunityIcons name="history" size={28} color="#059669" />
            <Text style={s.quickLabel}>Activity{'\n'}History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate('DriverProfile')}>
            <MaterialCommunityIcons name="account-circle" size={28} color="#7C3AED" />
            <Text style={s.quickLabel}>My Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor: NAV_BG },
  loadScreen:  { flex:1, backgroundColor:NAV_BG, alignItems:'center', justifyContent:'center', gap:12 },
  loadTxt:     { color:'rgba(255,255,255,0.7)', fontSize:14 },
  header:      { backgroundColor:NAV_BG, paddingHorizontal:20, paddingBottom:24 },
  headerTop:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  brandRow:    { flexDirection:'row', alignItems:'center', gap:12 },
  logoBox:     { width:40, height:40, borderRadius:12, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  brandName:   { fontSize:17, fontWeight:'800', color:'#fff' },
  brandSub:    { fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:1 },
  headerActions:{ flexDirection:'row', gap:8 },
  iconBtn:     { width:38, height:38, borderRadius:10, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center', position:'relative' },
  notifDot:    { width:8, height:8, borderRadius:4, backgroundColor:'#FBBF24', position:'absolute', top:6, right:6, borderWidth:2, borderColor:NAV_BG },
  greetRow:    { marginBottom:24 },
  greetText:   { fontSize:13, color:'rgba(255,255,255,0.55)' },
  greetName:   { fontSize:22, fontWeight:'900', color:'#fff', letterSpacing:-0.5 },
  errTxt:      { fontSize:12, color:'#F87171', marginTop:4 },
  statsRow:    { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.07)', borderRadius:18, padding:16, borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  statTile:    { flex:1, alignItems:'center', gap:4 },
  statDivider: { width:1, backgroundColor:'rgba(255,255,255,0.1)' },
  statVal:     { fontSize:26, fontWeight:'900', color:'#fff' },
  statLabel:   { fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:'600' },
  body:        { flex:1, backgroundColor:'#F8FAFC', borderTopLeftRadius:28, borderTopRightRadius:28, marginTop:-16 },
  bodyContent: { paddingTop:28, paddingHorizontal:20 },
  activeBanner:{ backgroundColor:'#fff', borderRadius:22, padding:20, marginBottom:24, borderWidth:2, borderColor:colors.primary, shadowColor:colors.primary, shadowOffset:{width:0,height:6}, shadowOpacity:0.12, shadowRadius:16, elevation:6 },
  bannerPulseRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 },
  pulseDot:    { width:8, height:8, borderRadius:4, backgroundColor:colors.accent },
  bannerLiveLabel:{ fontSize:10, fontWeight:'900', color:colors.accent, letterSpacing:1.5 },
  bannerCustomer:{ fontSize:22, fontWeight:'900', color:colors.text, marginBottom:8 },
  bannerMeta:  { flexDirection:'row', alignItems:'center', gap:6, marginBottom:14 },
  bannerAddr:  { fontSize:13, color:'#64748B', flex:1 },
  bannerFooter:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  bannerBadge: { paddingHorizontal:12, paddingVertical:6, borderRadius:10 },
  bannerBadgeTxt:{ fontSize:12, fontWeight:'800' },
  resumeBtn:   { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:colors.accent, paddingHorizontal:16, paddingVertical:10, borderRadius:50 },
  resumeTxt:   { fontSize:13, fontWeight:'800', color:'#fff' },
  sectionHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  sectionTitle:{ fontSize:17, fontWeight:'800', color:colors.text },
  seeAll:      { fontSize:13, fontWeight:'700', color:colors.accent },
  emptyCard:   { backgroundColor:'#fff', borderRadius:18, padding:32, alignItems:'center', gap:10, borderWidth:1, borderColor:'#E2E8F0', marginBottom:24 },
  emptyTitle:  { fontSize:16, fontWeight:'700', color:colors.text },
  emptyMsg:    { fontSize:13, color:colors.textSecondary, textAlign:'center' },
  taskCard:    { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:18, padding:16, marginBottom:10, borderWidth:1, borderColor:'#E2E8F0', gap:14 },
  taskIconBox: { width:52, height:52, borderRadius:14, alignItems:'center', justifyContent:'center' },
  taskInfo:    { flex:1, gap:4 },
  taskCustomer:{ fontSize:15, fontWeight:'800', color:colors.text },
  taskAddr:    { fontSize:12, color:'#64748B' },
  taskBadge:   { alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:4, borderRadius:8 },
  taskBadgeTxt:{ fontSize:11, fontWeight:'700' },
  completedCard:{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:18, padding:16, marginBottom:10, borderWidth:1, borderColor:'#E2E8F0', gap:14 },
  completedIconBox:{ width:48, height:48, borderRadius:14, backgroundColor:'#F0FDF4', alignItems:'center', justifyContent:'center' },
  doneBadge:   { backgroundColor:'#DCFCE7', paddingHorizontal:10, paddingVertical:5, borderRadius:8 },
  doneBadgeTxt:{ fontSize:11, fontWeight:'900', color:'#16A34A' },
  quickGrid:   { flexDirection:'row', gap:12, marginBottom:20 },
  quickCard:   { flex:1, backgroundColor:'#fff', borderRadius:18, padding:18, alignItems:'center', gap:10, borderWidth:1, borderColor:'#E2E8F0' },
  quickLabel:  { fontSize:12, fontWeight:'700', color:colors.text, textAlign:'center' },
});
