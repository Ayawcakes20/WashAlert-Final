import React, { useState, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, FlatList,
  TouchableOpacity, Image, Animated, Dimensions, StyleSheet
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors } from '../../theme/colors';
import { LoadingSkeleton } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { bookings as bookingsApi, BRANCH_CATALOG } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SERVICES = [
  { id: 'w7',  img: require('../../../assets/images/svc_wash_v3.png'), tag: 'Standard', price: '₱80 / 7kg',  name: 'Wash' },
  { id: 'd7',  img: require('../../../assets/images/svc_dry_v3.png'),  tag: 'Standard', price: '₱90 / 7kg',  name: 'Dry' },
  { id: 'b7p', img: require('../../../assets/images/svc_wash_v3.png'), tag: 'Premium',  price: '₱245 / 8kg', name: 'Basic Full (Pure)' },
  { id: 'eco', img: require('../../../assets/images/svc_wash.png'),    tag: 'Eco',      price: '₱220 / 5kg', name: 'Ecowash Full' },
];

const GUIDES = [
  { id: 'max', icon: 'weight-kilogram', label: '9kg Maximum', sub: 'Absolute limit per load', color: '#EF4444' },
  { id: 'clothes', icon: 'tshirt-crew', label: '8kg Pure Clothes', sub: 'Standard clothing items', color: colors.primary },
  { id: 'bedding', icon: 'bed-double', label: '7kg Mixed Loads', sub: 'With towels or beddings', color: '#7C3AED' },
];

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

  const displayStatus = status.replace(/_/g, ' ').toUpperCase();
  const isAwaitingPrice = status === 'awaiting_price';

  return (
    <TouchableOpacity 
      style={[s.activeCard, isAwaitingPrice && s.activeCardUrgent]} 
      onPress={() => navigation.navigate('Orders', { screen: 'OrderDetail', params: { orderId: order.id } })}
      activeOpacity={0.9}
    >
      <View style={s.cardHeader}>
        <View style={s.statusBadge}>
          <View style={[s.dot, { backgroundColor: isAwaitingPrice ? colors.primary : '#10B981' }]} />
          <Text style={s.statusText}>{displayStatus}</Text>
        </View>
        <Text style={s.orderId}>#{order.trackingNumber}</Text>
      </View>
      <Text style={s.activeTitle}>{isAwaitingPrice ? 'Action Required: Price Ready' : 'Order in Progress'}</Text>
      <View style={s.cardFooter}>
        <Text style={s.branchLabel}>{order.branchName}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
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
        </View>
        <Text style={s.svcPrice}>{item.price}</Text>
        <Text style={s.svcName}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderBranchItem = ({ item }) => (
    <View style={s.branchCard}>
      <View style={s.branchIconBox}>
        <MaterialCommunityIcons name="storefront" size={20} color={colors.primary} />
      </View>
      <View style={s.branchDetails}>
        <Text style={s.branchNameText}>{item.name}</Text>
        <Text style={s.branchAddrText} numberOfLines={1}>{item.address}</Text>
      </View>
    </View>
  );

  if (loading) return <LoadingSkeleton />;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Minimalist Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greetText}>Welcome back,</Text>
          <Text style={s.headerName}>{user?.fullName?.split(' ')[0] || 'User'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={s.iconBtn}>
          <Ionicons name="notifications-outline" size={24} color="#fff" />
          {activeOrders.length > 0 && <View style={s.notifBadge} />}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
        {/* Services Horizontal Section */}
        <View style={s.hero}>
          <View style={s.heroHeader}>
            <Text style={s.heroTitle}>Laundry Services</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Book')}>
              <Text style={s.bookNow}>Book Now</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={SERVICES}
            renderItem={renderServiceCard}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.svcList}
          />
        </View>

        {/* Sticky Active Orders Banner if any */}
        {activeOrders.length > 0 ? (
          <View style={s.activeSection}>
            <Text style={s.sectionTitle}>Track Active Orders</Text>
            {(activeOrders || []).slice(0, 2).map(order => <ActiveOrderCard key={order.id} order={order} navigation={navigation} />)}
          </View>
        ) : <View style={{ height: 10 }} />}

        {/* Service Standards Guide */}
        <View style={s.guideSection}>
          <Text style={s.sectionTitle}>Laundry Standards Guide</Text>
          <View style={s.guideGrid}>
            {GUIDES.map(g => (
              <View key={g.id} style={s.guideCard}>
                <MaterialCommunityIcons name={g.icon} size={24} color={g.color} />
                <View style={s.guideInfo}>
                  <Text style={s.guideLabel}>{g.label}</Text>
                  <Text style={s.guideSub}>{g.sub}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.madnessInfo}>
            <Ionicons name="information-circle" size={16} color={colors.primary} />
            <Text style={s.madnessText}>Madness Fee: ₱50 per kg if above service limit.</Text>
          </View>
        </View>

        {/* Branches Preview Section */}
        <View style={s.branchSection}>
          <View style={s.heroHeader}>
            <Text style={s.sectionTitle}>Our Branches</Text>
            <Text style={s.branchCity}>Available in Makati & QC</Text>
          </View>
          <FlatList
            data={(BRANCH_CATALOG || []).slice(0, 5)}
            renderItem={renderBranchItem}
            keyExtractor={item => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.branchList}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2044' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  greetText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#0F2044' },
  hero: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24, paddingBottom: 24 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  bookNow: { fontSize: 14, fontWeight: '700', color: colors.primary },
  svcList: { paddingLeft: 24, paddingRight: 8 },
  svcCard: { width: SCREEN_WIDTH * 0.4, backgroundColor: '#F8FAFC', borderRadius: 24, marginRight: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
  svcImg: { width: '100%', height: 110, backgroundColor: '#eee' },
  svcInfo: { padding: 12 },
  svcTag: { backgroundColor: '#E0E7FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6 },
  svcTagText: { fontSize: 9, fontWeight: '800', color: colors.primary },
  svcPrice: { fontSize: 13, fontWeight: '800', color: colors.primary },
  svcName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  activeSection: { backgroundColor: '#F8FAFC', padding: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 16 },
  activeCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  activeCardUrgent: { borderColor: colors.primary, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', color: colors.textSecondary },
  orderId: { fontSize: 11, fontWeight: '700', color: colors.textTertiary },
  activeTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  branchLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
  guideSection: { backgroundColor: '#fff', padding: 24 },
  guideGrid: { gap: 12 },
  guideCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  guideInfo: { flex: 1 },
  guideLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  guideSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  madnessInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: '#F0F4FF', padding: 12, borderRadius: 12 },
  madnessText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  branchSection: { backgroundColor: '#F8FAFC', paddingVertical: 24 },
  branchCity: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
  branchList: { paddingLeft: 24, paddingRight: 8 },
  branchCard: { width: SCREEN_WIDTH * 0.65, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginRight: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  branchIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center' },
  branchDetails: { flex: 1 },
  branchNameText: { fontSize: 14, fontWeight: '800', color: colors.text },
  branchAddrText: { fontSize: 12, color: colors.textTertiary, marginTop: 2 }
});