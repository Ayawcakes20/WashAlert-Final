import React, { useState, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { bookings as bookingsApi } from '../../services/api';
import { colors } from '../../theme/colors';

const { width: SW } = Dimensions.get('window');

// ─── Pricing Data ─────────────────────────────────────────────────────────────
const SERVICES = [
  {
    id: 'basic8', icon: 'washing-machine', color: '#1E40AF', bg: '#DBEAFE',
    name: 'Basic Full Service', capacity: '8kg (Pure Clothes)',
    price: '₱245', tag: '⭐ Most Popular',
    desc: 'Full wash + dry + fold. Best for everyday clothes.',
  },
  {
    id: 'basic7', icon: 'washing-machine', color: '#1E40AF', bg: '#EFF6FF',
    name: 'Basic Full Service', capacity: '7kg (With Towels/Beddings)',
    price: '₱240', tag: 'With Beddings',
    desc: 'Full wash + dry + fold. Includes towels & sheets.',
  },
  {
    id: 'eco', icon: 'leaf', color: '#059669', bg: '#D1FAE5',
    name: 'Ecowash Full Service', capacity: '5kg',
    price: '₱220', tag: '💚 Budget Pick',
    desc: 'Eco-friendly wash cycle. Light loads only.',
  },
  {
    id: 'premium8', icon: 'star', color: '#7C3AED', bg: '#EDE9FE',
    name: 'Premium Full Service', capacity: '8kg (Pure Clothes)',
    price: '₱275', tag: '✨ Premium',
    desc: 'Premium detergent + conditioner included.',
  },
  {
    id: 'premium7', icon: 'star', color: '#7C3AED', bg: '#F5F3FF',
    name: 'Premium Full Service', capacity: '7kg (With Towels/Beddings)',
    price: '₱270', tag: 'Premium + Beddings',
    desc: 'Premium service for mixed loads.',
  },
  {
    id: 'wash', icon: 'water', color: '#0369A1', bg: '#E0F2FE',
    name: 'Wash Only', capacity: '7kg',
    price: '₱80', tag: 'Wash Only',
    desc: 'Machine wash cycle only. No drying.',
  },
  {
    id: 'dry', icon: 'weather-sunny', color: '#EA580C', bg: '#FFF7ED',
    name: 'Dry Only', capacity: '7kg',
    price: '₱90', tag: 'Dry Only',
    desc: 'Tumble dry cycle only.',
  },
  {
    id: 'handwash', icon: 'hand-wash', color: '#0F766E', bg: '#CCFBF1',
    name: 'Handwash', capacity: '1–3kg / 3kg+',
    price: '₱150/kg · ₱90/kg', tag: '🖐 Hand Care',
    desc: 'Delicates & hand-wash items. Per kilogram.',
  },
];

const SUPPLIES = [
  { name: 'Surf Detergent (Basic)', price: '₱25', icon: 'package-variant', color: '#2563EB' },
  { name: 'Ariel Detergent (Premium)', price: '₱30', icon: 'package-variant', color: '#7C3AED' },
  { name: 'Charm Fabcon (Basic)', price: '₱15', icon: 'bottle-tonic', color: '#059669' },
  { name: 'Downy Fabcon (Premium)', price: '₱25', icon: 'bottle-tonic', color: '#0891B2' },
];

const ACTIVE_STATUSES = ['pending','received','awaiting_price','washing','drying','ready','delivering'];
const STATUS_DISPLAY = {
  pending: 'Pending Confirmation', received: 'Order Received',
  awaiting_price: '⚡ Price Ready — Tap to Confirm', washing: 'Washing in Progress',
  drying: 'Drying in Progress', ready: 'Ready for Pickup',
  delivering: 'Out for Delivery', delivered: 'Delivered',
};
const STATUS_COLOR = {
  pending:'#F59E0B', received:'#3B82F6', awaiting_price:'#EA580C',
  washing:'#8B5CF6', drying:'#8B5CF6', ready:'#10B981',
  delivering:'#1C2F3E', delivered:'#10B981',
};
const normalize = s => {
  const raw = String(s||'').trim().toLowerCase().replace(/ /g,'_');
  const map = {
    received:'received', pending:'pending',
    awaiting_price:'awaiting_price', awaiting_price_confirmation:'awaiting_price',
    price_approved:'washing', washing:'washing', drying:'drying', ready:'ready',
    pending_pickup:'ready', en_route_to_pickup:'delivering',
    picked_up:'delivering', in_transit:'delivering', delivering:'delivering',
    delivered:'delivered', cancelled:'cancelled',
  };
  return map[raw] || raw;
};

// ─── Active Order Card ─────────────────────────────────────────────────────────
function ActiveOrderCard({ order, navigation }) {
  const [status, setStatus] = useState(normalize(order.status));
  React.useEffect(() => {
    const tn = order.trackingNumber || String(order.id);
    try {
      const unsub = onSnapshot(doc(db,'orders',tn), snap => {
        if (snap.exists()) setStatus(normalize(snap.data().status||''));
      }, ()=>{});
      return () => unsub();
    } catch { return ()=>{}; }
  }, [order.trackingNumber, order.id]);

  const color = STATUS_COLOR[status] || colors.primary;
  const label = STATUS_DISPLAY[status] || status.replace(/_/g,' ');
  const isPriceReady = status === 'awaiting_price';

  return (
    <TouchableOpacity
      style={[cs.activeCard, isPriceReady && cs.activeCardUrgent]}
      onPress={() => navigation.navigate('Orders', { screen:'OrderDetail', params:{ orderId:order.id } })}
      activeOpacity={0.88}
    >
      <View style={cs.activeCardTop}>
        <View style={[cs.statusDot, { backgroundColor: color }]} />
        <Text style={[cs.activeStatus, { color }]}>{label}</Text>
        <TouchableOpacity
          style={cs.trackBtn}
          onPress={() => navigation.navigate('Tracking', { orderId:order.id })}
        >
          <Ionicons name="navigate" size={13} color="#fff" />
          <Text style={cs.trackTxt}>Track</Text>
        </TouchableOpacity>
      </View>
      <Text style={cs.activeOrderId}>Order #{order.trackingNumber || order.id}</Text>
      <Text style={cs.activeBranch}>{order.branchName || order.branch || 'Branch'}</Text>
      {isPriceReady && (
        <View style={cs.priceReadyBanner}>
          <Ionicons name="receipt" size={16} color="#EA580C" />
          <Text style={cs.priceReadyTxt}>Tap to view your receipt & pay</Text>
          <Ionicons name="chevron-forward" size={16} color="#EA580C" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [activeOrders, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllServices, setShowAllServices] = useState(false);
  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await bookingsApi.getMyBookings('all');
        const all = res.bookings || [];
        setActive(all.filter(o => ACTIVE_STATUSES.includes(normalize(o.status))));
      } catch {}
      finally { setLoading(false); }
    })();
  }, []));

  const visibleServices = showAllServices ? SERVICES : SERVICES.slice(0, 4);

  return (
    <SafeAreaView style={cs.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={cs.header}>
        <View style={cs.headerLeft}>
          <Image source={require('../../../assets/images/icon.png')} style={cs.logo} resizeMode="contain" />
          <View>
            <Text style={cs.headerGreet}>{greeting} 👋</Text>
            <Text style={cs.headerName}>{firstName}</Text>
          </View>
        </View>
        <View style={cs.headerRight}>
          <TouchableOpacity style={cs.iconBtn} onPress={() => navigation.navigate('Chat')}>
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={cs.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={cs.scroll}>

        {/* ── Hero CTA ── */}
        <TouchableOpacity style={cs.heroCta} onPress={() => navigation.navigate('Book')} activeOpacity={0.9}>
          <View style={cs.heroCtaLeft}>
            <Text style={cs.heroCtaTag}>✨ Free Pickup · Free Delivery</Text>
            <Text style={cs.heroCtaTitle}>Book Your{'\n'}Laundry Now</Text>
            <View style={cs.heroCtaBtn}>
              <Text style={cs.heroCtaBtnTxt}>Get Started →</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="washing-machine" size={80} color="rgba(255,255,255,0.15)" style={cs.heroIcon} />
        </TouchableOpacity>

        {/* ── Active Orders ── */}
        {activeOrders.length > 0 && (
          <View style={cs.section}>
            <View style={cs.sectionRow}>
              <View style={cs.activePulse} />
              <Text style={cs.sectionTitle}>Active Orders</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                <Text style={cs.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {activeOrders.map(o => <ActiveOrderCard key={o.id} order={o} navigation={navigation} />)}
          </View>
        )}

        {/* ── Body Sheet ── */}
        <View style={cs.sheet}>

          {/* Machine Capacity Guide */}
          <View style={cs.guideCard}>
            <View style={cs.guideCardHeader}>
              <View style={cs.guideIconBox}>
                <Ionicons name="information-circle" size={20} color="#fff" />
              </View>
              <View>
                <Text style={cs.guideCardTitle}>Machine Capacity Guide</Text>
                <Text style={cs.guideCardSub}>Know your limits before booking</Text>
              </View>
            </View>
            <View style={cs.guideGrid}>
              {[
                { kg:'9kg', label:'Max Capacity', color:'#EF4444', bg:'#FEF2F2' },
                { kg:'8kg', label:'Pure Clothes', color:'#2563EB', bg:'#EFF6FF' },
                { kg:'7kg', label:'With Towels', color:'#059669', bg:'#F0FDF4' },
              ].map(g => (
                <View key={g.kg} style={[cs.guideChip, { backgroundColor: g.bg }]}>
                  <Text style={[cs.guideKg, { color: g.color }]}>{g.kg}</Text>
                  <Text style={[cs.guideKgLabel, { color: g.color }]}>{g.label}</Text>
                </View>
              ))}
            </View>
            <View style={cs.guideNotes}>
              <View style={cs.guideNoteRow}>
                <View style={[cs.guideDot, { backgroundColor:'#EA580C' }]} />
                <Text style={cs.guideNoteTxt}><Text style={{fontWeight:'800'}}>Madness Fee:</Text> ₱50 per extra kg over limit</Text>
              </View>
              <View style={cs.guideNoteRow}>
                <View style={[cs.guideDot, { backgroundColor:'#7C3AED' }]} />
                <Text style={cs.guideNoteTxt}><Text style={{fontWeight:'800'}}>Rush Fee:</Text> +₱150 per load for same-day priority</Text>
              </View>
              <View style={cs.guideNoteRow}>
                <View style={[cs.guideDot, { backgroundColor:'#059669' }]} />
                <Text style={cs.guideNoteTxt}><Text style={{fontWeight:'800'}}>Hours:</Text> Open Daily 7:00 AM – 10:00 PM</Text>
              </View>
            </View>
          </View>

          {/* Services & Pricing */}
          <View style={cs.sectionRow}>
            <Text style={cs.sectionTitle}>Services & Pricing</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Book')}>
              <Text style={cs.seeAll}>Book now</Text>
            </TouchableOpacity>
          </View>

          {visibleServices.map(svc => (
            <TouchableOpacity
              key={svc.id}
              style={cs.svcRow}
              onPress={() => navigation.navigate('Book')}
              activeOpacity={0.85}
            >
              <View style={[cs.svcIconBox, { backgroundColor: svc.bg }]}>
                <MaterialCommunityIcons name={svc.icon} size={24} color={svc.color} />
              </View>
              <View style={cs.svcInfo}>
                <View style={cs.svcTopRow}>
                  <Text style={cs.svcName}>{svc.name}</Text>
                  <Text style={[cs.svcPrice, { color: svc.color }]}>{svc.price}</Text>
                </View>
                <Text style={cs.svcCapacity}>{svc.capacity}</Text>
                <Text style={cs.svcDesc}>{svc.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={cs.showMoreBtn} onPress={() => setShowAllServices(v => !v)}>
            <Text style={cs.showMoreTxt}>{showAllServices ? 'Show Less ↑' : `Show All ${SERVICES.length} Services ↓`}</Text>
          </TouchableOpacity>

          {/* Supplies Pricing */}
          <Text style={[cs.sectionTitle, { marginTop: 24, marginBottom: 14 }]}>Supplies Add-ons</Text>
          <View style={cs.suppliesGrid}>
            {SUPPLIES.map(s => (
              <View key={s.name} style={cs.supplyCard}>
                <MaterialCommunityIcons name={s.icon} size={22} color={s.color} />
                <Text style={cs.supplyPrice}>{s.price}</Text>
                <Text style={cs.supplyName}>{s.name}</Text>
              </View>
            ))}
          </View>

          {/* Operating Hours Card */}
          <View style={cs.hoursCard}>
            <View style={cs.hoursTop}>
              <View style={cs.hoursIconBox}>
                <Ionicons name="time" size={20} color="#fff" />
              </View>
              <View>
                <Text style={cs.hoursTitle}>Business Hours</Text>
                <Text style={cs.hoursSub}>We accept bookings within these hours</Text>
              </View>
            </View>
            <View style={cs.hoursBadge}>
              <View style={cs.openDot} />
              <Text style={cs.hoursTime}>7:00 AM – 10:00 PM</Text>
              <Text style={cs.hoursDaily}>Daily</Text>
            </View>
            <Text style={cs.hoursNote}>
              Bookings outside operating hours will not be accepted. Same-day slots depend on availability.
            </Text>
          </View>

          {/* Why Choose Us */}
          <Text style={[cs.sectionTitle, { marginTop: 24, marginBottom: 14 }]}>Why Triplets?</Text>
          <View style={cs.whyGrid}>
            {[
              { icon:'shield-checkmark', color:'#059669', label:'Deep Clean Guaranteed' },
              { icon:'leaf', color:'#0891B2', label:'Eco-Friendly Process' },
              { icon:'time', color:'#7C3AED', label:'On-Time Delivery' },
              { icon:'location', color:'#EA580C', label:'10+ Branches Near You' },
            ].map(w => (
              <View key={w.label} style={cs.whyCard}>
                <Ionicons name={w.icon} size={26} color={w.color} />
                <Text style={cs.whyLabel}>{w.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* ── FAB Book Now ── */}
      <TouchableOpacity style={cs.fab} onPress={() => navigation.navigate('Book')} activeOpacity={0.9}>
        <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        <Text style={cs.fabTxt}>Book Laundry</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
import { StyleSheet } from 'react-native';
const NAV = '#0F2044';
const cs = StyleSheet.create({
  root:   { flex:1, backgroundColor: NAV },
  scroll: { flex:1, backgroundColor: NAV },

  // Header
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:4, paddingBottom:16 },
  headerLeft:  { flexDirection:'row', alignItems:'center', gap:12 },
  logo:        { width:40, height:40, borderRadius:20 },
  headerGreet: { fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'600' },
  headerName:  { fontSize:16, fontWeight:'900', color:'#fff' },
  headerRight: { flexDirection:'row', gap:8 },
  iconBtn:     { width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },

  // Hero CTA
  heroCta: {
    marginHorizontal:16, marginBottom:20, borderRadius:24, overflow:'hidden',
    backgroundColor:'#1E40AF', padding:24,
    shadowColor:'#1E40AF', shadowOffset:{width:0,height:8}, shadowOpacity:0.4, shadowRadius:16, elevation:8,
  },
  heroCtaLeft: { zIndex:1 },
  heroCtaTag:  { fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:'700', marginBottom:8 },
  heroCtaTitle:{ fontSize:26, fontWeight:'900', color:'#fff', lineHeight:32, marginBottom:16 },
  heroCtaBtn:  { alignSelf:'flex-start', backgroundColor:'#fff', paddingHorizontal:20, paddingVertical:10, borderRadius:50 },
  heroCtaBtnTxt:{ fontSize:14, fontWeight:'800', color:'#1E40AF' },
  heroIcon:    { position:'absolute', right:-10, bottom:-10 },

  // Active Orders
  section:    { paddingHorizontal:16, marginBottom:4 },
  sectionRow: { flexDirection:'row', alignItems:'center', marginBottom:14, gap:8 },
  sectionTitle:{ fontSize:17, fontWeight:'800', color:colors.text, flex:1 },
  seeAll:     { fontSize:13, fontWeight:'700', color:colors.primary },
  activePulse:{ width:8, height:8, borderRadius:4, backgroundColor:'#EF4444' },

  activeCard: {
    backgroundColor:'#fff', borderRadius:18, padding:18, marginBottom:12,
    borderWidth:1, borderColor:'#E2E8F0',
    shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:3,
  },
  activeCardUrgent: { borderColor:'#FED7AA', borderWidth:2, backgroundColor:'#FFFBF7' },
  activeCardTop:    { flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 },
  statusDot:        { width:8, height:8, borderRadius:4 },
  activeStatus:     { fontSize:13, fontWeight:'700', flex:1 },
  trackBtn:         { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:NAV, paddingHorizontal:12, paddingVertical:6, borderRadius:50 },
  trackTxt:         { fontSize:12, fontWeight:'700', color:'#fff' },
  activeOrderId:    { fontSize:15, fontWeight:'800', color:colors.text, marginBottom:2 },
  activeBranch:     { fontSize:12, color:colors.textSecondary, marginBottom:10 },
  priceReadyBanner: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#FFF7ED', padding:12, borderRadius:12 },
  priceReadyTxt:    { fontSize:13, fontWeight:'700', color:'#EA580C', flex:1 },

  // Sheet
  sheet: { backgroundColor:'#F8FAFC', borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:20, paddingTop:28, paddingBottom:40 },

  // Guide Card
  guideCard:       { backgroundColor:'#fff', borderRadius:22, padding:20, marginBottom:28, borderWidth:1, borderColor:'#E2E8F0', shadowColor:NAV, shadowOffset:{width:0,height:4}, shadowOpacity:0.06, shadowRadius:12, elevation:3 },
  guideCardHeader: { flexDirection:'row', alignItems:'center', gap:12, marginBottom:18 },
  guideIconBox:    { width:40, height:40, borderRadius:12, backgroundColor:NAV, alignItems:'center', justifyContent:'center' },
  guideCardTitle:  { fontSize:15, fontWeight:'800', color:colors.text },
  guideCardSub:    { fontSize:12, color:colors.textSecondary, marginTop:1 },
  guideGrid:       { flexDirection:'row', gap:10, marginBottom:18 },
  guideChip:       { flex:1, borderRadius:14, paddingVertical:14, alignItems:'center', gap:4 },
  guideKg:         { fontSize:20, fontWeight:'900' },
  guideKgLabel:    { fontSize:10, fontWeight:'700', textTransform:'uppercase' },
  guideNotes:      { gap:10 },
  guideNoteRow:    { flexDirection:'row', alignItems:'flex-start', gap:10 },
  guideDot:        { width:8, height:8, borderRadius:4, marginTop:5 },
  guideNoteTxt:    { fontSize:13, color:'#475569', lineHeight:19, flex:1 },

  // Services
  svcRow:     { flexDirection:'row', alignItems:'flex-start', gap:14, backgroundColor:'#fff', borderRadius:18, padding:16, marginBottom:10, borderWidth:1, borderColor:'#E2E8F0' },
  svcIconBox: { width:50, height:50, borderRadius:14, alignItems:'center', justifyContent:'center' },
  svcInfo:    { flex:1 },
  svcTopRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 },
  svcName:    { fontSize:14, fontWeight:'800', color:colors.text, flex:1 },
  svcPrice:   { fontSize:15, fontWeight:'900' },
  svcCapacity:{ fontSize:12, color:'#64748B', fontWeight:'600', marginBottom:3 },
  svcDesc:    { fontSize:11, color:'#94A3B8', lineHeight:16 },
  showMoreBtn:{ backgroundColor:'#F1F5F9', borderRadius:14, paddingVertical:13, alignItems:'center', marginTop:6, marginBottom:4 },
  showMoreTxt:{ fontSize:13, fontWeight:'700', color:colors.primary },

  // Supplies
  suppliesGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:8 },
  supplyCard:   { width:(SW-60)/2, backgroundColor:'#fff', borderRadius:16, padding:14, borderWidth:1, borderColor:'#E2E8F0', gap:6 },
  supplyPrice:  { fontSize:18, fontWeight:'900', color:colors.text },
  supplyName:   { fontSize:11, color:'#64748B', fontWeight:'600', lineHeight:15 },

  // Hours Card
  hoursCard: { backgroundColor:NAV, borderRadius:22, padding:20, marginTop:24, gap:14 },
  hoursTop:  { flexDirection:'row', alignItems:'center', gap:12 },
  hoursIconBox:{ width:40, height:40, borderRadius:12, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  hoursTitle:{ fontSize:15, fontWeight:'800', color:'#fff' },
  hoursSub:  { fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1 },
  hoursBadge:{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:14, padding:14 },
  openDot:   { width:10, height:10, borderRadius:5, backgroundColor:'#4ADE80' },
  hoursTime: { fontSize:20, fontWeight:'900', color:'#fff', flex:1 },
  hoursDaily:{ fontSize:12, fontWeight:'700', color:'rgba(255,255,255,0.6)' },
  hoursNote: { fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:18 },

  // Why Choose Us
  whyGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:8 },
  whyCard: { width:(SW-60)/2, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E2E8F0', gap:10 },
  whyLabel:{ fontSize:12, fontWeight:'700', color:colors.text, lineHeight:17 },

  // FAB
  fab:    { position:'absolute', bottom:100, right:20, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:colors.primary, paddingHorizontal:20, paddingVertical:15, borderRadius:50, shadowColor:colors.primary, shadowOffset:{width:0,height:6}, shadowOpacity:0.4, shadowRadius:12, elevation:8 },
  fabTxt: { fontSize:15, fontWeight:'800', color:'#fff' },
});