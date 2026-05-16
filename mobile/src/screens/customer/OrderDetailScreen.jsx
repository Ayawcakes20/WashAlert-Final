import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { bookings as bookingsApi, branches as branchesApi, payments } from '../../services/api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import PriceConfirmationModal from '../../components/PriceConfirmationModal';

const { width: SW } = Dimensions.get('window');

const STEPS = [
  { key: 'pending',        label: 'Booking Placed',                  icon: 'checkmark-circle-outline' },
  { key: 'received',       label: 'Order Received',                  icon: 'cube-outline' },
  { key: 'awaiting_price', label: 'Weighing & Price Confirmation',   icon: 'scale-outline' },
  { key: 'washing',        label: 'Washing in Progress',             icon: 'water-outline' },
  { key: 'ready',          label: 'Ready for Pickup / Delivery',     icon: 'bag-check-outline' },
  { key: 'delivered',      label: 'Delivered Successfully',           icon: 'checkmark-done-circle-outline' },
];

const STATUS_BADGE = {
  pending:        { bg: '#EFF6FF', text: '#3B82F6', label: 'Order Pending' },
  received:       { bg: '#F0FDF4', text: '#10B981', label: 'Received' },
  awaiting_price: { bg: '#FFF7ED', text: '#EA580C', label: 'Awaiting Confirmation' },
  washing:        { bg: '#EFF6FF', text: '#2563EB', label: 'Washing' },
  drying:         { bg: '#F5F3FF', text: '#7C3AED', label: 'Drying' },
  ready:          { bg: '#F0FDF4', text: '#22C55E', label: 'Ready' },
  delivering:     { bg: '#F0FDF4', text: '#22C55E', label: 'Out for Delivery' },
  delivered:      { bg: '#F0FDF4', text: '#10B981', label: 'Delivered' },
  cancelled:      { bg: '#FEF2F2', text: '#EF4444', label: 'Cancelled' },
};

const normalize = (s) => {
  const raw = String(s||'').trim().toLowerCase().replace(/ /g,'_');
  const map = {
    received:'received', pending:'pending',
    awaiting_price:'awaiting_price', awaiting_price_confirmation:'awaiting_price',
    price_approved:'washing',
    washing:'washing', drying:'drying', ready:'ready',
    pending_pickup:'ready', en_route_to_pickup:'delivering',
    picked_up:'delivering', in_transit:'delivering', delivering:'delivering',
    delivered:'delivered', cancelled:'cancelled', failed:'cancelled',
  };
  return map[raw] || 'pending';
};

// Active step pulse ring
const PulseRing = ({ color }) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[
      { position:'absolute', width:28, height:28, borderRadius:14, borderWidth:2, borderColor:color, opacity:0.4 },
      { transform:[{ scale:anim }] }
    ]} />
  );
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
  const [showFullTL, setShowTL] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
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
    if (!tn || String(tn).toLowerCase() === 'undefined') return;
    if (!db) return;
    try {
      const unsub = onSnapshot(doc(db, 'orders', String(tn)), snap => {
        if (snap.exists()) {
          const raw = (snap.data().status || '').toLowerCase();
          const mapped = normalize(raw);
          if (mapped && mapped !== order?.status)
            setOrder(prev => prev ? { ...prev, status: mapped } : prev);
        }
      }, err => console.warn('[OrderDetail] Firestore listener failed:', err?.message || err));
      return () => unsub();
    } catch (error) {
      console.warn('[OrderDetail] Firestore subscription skipped:', error?.message || error);
      return undefined;
    }
  }, [order?.id, order?.trackingNumber]);

  const load = async () => {
    try { setLoading(true); const d = await bookingsApi.getById(orderId); setOrder(d); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

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

  const timeline = (order.timeline && order.timeline.length
    ? order.timeline
    : STEPS.map((s,i) => ({step:s.label, time: i===0?order.date:'', done:i<=idx})));

  const payNow = async () => {
    try {
      const { checkoutUrl } = await payments.initiateGcashCheckout(order);
      const url = String(checkoutUrl || '').trim();
      if (!url || !/^https?:\/\//i.test(url)) throw new Error('No checkout URL');
      try { await WebBrowser.openBrowserAsync(url); }
      catch { if (await Linking.canOpenURL(url)) await Linking.openURL(url); }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not initiate payment.');
    }
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
        
        {/* PRICE CONFIRMATION ACTION CARD */}
        {ns === 'awaiting_price' && (
          <TouchableOpacity 
            style={styles.confirmCard} 
            activeOpacity={0.9}
            onPress={() => setShowReceiptModal(true)}
          >
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIconWrap}>
                <Ionicons name="receipt" size={24} color="#EA580C" />
              </View>
              <View style={{flex:1}}>
                <Text style={styles.confirmTitle}>Your Receipt is Ready</Text>
                <Text style={styles.confirmSub}>Staff has finalized your order amount.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#EA580C" />
            </View>
            
            <View style={styles.receiptTeaser}>
              <Text style={styles.teaserLabel}>Total Amount Due</Text>
              <Text style={styles.teaserAmount}>₱{(order.amount||0).toLocaleString()}</Text>
              <View style={styles.teaserAction}>
                <Text style={styles.teaserActionTxt}>Tap to view your receipt</Text>
                <Ionicons name="arrow-forward-circle" size={14} color="#EA580C" />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {ns === 'received' && (
          <View style={[styles.confirmCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderStyle: 'solid' }]}>
            <View style={styles.confirmHeader}>
              <View style={[styles.confirmIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="scale" size={24} color="#3B82F6" />
              </View>
              <View style={{flex:1}}>
                <Text style={[styles.confirmTitle, { color: '#1E293B' }]}>Order Received</Text>
                <Text style={[styles.confirmSub, { color: '#64748B' }]}>Our staff is currently weighing your laundry. You&apos;ll get a notification once the receipt is ready.</Text>
              </View>
            </View>
          </View>
        )}

        <PriceConfirmationModal
          visible={showReceiptModal}
          orderData={order}
          onConfirmed={() => {
            setShowReceiptModal(false);
            Alert.alert('✅ Confirmed!', 'Price confirmed! We are now washing your laundry.');
            load();
          }}
          onDismiss={() => setShowReceiptModal(false)}
          onRejected={() => {
            setShowReceiptModal(false);
            load();
          }}
        />

        {/* HERO STATUS CARD */}
        <View style={styles.heroCard}>
          <Ring pct={pct} status={ns}/>
          <View style={styles.heroRight}>
            <Text style={styles.heroOrderId}>{order.trackingNumber || `#${order.id}`}</Text>
            <View style={[styles.badge,{backgroundColor:sb.bg}]}>
              <Text style={[styles.badgeText,{color:sb.text}]}>{sb.label}</Text>
            </View>
            <Text style={styles.heroDate}>{order.date}</Text>
            {/* Hide price when awaiting_price — it's already shown in the orange card above */}
            {ns !== 'awaiting_price' && (
              <Text style={styles.heroAmount}>₱{(order.amount||0).toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* VERTICAL ORDER STEPPER */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Progress</Text>
          <View style={{marginTop:14}}>
            {STEPS.map((step, i) => {
              const stepIdx  = STEPS.findIndex(s => s.key === ns);
              const isDone   = i < stepIdx;
              const isActive = i === stepIdx;
              const isPend   = i > stepIdx;
              const sb2      = STATUS_BADGE[step.key] || STATUS_BADGE.pending;
              const isLast   = i === STEPS.length - 1;
              return (
                <View key={step.key} style={{flexDirection:'row',alignItems:'flex-start'}}>
                  {/* Icon column */}
                  <View style={{width:36, alignItems:'center'}}>
                    <View style={{alignItems:'center',justifyContent:'center',position:'relative',width:28,height:28}}>
                      {isActive && <PulseRing color={sb2.text} />}
                      <View style={[
                        {width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center'},
                        isDone  && {backgroundColor:'#2563EB'},
                        isActive&& {backgroundColor:sb2.text},
                        isPend  && {borderWidth:2,borderColor:'#D1D5DB',backgroundColor:'#fff'},
                      ]}>
                        {isDone
                          ? <Ionicons name="checkmark" size={12} color="#fff"/>
                          : <Ionicons name={step.icon} size={11} color={isActive?'#fff':'#9CA3AF'}/>
                        }
                      </View>
                    </View>
                    {!isLast && (
                      <View style={{width:2,flex:1,minHeight:24,marginTop:2,
                        backgroundColor:isDone?'#2563EB':'#E5E7EB'}}/>
                    )}
                  </View>
                  {/* Label column */}
                  <View style={{flex:1,paddingBottom:isLast?0:16,paddingLeft:10,paddingTop:3}}>
                    <Text style={[
                      {fontSize:14,fontWeight:'600'},
                      isDone  && {color:'#374151'},
                      isActive&& {color:sb2.text,fontWeight:'800'},
                      isPend  && {color:'#9CA3AF'},
                    ]}>
                      {step.label}
                    </Text>
                    {isActive && (
                      <Text style={{fontSize:11,color:sb2.text,marginTop:2,fontWeight:'600'}}>
                        In progress...
                      </Text>
                    )}
                    {isActive && step.key === 'awaiting_price' && (
                      <Text style={{fontSize:11,color:'#92400E',marginTop:4,lineHeight:15}}>
                        Check your notifications to confirm the price.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
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

        {/* LAUNDRY SERVICES ACCORDION */}
        <Accordion title="Laundry Services" icon="shirt-outline" defaultOpen={true}>
          <Row label="Package"     value={order.serviceName || order.serviceType || order.service}/>
          <Row label="Actual Weight" value={order.actualWeightKg ? `${order.actualWeightKg} kg` : (order.loadKg ? `~${order.loadKg} kg (Est.)` : 'TBD')}/>
          <Row label="Detergent"   value={order.detergent||'None'}/>
          <Row label="Conditioner" value={order.conditioner||'None'}/>
          {order.instructions&&<Row label="Instructions" value={order.instructions}/>}
        </Accordion>

        {/* LOGISTICS ACCORDION */}
        <Accordion title="Logistics" icon="bus-outline">
          <Row label="Branch" value={order.branchName||order.branch}/>
          {order.scheduleDate&&<Row label="Pickup Schedule" value={`${order.scheduleDate}  ${order.scheduleTime||''}`}/>}
        </Accordion>

        {/* PAYMENT ACCORDION */}
        <Accordion title="Payment Summary" icon="receipt-outline">
          {order.actualWeightKg && (
            <Row label="Actual Weight" value={`${order.actualWeightKg} kg`} valueStyle={{fontWeight:'700', color:colors.primary}}/>
          )}
          {order.servicePrice > 0 && (
            <Row label="Service Fee" value={`₱${order.servicePrice.toFixed(2)}`}/>
          )}
          
          {/* Itemized Supplies Breakdown */}
          {order.detergent && order.detergent !== 'None' && (
            <Row 
              label={`Detergent: ${order.detergent}`} 
              value={`x${order.detergentQty || 1}  (₱${((order.detergent.toLowerCase().includes('premium') || order.detergent.toLowerCase().includes('ariel') ? 30 : 25) * (order.detergentQty || 1)).toFixed(2)})`} 
              valueStyle={{fontWeight:'600'}}
            />
          )}
          {order.conditioner && order.conditioner !== 'None' && (
            <Row 
              label={`Fabcon: ${order.conditioner}`} 
              value={`x${order.conditionerQty || 1}  (₱${((order.conditioner.toLowerCase().includes('premium') || order.conditioner.toLowerCase().includes('downy') ? 25 : 15) * (order.conditionerQty || 1)).toFixed(2)})`} 
              valueStyle={{fontWeight:'600'}}
            />
          )}
          {order.suppliesPrice > 0 && (
            <Row label="Supplies Total" value={`₱${order.suppliesPrice.toFixed(2)}`}/>
          )}

          {order.deliveryPrice > 0 && (
            <Row label="Delivery Fee" value={`₱${order.deliveryPrice.toFixed(2)}`}/>
          )}
          {order.rushPrice > 0 && (
            <Row label="Rush Service" value={`₱${order.rushPrice.toFixed(2)}`}/>
          )}
          <View style={styles.divider}/>
          <Row 
            label="Total Due" 
            value={`₱${(order.totalPrice || order.amount || 0).toFixed(2)}`} 
            valueStyle={{fontWeight:'900', color:colors.primary, fontSize:18}}
          />
          <Row label="Payment" value={order.paymentMethod || '—'}/>

          {/* ADDED: Pay Now button for GCash */}
          {String(order.paymentMethod || '').toLowerCase() === 'gcash' && 
           String(order.paymentStatus || '').toLowerCase() !== 'paid' && 
           ['price_approved', 'washing', 'ready_for_delivery', 'delivering'].includes(ns) && (
            <TouchableOpacity 
              style={styles.payNowBtn} 
              onPress={payNow}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="cellphone-wireless" size={18} color="#fff" />
              <Text style={styles.payNowTxt}>Pay via GCash Now</Text>
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

  // Price Confirmation Card
  confirmCard:{backgroundColor:'#FFF7ED',borderRadius:24,padding:20,marginBottom:16,borderWidth:1.5,borderColor:'#FFEDD5',gap:16,shadowColor:'#EA580C',shadowOffset:{width:0,height:6},shadowOpacity:0.15,shadowRadius:12,elevation:6},
  confirmHeader:{flexDirection:'row',alignItems:'center',gap:12},
  confirmIconWrap:{width:48,height:48,borderRadius:16,backgroundColor:'#FFEDD5',alignItems:'center',justifyContent:'center'},
  confirmTitle:{fontSize:17,fontWeight:'900',color:'#9A3412',letterSpacing:-0.3},
  confirmSub:{fontSize:12,color:'#C2410C',marginTop:1,fontWeight:'600'},
  receiptTeaser:{backgroundColor:'#fff',borderRadius:16,padding:16,alignItems:'center',borderWidth:1,borderColor:'#FFEDD5',borderStyle:'dashed'},
  teaserLabel:{fontSize:10,fontWeight:'800',color:'#C2410C',textTransform:'uppercase',letterSpacing:1},
  teaserAmount:{fontSize:28,fontWeight:'900',color:'#EA580C',marginVertical:4},
  teaserAction:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},
  teaserActionTxt:{fontSize:11,fontWeight:'700',color:'#9A3412'},

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

  // Pay Now Button
  payNowBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  payNowTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
