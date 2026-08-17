import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { driverOrders } from '../../services/api';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ASSIGNED_FOR_DELIVERY: { label: 'Assigned',          color: '#3B82F6', bg: 'hsla(214,88%,57%,0.12)' },
  EN_ROUTE_TO_BRANCH:    { label: 'Heading to Branch', color: '#F59E0B', bg: 'hsla(38,96%,58%,0.12)'  },
  PICKED_UP_FROM_BRANCH: { label: 'Out for Delivery',  color: '#10B981', bg: 'hsla(160,71%,39%,0.12)' },
  OUT_FOR_DELIVERY:      { label: 'Out for Delivery',  color: '#10B981', bg: 'hsla(160,71%,39%,0.12)' },
  DELIVERED:             { label: 'Completed',         color: '#10B981', bg: 'hsla(160,71%,39%,0.12)' },
  COLLECTION_FAILED:     { label: 'Failed',            color: '#EF4444', bg: 'hsla(0,86%,60%,0.12)'   },
};
const getStatusCfg = (s) =>
  STATUS_CONFIG[s] || { label: s, color: colors.textSecondary, bg: colors.surfaceVariant };

const ACTIVE_STATUSES = [
  'ASSIGNED_FOR_DELIVERY', 'EN_ROUTE_TO_BRANCH', 'PICKED_UP_FROM_BRANCH', 'OUT_FOR_DELIVERY'
];

// ─── Component ────────────────────────────────────────────────────────────────
const DriverDashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tasks, setTasks]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState('');
  const [visibleDeliveries, setVisibleDeliveries] = useState(4);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Driver';

  const loadData = useCallback(async () => {
    try {
      setError('');
      const response = await driverOrders.getTasks(0, 50);
      const sorted = (response.content || []).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      setTasks(sorted);
      setVisibleDeliveries(4);
    } catch (e) {
      setTasks([]);
      setError(e?.message || 'Unable to load driver tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      const poll = setInterval(loadData, 30000);
      return () => clearInterval(poll);
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setVisibleDeliveries(4);
    loadData();
  }, [loadData]);

  const DONE_STATUSES   = ['delivered', 'DELIVERED'];
  const ACTIVE_STATUSES_LOWER = ['assigned_for_delivery', 'en_route_to_branch', 'picked_up_from_branch', 'out_for_delivery', 'delivering'];

  const completed = tasks.filter((d) => DONE_STATUSES.includes(d.status)).length;
  const active    = tasks.find((d) =>
    ['ASSIGNED_FOR_DELIVERY', 'EN_ROUTE_TO_BRANCH', 'PICKED_UP_FROM_BRANCH', 'OUT_FOR_DELIVERY'].includes(d.status)
  );
  // Assigned = anything not yet delivered/failed
  const pending   = tasks.filter((d) =>
    !DONE_STATUSES.includes(d.status) &&
    !['cancelled', 'COLLECTION_FAILED', 'failed'].includes(d.status)
  ).length;

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Dark navy header ─────────────────────────────────────────── */}
      <View style={[styles.navBar, { paddingTop: insets.top + 4 }]}>
        {/* Logo + Brand */}
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="washing-machine" size={22} color="#fff" />
          </View>
          <Text style={styles.brandName}>WashAlert</Text>
        </View>
        {/* Actions */}
        <View style={styles.navActions}>
          <TouchableOpacity style={styles.navBtn}>
            <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('DriverNotifications')}>
            <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.85)" />
            {/* Notification dot */}
            {pending > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hero greeting inside nav (still dark) ────────────────────── */}
      <View style={styles.heroSection}>
        <Text style={styles.heroGreeting}>{greeting}, <Text style={styles.heroName}>{firstName} 👋</Text></Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Stat tiles */}
        <View style={styles.tilesRow}>
          <View style={styles.tile}>
            <MaterialCommunityIcons name="package-variant-closed" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.tileValue}>{tasks.length}</Text>
            <Text style={styles.tileLabel}>Total</Text>
          </View>
          <View style={styles.tile}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color="#4ADE80" />
            <Text style={[styles.tileValue, { color: '#4ADE80' }]}>{completed}</Text>
            <Text style={styles.tileLabel}>Done</Text>
          </View>
          <View style={styles.tile}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#FCD34D" />
            <Text style={[styles.tileValue, { color: '#FCD34D' }]}>{pending}</Text>
            <Text style={styles.tileLabel}>Assigned</Text>
          </View>
        </View>
      </View>

      {/* ── White card body ──────────────────────────────────────────── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Active banner */}
        {active ? (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: active.id })}
            activeOpacity={0.85}
          >
            <View style={styles.bannerRow}>
              <View style={styles.bannerMainInfo}>
                <View style={styles.activeLabelRow}>
                   <View style={styles.pulseDot} />
                   <Text style={styles.activeLabelText}>ACTIVE TASK</Text>
                </View>
                <Text style={styles.bannerSubLabel}>PERSON TO MEET</Text>
                <Text style={styles.bannerCustomer}>{active.customerName || active.contactName || 'Customer'}</Text>
                <View style={styles.bannerStatusBadge}>
                   <Text style={styles.bannerStatusText}>{getStatusCfg(active.status).label}</Text>
                </View>
              </View>
              <View style={styles.bannerAction}>
                 <View style={styles.resumeCircle}>
                    <Ionicons name="play" size={20} color="#FFF" />
                 </View>
                 <Text style={styles.resumeLabel}>Resume</Text>
              </View>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerFooter}>
               <Ionicons name="location-sharp" size={14} color={colors.accent} />
               <Text style={styles.bannerAddress} numberOfLines={1}>{active.deliveryAddress || 'Branch'}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Today's Deliveries */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Tasks</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Deliveries')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {!tasks.length ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="truck-check-outline" size={42} color={colors.border} />
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyMsg}>No delivery tasks assigned to you yet.</Text>
          </View>
        ) : (
          <>
            {tasks.slice(0, visibleDeliveries).map((item) => {
              const cfg = getStatusCfg(item.status);
              const isCompleted = item.status === 'DELIVERED';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.taskCard}
                  onPress={() => item?.id && navigation.navigate('DeliveryDetail', { deliveryId: item.id })}
                  activeOpacity={0.75}
                >
                  <View style={styles.taskCardTop}>
                    <View style={styles.taskIconBox}>
                       <MaterialCommunityIcons 
                         name={isCompleted ? "check-circle" : "package-variant"} 
                         size={22} 
                         color={isCompleted ? "#4ADE80" : colors.primary} 
                       />
                    </View>
                    <View style={styles.taskMeta}>
                       <Text style={styles.taskCustomer}>{item.customerName || item.contactName || 'Customer'}</Text>
                       <Text style={styles.taskOrderNum}>#{item.trackingNumber || item.id}</Text>
                       <Text style={styles.taskStatus}>
                         {cfg.label}
                         {item.bookingDate ? ` · ${new Date(item.bookingDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}` : ''}
                         {item.scheduleTime ? ` · ${item.scheduleTime}` : ''}
                       </Text>
                       {(item.deliveryAddress || item.delivery?.address) ? (
                         <Text style={styles.taskAddress} numberOfLines={1}>
                           📍 {item.deliveryAddress || item.delivery?.address}
                         </Text>
                       ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                  </View>
                </TouchableOpacity>
              );
            })}
            {tasks.length > visibleDeliveries && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setVisibleDeliveries((p) => p + 4)}
              >
                <Text style={styles.loadMoreText}>Load More Tasks</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const NAV_BG = '#0F2044'; // deep navy — matches customer home header

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: NAV_BG },
  loadingScreen:{ flex: 1, backgroundColor: NAV_BG, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  // ── Nav bar ──────────────────────────────────────────────────────────────
  navBar:{
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:20, paddingBottom:8,
    backgroundColor: NAV_BG,
  },
  brandRow:   { flexDirection:'row', alignItems:'center', gap:10 },
  logoBox:{
    width:36, height:36, borderRadius:10,
    backgroundColor:'rgba(255,255,255,0.12)',
    alignItems:'center', justifyContent:'center',
  },
  brandName:  { fontSize:18, fontWeight:'800', color:'#fff', letterSpacing:0.2 },
  navActions: { flexDirection:'row', alignItems:'center', gap:6 },
  navBtn:{
    width:36, height:36, borderRadius:10,
    backgroundColor:'rgba(255,255,255,0.1)',
    alignItems:'center', justifyContent:'center',
    position:'relative',
  },
  notifDot:{
    width:7, height:7, borderRadius:4,
    backgroundColor:'#FBBF24',
    position:'absolute', top:6, right:6,
    borderWidth:1.5, borderColor:NAV_BG,
  },

  // ── Hero greeting + tiles ─────────────────────────────────────────────────
  heroSection:{
    backgroundColor: NAV_BG,
    paddingHorizontal:20, paddingBottom:32, paddingTop:12,
  },
  heroGreeting:{ fontSize:14, color:'rgba(255,255,255,0.6)', marginBottom:2 },
  heroName:   { fontSize:14, fontWeight:'700', color:'#fff' },
  errorText:  { fontSize:12, color:'#F87171', marginTop:4 },

  tilesRow:{ flexDirection:'row', gap:10, marginTop:18 },
  tile:{
    flex:1, backgroundColor:'rgba(255,255,255,0.08)',
    borderRadius:16, paddingVertical:16,
    alignItems:'center', gap:6,
    borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
  },
  tileValue:{ fontSize:24, fontWeight:'900', color:'#fff' },
  tileLabel:{ fontSize:10, fontWeight:'600', color:'rgba(255,255,255,0.5)', letterSpacing:0.3 },

  // ── White body ────────────────────────────────────────────────────────────
  body:{ flex:1, backgroundColor:'#F5F7FA', borderTopLeftRadius:28, borderTopRightRadius:28, marginTop:-20 },
  bodyContent:{ paddingTop:24, paddingHorizontal:20 },

  // Available / active banner
  // Active Task Banner
  activeBanner: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerMainInfo: { flex: 1 },
  activeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  activeLabelText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 1.2,
  },
  bannerSubLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2,
  },
  bannerCustomer: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
  },
  bannerStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bannerStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  bannerAction: {
    alignItems: 'center',
    gap: 4,
  },
  resumeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  resumeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  bannerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  bannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },

  // Section
  sectionHeader:{
    flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12,
  },
  sectionTitle:{ fontSize:18, fontWeight:'800', color: colors.text },
  seeAll:{ fontSize:13, fontWeight:'600', color: colors.accent },

  // Empty
  emptyCard:{
    backgroundColor:'#fff', borderRadius:16, padding:32,
    alignItems:'center', borderWidth:1, borderColor:'rgba(0,0,0,0.06)', gap:8,
  },
  emptyTitle:{ fontSize:15, fontWeight:'700', color: colors.text },
  emptyMsg:{ fontSize:13, color: colors.textSecondary, textAlign:'center' },

  // Task Card
  taskCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskMeta: { flex: 1 },
  taskCustomer: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  taskOrderNum: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  taskStatus: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
    marginTop: 1,
  },
  taskAddress: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },

  // Load more
  loadMoreBtn:{
    borderRadius:12, borderWidth:1, borderColor:'rgba(0,0,0,0.08)',
    backgroundColor:'#fff', paddingVertical:13, alignItems:'center', marginTop:2,
  },
  loadMoreText:{ fontSize:13, fontWeight:'700', color: colors.primary },
});

export default DriverDashboardScreen;
