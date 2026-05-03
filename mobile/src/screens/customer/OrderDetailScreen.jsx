import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { bookings as bookingsApi, branches as branchesApi, payments } from '../../services/api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

const { width: SW } = Dimensions.get('window');

const STEPS = [
  { key: 'pending', label: 'Booking Confirmed' },
  { key: 'washing', label: 'Laundry Washing' },
  { key: 'drying', label: 'Laundry Drying' },
  { key: 'ready', label: 'Ready for Pickup/Dispatch' },
  { key: 'delivering', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_BADGE = {
  pending:    { bg: '#EFF6FF', text: '#3B82F6', label: 'Booking Confirmed' },
  washing:    { bg: '#FFF7ED', text: '#F97316', label: 'Washing' },
  drying:     { bg: '#FFFBEB', text: '#F59E0B', label: 'Drying' },
  ready:      { bg: '#F0FDF4', text: '#22C55E', label: 'Ready' },
  delivering: { bg: '#FFF7ED', text: '#F97316', label: 'Out for Delivery' },
  delivered:  { bg: '#F0FDF4', text: '#10B981', label: 'Delivered' },
  cancelled:  { bg: '#FEF2F2', text: '#EF4444', label: 'Cancelled' },
};

const normalize = (s) => {
  const raw = String(s||'').trim().toLowerCase();
  const map = {
    received:'pending', pending:'pending', washing:'washing', drying:'drying',
    ready:'ready', pending_pickup:'pending', en_route_to_pickup:'pending',
    picked_up:'pending', in_transit:'pending', delivering:'delivering',
    delivered:'delivered', cancelled:'cancelled', failed:'cancelled',
  };
  return map[raw] || 'pending';
};

// Simple percentage ring using nested Views (no SVG dependency)
const Ring = ({ pct, status }) => {
  const sb = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return (
    <View style={ringStyles.wrap}>
      <View style={[ringStyles.outer, { borderColor: sb.text + '22' }]}>
        <View style={[ringStyles.inner, { borderColor: sb.text }]}>
          <Text style={[ringStyles.pct, { color: sb.text }]}>{pct}%</Text>
          <Text style={ringStyles.label}>done</Text>
        </View>
      </View>
    </View>
  );
};
const ringStyles = StyleSheet.create({
  wrap:  { alignItems: 'center', justifyContent: 'center' },
  outer: { width: 90, height: 90, borderRadius: 45, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pct:   { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 9, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
});

// Collapsible section
const Accordion = ({ title, icon, children, defaultOpen=false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.accordionHeader} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <View style={styles.accordionLeft}>
          <Ionicons name={icon} size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      {open && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
};

const Row = ({ label, value, valueStyle }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoKey}>{label}</Text>
    <Text style={[styles.infoVal, valueStyle]}>{value}</Text>
  </View>
);

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [branchPhones, setBP]   = useState({});
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:0.3, duration:800, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:1,   duration:800, useNativeDriver:true }),
    ]));
    p.start(); return () => p.stop();
  }, []);

  useEffect(() => { load(); }, [orderId]);

  useEffect(() => {
    (async () => {
      try {
        const all = await branchesApi.getAll();
        const m = (all?.branches||[]).reduce((a,b) => {
          const k = String(b?.name||'').trim().toLowerCase();
          if (k && b?.phone) a[k] = String(b.phone); return a;
        }, {});
        setBP(m);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!order?.id) return;
    const tn = order.trackingNumber || order.id;
    const unsub = onSnapshot(doc(db,'orders',String(tn)), snap => {
      if (snap.exists()) {
        const raw = (snap.data().status||'').toLowerCase();
        const mapped = normalize(raw);
        if (mapped && mapped !== order?.status)
          setOrder(prev => prev ? {...prev, status:mapped} : prev);
      }
    }, err => console.warn(err.message));
    return () => unsub();
  }, [order?.id, order?.trackingNumber]);

  const load = async () => {
    try { setLoading(true); const d = await bookingsApi.getById(orderId); setOrder(d); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const isPaymentCompleted = (value) => ['paid', 'verified', 'completed'].includes(String(value || '').toLowerCase());

  useEffect(() => {
    if (!order?.id || isPaymentCompleted(order?.paymentStatus)) return;
    const timer = setInterval(() => {
      bookingsApi.getById(order.id)
        .then((nextOrder) => {
          if (nextOrder) setOrder(nextOrder);
        })
        .catch(() => {});
    }, 12000);
    return () => clearInterval(timer);
  }, [order?.id, order?.paymentStatus]);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={colors.primary}/></View>
  );
  if (!order) return (
    <View style={styles.center}>
      <Text style={{color:colors.textSecondary}}>Order not found</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop:12}}>
        <Text style={{color:colors.primary, fontWeight:'600'}}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const ns  = normalize(order.status);
  const sb  = STATUS_BADGE[ns] || STATUS_BADGE.pending;
  const idx = STEPS.findIndex(s => s.key === ns);
  const pct = Math.max(5, Math.round(((idx>=0?idx+1:1)/STEPS.length)*100));

  const branchKey = String(order?.branchName||order?.branch||'').trim().toLowerCase();
  const branchPhone = branchPhones[branchKey] || '09170000000';
  const dial = v => String(v||'').replace(/[^0-9+]/g,'');

  const call = async phone => {
    const p = dial(phone);
    if (!p) return Alert.alert('No Contact','Phone not available.');
    const url = `tel:${p}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Error','Cannot open dialer.');
  };
  const sms = async phone => {
    const p = dial(phone);
    if (!p) return Alert.alert('No Contact','Phone not available.');
    const url = `sms:${p}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Error','Cannot open messaging.');
  };

  const driverVisible = ns === 'delivering';

  // 3-point condensed timeline
  const prevStep = idx > 0 ? STEPS[idx-1] : null;
  const currStep = STEPS[idx>=0?idx:0];
  const nextStep = idx < STEPS.length-1 ? STEPS[idx+1] : null;

  const payNow = async () => {
    try {
      const rawUrl = await payments.initiateGcashCheckout(order.trackingNumber||order.id);
      const url = String(rawUrl||'').trim();
      if (!url || !/^https?:\/\//i.test(url)) throw new Error('No checkout URL');
      try { await WebBrowser.openBrowserAsync(url); }
      catch { if (await Linking.canOpenURL(url)) await Linking.openURL(url); }
    } catch(e) { Alert.alert('Error','Could not initiate payment.'); }
  };

  const cancelOrder = () => {
    Alert.alert('Cancel Order','Are you sure you want to cancel this booking?',[
      {text:'No', style:'cancel'},
      {text:'Yes, Cancel', style:'destructive', onPress: async () => {
        try { await bookingsApi.cancel(order.id); Alert.alert('Cancelled','Your booking has been cancelled.'); navigation.goBack(); }
        catch(e) { Alert.alert('Error', e.message||'Failed to cancel.'); }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text}/>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Order Details</Text>
        {order.trackingNumber
          ? <View style={styles.liveTag}>
              <Animated.View style={[styles.liveDot,{opacity:pulseAnim}]}/>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          : <View style={{width:48}}/>
        }
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* HERO STATUS CARD */}
        <View style={styles.heroCard}>
          <Ring pct={pct} status={ns}/>
          <View style={styles.heroRight}>
            <Text style={styles.heroOrderId}>#{order.id}</Text>
            <View style={[styles.badge,{backgroundColor:sb.bg}]}>
              <Text style={[styles.badgeText,{color:sb.text}]}>{sb.label}</Text>
            </View>
            <Text style={styles.heroDate}>{order.date}</Text>
            <Text style={styles.heroAmount}>₱{(order.amount||0).toFixed(2)}</Text>
          </View>
        </View>

        {/* 3-POINT CONDENSED TIMELINE */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Progress</Text>
          </View>

          <View style={styles.threePoint}>
            {prevStep && (
              <View style={styles.tpRow}>
                <View style={[styles.tpDot,{backgroundColor:colors.success}]}/>
                <View>
                  <Text style={styles.tpLabel}>Completed</Text>
                  <Text style={styles.tpStep}>{prevStep.label}</Text>
                </View>
              </View>
            )}
            <View style={[styles.tpRow,styles.tpActive]}>
              <View style={[styles.tpDot,{backgroundColor:sb.text,width:14,height:14,borderRadius:7}]}/>
              <View>
                <Text style={[styles.tpLabel,{color:sb.text}]}>Current Step</Text>
                <Text style={[styles.tpStep,{fontWeight:'800',color:colors.text}]}>{currStep.label}</Text>
              </View>
            </View>
            {nextStep && (
              <View style={styles.tpRow}>
                <View style={[styles.tpDot,{backgroundColor:colors.border}]}/>
                <View>
                  <Text style={styles.tpLabel}>Up Next</Text>
                  <Text style={[styles.tpStep,{color:colors.textTertiary}]}>{nextStep.label}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* DRIVER CARD — only when delivering */}
        {driverVisible && order.delivery && (
          <View style={styles.driverCard}>
            <View style={styles.driverTop}>
              <View style={styles.driverAvatar}>
                {order.delivery.driverPhotoUrl
                  ? <Image source={{uri:order.delivery.driverPhotoUrl}} style={styles.driverAvatarImg}/>
                  : <Ionicons name="person" size={28} color={colors.primary}/>
                }
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{order.delivery.driver||'Driver'}</Text>
                <Text style={styles.driverSub}>{order.delivery.driverVehicle||'Vehicle N/A'}</Text>
              </View>
              <View style={styles.driverContact}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => call(order.delivery.driverPhone)}>
                  <Ionicons name="call-outline" size={18} color={colors.primary}/>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => sms(order.delivery.driverPhone)}>
                  <Ionicons name="chatbubble-outline" size={18} color={colors.primary}/>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.trackBtn}
              onPress={() => navigation.navigate('Tracking',{orderId:order.id})}>
              <Ionicons name="navigate" size={16} color="#FFF"/>
              <Text style={styles.trackBtnText}>Track Live Location</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LAUNDRY DETAILS ACCORDION */}
        <Accordion title="Laundry Details" icon="shirt-outline">
          <Row label="Branch"      value={order.branchName||order.branch}/>
          <Row label="Laundry Services Details" value={order.serviceType||order.service}/>
          <Row label="Load"        value={`${order.loadKg} kg`}/>
          <Row label="Detergent"   value={order.detergent||'None'}/>
          <Row label="Conditioner" value={order.conditioner||'None'}/>
          {order.instructions&&<Row label="Instructions" value={order.instructions}/>}
          {order.scheduleDate&&<Row label="Pickup" value={`${order.scheduleDate}  ${order.scheduleTime||''}`}/>}
        </Accordion>

        {/* PAYMENT ACCORDION */}
        <Accordion title="Payment Summary" icon="receipt-outline">
          <Row label="Service Fee"
               value={order.servicePrice > 0 ? `₱${order.servicePrice.toFixed(2)}` : '—'}/>
          <Row label="Supplies"
               value={order.suppliesPrice > 0 ? `₱${order.suppliesPrice.toFixed(2)}` : '—'}/>
          {(order.rushPrice > 0) && (
            <Row label="Rush Service" value={`₱${order.rushPrice.toFixed(2)}`}/>
          )}
          {(order.deliveryPrice > 0 || order.delivery) && (
            <Row label="Delivery Fee"
                 value={order.deliveryPrice > 0 ? `₱${order.deliveryPrice.toFixed(2)}` : 'Location-based'}/>
          )}
          <View style={styles.divider}/>
          <Row label="Total" value={`₱${(order.amount||0).toFixed(2)}`} valueStyle={{fontWeight:'800',color:colors.primary,fontSize:16}}/>
          <Row label="Method" value={order.paymentMethod}/>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Status</Text>
            <View style={{
              backgroundColor:isPaymentCompleted(order.paymentStatus)?'#F0FDF4':'#FFFBEB',
              paddingHorizontal:10, paddingVertical:3, borderRadius:100
            }}>
              <Text style={{fontSize:12,fontWeight:'700',
                color:isPaymentCompleted(order.paymentStatus)?colors.success:colors.warning}}>
                {order.paymentStatus||'Pending'}
              </Text>
            </View>
          </View>
          {order.paymentMethod?.toLowerCase()==='gcash' && !isPaymentCompleted(order.paymentStatus) && !['delivered', 'cancelled'].includes(ns) && (
            <TouchableOpacity style={[styles.trackBtn,{marginTop:12}]} onPress={payNow}>
              <Ionicons name="card-outline" size={16} color="#FFF"/>
              <Text style={styles.trackBtnText}>Pay Now with GCash</Text>
            </TouchableOpacity>
          )}
        </Accordion>

        {/* DELIVERY ADDRESS (if applicable) */}
        {order.delivery&&(
          <Accordion title="Delivery Information" icon="location-outline">
            <Row label="Address" value={order.delivery.address}/>
            <Row label="ETA" value={order.delivery.eta ? new Date(order.delivery.eta).toLocaleString() : 'Calculating'}/>
          </Accordion>
        )}

        {/* CONFIRMATION CODE */}
        {ns==='delivering'&&order.confirmationCode&&(
          <View style={styles.codeCard}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary}/>
            <Text style={styles.codeTitle}>Show this PIN to your rider</Text>
            <View style={styles.pinRow}>
              {String(order.confirmationCode).split('').map((d,i)=>(
                <View key={i} style={styles.pinBox}><Text style={styles.pinDigit}>{d}</Text></View>
              ))}
            </View>
          </View>
        )}

        <View style={{height:100}}/>
      </ScrollView>

      {/* STICKY FOOTER */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.footerOutline} onPress={() => call(branchPhone)}>
            <Ionicons name="call-outline" size={18} color={colors.primary}/>
            <Text style={styles.footerOutlineText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerOutline} onPress={() => sms(branchPhone)}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.primary}/>
            <Text style={styles.footerOutlineText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerPrimary}
            onPress={() => navigation.navigate('Tracking', { orderId: order.id })}>
            <Ionicons name="location-outline" size={18} color="#FFF"/>
            <Text style={styles.footerPrimaryText}>Track Order</Text>
          </TouchableOpacity>
        </View>
        {ns==='pending'&&(
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelOrder}>
            <Text style={styles.cancelText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex:1, backgroundColor:colors.background },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  scroll: { paddingHorizontal:16, paddingTop:8 },

  navBar:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12, backgroundColor:colors.background },
  navBack:  { width:40, height:40, justifyContent:'center' },
  navTitle: { fontSize:17, fontWeight:'700', color:colors.text },

  liveTag:  { flexDirection:'row', alignItems:'center', backgroundColor:'#F0FDF4', paddingHorizontal:10, paddingVertical:4, borderRadius:100, gap:5 },
  liveDot:  { width:6, height:6, borderRadius:3, backgroundColor:'#22C55E' },
  liveText: { fontSize:10, fontWeight:'800', color:'#22C55E', letterSpacing:0.8 },

  // HERO
  heroCard: { flexDirection:'row', alignItems:'center', gap:20, backgroundColor:'#FFF', borderRadius:20, padding:20, marginBottom:12, borderWidth:1, borderColor:colors.border, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  heroRight:{ flex:1, gap:6 },
  heroOrderId: { fontSize:12, color:colors.textTertiary, fontWeight:'600', letterSpacing:0.4 },
  heroDate:    { fontSize:12, color:colors.textSecondary },
  heroAmount:  { fontSize:22, fontWeight:'900', color:colors.text },
  badge:       { alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:4, borderRadius:100 },
  badgeText:   { fontSize:12, fontWeight:'700' },

  // CARDS
  card:     { backgroundColor:'#FFF', borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:colors.border },
  cardHeaderRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  cardTitle: { fontSize:14, fontWeight:'700', color:colors.text },
  viewAll:   { fontSize:12, fontWeight:'600', color:colors.accent },
  accordionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  accordionLeft:   { flexDirection:'row', alignItems:'center', gap:8 },
  accordionBody:   { marginTop:14 },

  // 3-POINT TIMELINE
  threePoint: { gap:14 },
  tpRow:   { flexDirection:'row', alignItems:'flex-start', gap:12 },
  tpActive:{ backgroundColor:colors.primaryLight, borderRadius:12, padding:10, marginHorizontal:-6 },
  tpDot:   { width:10, height:10, borderRadius:5, marginTop:4 },
  tpLabel: { fontSize:10, fontWeight:'600', color:colors.textSecondary, letterSpacing:0.4, textTransform:'uppercase' },
  tpStep:  { fontSize:14, fontWeight:'700', color:colors.text, marginTop:2 },

  // FULL TIMELINE
  tlRow:     { flexDirection:'row', height:48 },
  tlIconCol: { alignItems:'center', width:20, marginRight:14 },
  tlDot:     { width:12, height:12, borderRadius:6 },
  tlDotOn:   { backgroundColor:colors.primary },
  tlDotOff:  { backgroundColor:colors.border },
  tlLine:    { width:2, flex:1, marginTop:-2, marginBottom:-10 },
  tlLineOn:  { backgroundColor:colors.primary },
  tlLineOff: { backgroundColor:colors.border },
  tlContent: { flex:1, paddingBottom:14 },
  tlStep:    { fontSize:14, fontWeight:'600' },
  tlTime:    { fontSize:11, color:colors.textTertiary, marginTop:2 },

  // DRIVER CARD
  driverCard:    { backgroundColor:'#FFF', borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:colors.border },
  driverTop:     { flexDirection:'row', alignItems:'center', marginBottom:14 },
  driverAvatar:  { width:52, height:52, borderRadius:26, backgroundColor:colors.primaryLight, alignItems:'center', justifyContent:'center', marginRight:12 },
  driverAvatarImg:{ width:52, height:52, borderRadius:26 },
  driverInfo:    { flex:1 },
  driverName:    { fontSize:16, fontWeight:'800', color:colors.text },
  driverSub:     { fontSize:13, color:colors.textSecondary, marginTop:2 },
  driverContact: { flexDirection:'row', gap:8 },
  contactBtn:    { width:40, height:40, borderRadius:20, backgroundColor:colors.primaryLight, alignItems:'center', justifyContent:'center' },

  trackBtn:      { height:48, backgroundColor:colors.primary, borderRadius:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  trackBtnText:  { color:'#FFF', fontSize:15, fontWeight:'700' },

  // INFO ROWS
  infoRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:10, alignItems:'center' },
  infoKey: { fontSize:13, color:colors.textSecondary },
  infoVal: { fontSize:13, fontWeight:'600', color:colors.text, maxWidth:'60%', textAlign:'right' },
  divider: { height:1, backgroundColor:colors.border, marginVertical:10 },

  // CODE CARD
  codeCard:  { backgroundColor:colors.primaryLight, borderRadius:16, padding:20, marginBottom:12, alignItems:'center', gap:10, borderWidth:1, borderColor:colors.border },
  codeTitle: { fontSize:13, fontWeight:'700', color:colors.primary },
  pinRow:    { flexDirection:'row', gap:10 },
  pinBox:    { width:48, height:60, borderRadius:12, backgroundColor:'#FFF', borderWidth:2, borderColor:colors.primary, alignItems:'center', justifyContent:'center' },
  pinDigit:  { fontSize:28, fontWeight:'900', color:colors.primary },

  // STICKY FOOTER
  stickyFooter:  { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#FFF', paddingHorizontal:16, paddingTop:12, paddingBottom:28, borderTopWidth:1, borderTopColor:colors.border, shadowColor:'#000', shadowOffset:{width:0,height:-4}, shadowOpacity:0.06, shadowRadius:8, elevation:8 },
  footerRow:     { flexDirection:'row', gap:10, marginBottom:8 },
  footerOutline: { flex:0, width:72, height:48, borderWidth:1.5, borderColor:colors.border, borderRadius:14, alignItems:'center', justifyContent:'center', gap:2 },
  footerOutlineText: { fontSize:11, fontWeight:'600', color:colors.primary },
  footerPrimary: { flex:1, height:48, backgroundColor:colors.primary, borderRadius:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  footerPrimaryText: { fontSize:15, fontWeight:'700', color:'#FFF' },
  cancelBtn:  { alignItems:'center', paddingVertical:8 },
  cancelText: { fontSize:13, fontWeight:'700', color:colors.error },
});
