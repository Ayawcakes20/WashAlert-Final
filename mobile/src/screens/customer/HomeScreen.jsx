import React, { useState, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, FlatList,
  TouchableOpacity, Image, Animated, Dimensions
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors } from '../../theme/colors';
import { LoadingSkeleton } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { bookings as bookingsApi } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Static Service Data (Matching Image 3 Style) ---
const SERVICES = [
  { id: 'w7',  img: require('../../../assets/images/svc_wash_v3.png'), tag: 'Standard', price: '₱80 / 7kg',  name: 'Wash' },
  { id: 'd7',  img: require('../../../assets/images/svc_dry_v3.png'),  tag: 'Standard', price: '₱90 / 7kg',  name: 'Dry' },
  { id: 'b7p', img: require('../../../assets/images/svc_wash_v3.png'), tag: 'Premium',  price: '₱245 / 8kg', name: 'Basic Full (Pure)' },
  { id: 'eco', img: require('../../../assets/images/svc_wash.png'),    tag: 'Eco',      price: '₱220 / 5kg', name: 'Ecowash Full' },
];

const STATUS_STEPS = ['pending', 'received', 'washing', 'drying', 'ready'];
const STATUS_STEP_LABELS = ['Pending', 'Received', 'Washing', 'Drying', 'Ready'];
const ACTIVE_STATUSES = ['pending', 'received', 'awaiting_price', 'washing', 'drying', 'ready', 'delivering'];

const normalize = (s) => {
  const raw = String(s || '').trim().toLowerCase().replace(/ /g, '_');
  const map = {
    received: 'received', pending: 'pending',
    awaiting_price: 'awaiting_price', price_approved: 'washing',
    washing: 'washing', drying: 'drying', ready: 'ready',
    delivering: 'delivering', delivered: 'delivered',
  };
  return map[raw] || raw;
};

function ActiveOrderCard({ order, navigation }) {
  const [status, setStatus] = useState(normalize(order.status));

  React.useEffect(() => {
    const tn = order.trackingNumber || String(order.id);
    const unsub = onSnapshot(doc(db, 'orders', tn), snap => {
      if (snap.exists()) setStatus(normalize(snap.data().status));
    });
    return () => unsub();
  }, [order.id]);

  const stepIdx = STATUS_STEPS.indexOf(status);

  return (
    <View style={s.activeCard}>
      <View style={s.cardHeader}>
        <View style={s.statusBadge}>
          <View style={s.dot} />
          <Text style={s.statusText}>{status.toUpperCase().replace(/_/g, ' ')}</Text>
        </View>
        <TouchableOpacity 
          style={s.trackBtn}
          onPress={() => navigation.navigate('Tracking', { orderId: order.id })}
        >
          <Ionicons name="navigate" size={14} color="#fff" />
          <Text style={s.trackBtnText}>Track Live</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.orderTitle}>{status.replace(/_/g, ' ')}</Text>
      <Text style={s.orderNum}>Order #{order.trackingNumber || order.id}</Text>

      <View style={s.progressRow}>
        {STATUS_STEPS.map((step, i) => (
          <View key={step} style={s.stepWrap}>
            <View style={[s.stepDot, i <= stepIdx && s.stepDotActive]} />
            <Text style={[s.stepLabel, i === stepIdx && s.stepLabelActive]}>{STATUS_STEP_LABELS[i]}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={s.detailsBtn}
        onPress={() => navigation.navigate('Orders', { screen: 'OrderDetail', params: { orderId: order.id } })}
      >
        <Ionicons name="document-text-outline" size={16} color={colors.text} />
        <Text style={s.detailsBtnText}>View Details</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActive] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await bookingsApi.getMyBookings('all');
      setActive((res.bookings || []).filter(o => ACTIVE_STATUSES.includes(normalize(o.status))));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const renderServiceCard = ({ item }) => (
    <TouchableOpacity style={s.svcCard} activeOpacity={0.9} onPress={() => navigation.navigate('Book')}>
      <Image source={item.img} style={s.svcImg} />
      <View style={s.svcInfo}>
        <View style={s.svcTag}>
          <Text style={s.svcTagText}>{item.tag}</Text>
          <Ionicons name="arrow-up-outline" size={12} color={colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
        </View>
        <Text style={s.svcPrice}>{item.price}</Text>
        <Text style={s.svcName}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <LoadingSkeleton />;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Image source={require('../../../assets/images/icon.png')} style={s.logo} />
          <Text style={s.headerTitle}>WashAlert</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Chat')} style={s.iconBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.greetText}>Hi {user?.fullName?.split(' ')[0] || 'Amanda'}, Here's</Text>
          <Text style={s.heroTitle}>Our Laundry Services.</Text>
          
          <FlatList
            data={SERVICES}
            renderItem={renderServiceCard}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.svcList}
          />
        </View>

        <View style={s.body}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Active Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {activeOrders.length > 0 ? (
            activeOrders.map(order => <ActiveOrderCard key={order.id} order={order} navigation={navigation} />)
          ) : (
            <View style={s.emptyOrders}>
              <Text style={s.emptyText}>No active orders at the moment.</Text>
            </View>
          )}

          {/* Business Hours Info */}
          <View style={s.infoCard}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={s.infoText}>Operating Hours: 7:00 AM - 10:00 PM</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = {
  container: { flex: 1, backgroundColor: '#0F2044' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerRight: { flexDirection: 'row', gap: 12 },
  iconBtn: { padding: 4 },
  hero: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 32 },
  greetText: { fontSize: 16, color: colors.textSecondary },
  heroTitle: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 20 },
  svcList: { paddingRight: 24 },
  svcCard: { width: SCREEN_WIDTH * 0.42, backgroundColor: '#F5F7FA', borderRadius: 24, marginRight: 16, overflow: 'hidden' },
  svcImg: { width: '100%', height: 120, backgroundColor: '#eee' },
  svcInfo: { padding: 16 },
  svcTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E0E7FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  svcTagText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  svcPrice: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 2 },
  svcName: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { backgroundColor: '#F5F7FA', padding: 24, minHeight: 400 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  activeCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  statusText: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1C2F3E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  trackBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  orderTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  orderNum: { fontSize: 14, color: colors.textTertiary, marginBottom: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  stepWrap: { alignItems: 'center', gap: 8 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E2E8F0' },
  stepDotActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '500' },
  stepLabelActive: { color: colors.text, fontWeight: '700' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 12, borderRadius: 12 },
  detailsBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 16, borderRadius: 16, marginTop: 16 },
  infoText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  emptyOrders: { padding: 32, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, fontSize: 14 }
};