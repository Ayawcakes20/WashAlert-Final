import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors } from '../../theme/colors';
import { branches, bookings, laundry, createOrder, payments } from '../../services/api';
import { getDefaultSavedAddress } from '../../services/savedAddresses';
import AddressPickerSheet from '../../components/AddressPickerSheet';

const { width } = Dimensions.get('window');

const SERVICE_MODES = [
  { id: 'FULL_SERVICE',  label: 'Full Service',  hint: 'Pickup -> Laundry -> Delivery', icon: 'washing-machine',  backendServiceType: 'PICKUP_DELIVERY', needsAddress: true  },
  { id: 'DROP_OFF_ONLY', label: 'Drop-off Only', hint: 'You bring & pick up at branch', icon: 'store-outline',    backendServiceType: 'DROP_OFF',        needsAddress: false },
  { id: 'PICKUP_ONLY',   label: 'Pickup Only',   hint: 'We pick up - you get at branch',icon: 'truck-outline',   backendServiceType: 'PICKUP_DELIVERY', needsAddress: true  },
];
const DET_OPTS = [
  { id: 'none',  label: 'None',                       price: 0  },
  { id: 'surf',  label: 'Surf (Basic Det.)',            price: 25 },
  { id: 'ariel', label: 'Ariel (Premium Det.)',         price: 30 },
];
const FAB_OPTS = [
  { id: 'none',  label: 'None',                        price: 0  },
  { id: 'charm', label: 'Charm Fabcon (Basic)',         price: 15 },
  { id: 'downy', label: 'Downy (Premium)',              price: 25 },
];
const VIS_STEPS = ['Branch','Service','Supplies','Schedule','Confirm'];
const VIS_MAP   = { 1:1, 2:1, 3:2, 4:3, 5:4, 6:5 };

// ── Accurate Pricing Engine ──────────────────────────────────────────────────
// Wash (7kg)=₱80 · Dry (7kg)=₱90 · Ecowash Full (5kg)=₱220
// Basic Full 7kg=₱240 · Basic Full 8kg=₱245
// Premium Full 7kg=₱270 · Premium Full 8kg=₱275
// Handwash ≤3kg → ₱150/kg ; >3kg → ₱90/kg
// Madness extra 1kg on top of 8kg → +₱50

const getServiceBasePrice = (svc, weightKg) => {
  const configuredPrice = Number(svc?.price || 0);
  if (Number.isFinite(configuredPrice) && configuredPrice > 0) {
    return configuredPrice;
  }

  const name = String(svc?.name || '').toLowerCase();
  if (name.includes('double basic full')) return 295;
  if (name.includes('double full')) return 325;
  if (name.includes('handwash')) {
    return weightKg <= 3 ? weightKg * 150 : weightKg * 90;
  }
  if (name.includes('dry'))          return 90;
  if (name.includes('ecowash'))      return 220;
  if (name.includes('basic full')) {
    return weightKg >= 8 ? 245 : 240;
  }
  if (name.includes('premium full')) {
    return weightKg >= 8 ? 275 : 270;
  }
  return svc?.price || 80;
};

const getMadnessSurcharge = (weightKg) => {
  if (weightKg > 8) return (weightKg - 8) * 50;
  return 0;
};

const getServicePriceLabel = (svc) => {
  const name = String(svc?.name || '').toLowerCase();
  if (name.includes('handwash'))     return '₱150/kg (≤3kg) · ₱90/kg (>3kg)';
  if (name.includes('dry'))         return '₱90 / 7kg';
  if (name.includes('ecowash'))     return '₱220 / 5kg';
  if (name.includes('basic full'))  return '₱240 (7kg) - ₱245 (8kg)';
  if (name.includes('premium full'))return '₱270 (7kg) - ₱275 (8kg)';
  return `₱${svc?.price ?? 0}`;
};

const fmtSlot = (label) => label;

const getSvcIcon = s => {
  const n = String(s?.name||'').toLowerCase();
  if(n.includes('handwash')) return 'hand-wash';
  if(n.includes('dry'))      return 'tumble-dryer';
  if(n.includes('premium'))  return 'star-four-points-outline';
  if(n.includes('eco'))      return 'leaf';
  return 'washing-machine';
};

const extractBookingErrorMessage = (error) => {
  const fromBody = error?.body?.message || error?.body?.detail || error?.body?.error || null;
  const fromError = typeof error?.message === 'string' ? error.message.trim() : '';
  const message = fromBody || fromError;
  if (!message || /^request failed\s*\(/i.test(message)) {
    return 'Failed to place booking. Please try again.';
  }
  return message;
};

const distKm = (a,b,c,d) => {
  const R=6371,dL=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;
  const x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dl/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
};

const mkDates = (n=7) => {
  const t=new Date(); t.setHours(0,0,0,0);
  return Array.from({length:n},(_,i)=>{ const d=new Date(t); d.setDate(t.getDate()+i); return d; });
};

export default function BookingScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSub]      = useState(false);
  const [branches_, setBranches]  = useState([]);
  const [services_, setServices]  = useState([]);
  const [branch, setBranch]       = useState(null);
  const [svcMode, setSvcMode]     = useState('FULL_SERVICE');
  const [address, setAddress]     = useState(null);
  const [addrSheet, setAddrSheet] = useState(false);
  const [defAddr, setDefAddr]     = useState(null);
  const [service, setService]     = useState(null);
  const [det, setDet]             = useState('none');
  const [detQty, setDetQty]       = useState(1);
  const [fab, setFab]             = useState('none');
  const [fabQty, setFabQty]       = useState(1);
  const [schDate, setSchDate]     = useState(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; });
  const [schTime, setSchTime]     = useState(null);
  const [slots, setSlots]         = useState([]);
  const [slotsLoad, setSlotsLoad] = useState(false);
  const [rush, setRush]           = useState(false);
  const [notes, setNotes]         = useState('');
  const [payMethod, setPay]       = useState('gcash');
  const [loadSize, setLoadSize]   = useState('SMALL'); // SMALL or LARGE
  const dates                     = useMemo(() => mkDates(14), []);
  const mode                      = SERVICE_MODES.find(m=>m.id===svcMode)||SERVICE_MODES[0];
  const needsAddr                 = mode.needsAddress;

  const deliveryFee = useMemo(()=>{
    if(!needsAddr) return 0;
    if(!address?.latitude||!branch?.latitude) return 50;
    const d=distKm(branch.latitude,branch.longitude,address.latitude,address.longitude);
    return Math.min(100,Math.max(40,Math.round(40+d*12)));
  },[needsAddr,address,branch]);

  const detOpt  = DET_OPTS.find(o=>o.id===det);
  const fabOpt  = FAB_OPTS.find(o=>o.id===fab);
  const detCost = det !== 'none' ? (detOpt?.price || 0) * detQty : 0;
  const fabCost = fab !== 'none' ? (fabOpt?.price || 0) * fabQty : 0;

  const total = useMemo(()=>{
    if(!service) return 0;
    const estKg  = loadSize === 'LARGE' ? 8 : 5; 
    const base    = getServiceBasePrice(service, estKg);
    const madness = getMadnessSurcharge(estKg);
    return base + madness + detCost + fabCost + (rush ? 150 : 0) + deliveryFee;
  },[service,loadSize,detCost,fabCost,rush,deliveryFee]);

  const hint = useMemo(()=>{
    if(!service) return '';
    const p=[service.name];
    if(det!=='none') p.push(`${detOpt?.label} x${detQty}`);
    if(fab!=='none') p.push(`${fabOpt?.label} x${fabQty}`);
    if(rush) p.push('Rush +₱150');
    return p.filter(Boolean).join(' · ');
  },[service,det,detQty,fab,fabQty,rush]);

  useEffect(()=>{ load(); },[]);
  useFocusEffect(useCallback(()=>{ getDefaultSavedAddress().then(setDefAddr).catch(()=>{}); },[]));
  
  useEffect(()=>{
    if(!branch||!schDate){ setSlots([]); setSchTime(null); return; }
    (async()=>{
      try{ 
        setSlotsLoad(true); 
        const s = await bookings.getAvailableSlots(branch.name, schDate); 
        setSlots(s); 
        const f = s.find(x => x.available); 
        setSchTime(p => s.find(x => x.label === p && x.available) ? p : (f?.label || null)); 
      }
      catch{ setSlots([]); } finally{ setSlotsLoad(false); }
    })();
  },[branch, schDate]);

  const load = async()=>{
    try{ 
      setLoading(true); 
      const [b, s] = await Promise.all([branches.getAll(), laundry.getServices()]); 
      setBranches(b.branches || []); 
      
      const raw = s.services || [];
      const unique = [];
      const seen = new Set();
      const sorted = [...raw].sort((x, y) => {
        const nx = String(x.name).toLowerCase();
        const ny = String(y.name).toLowerCase();
        if(nx.includes('8kg')) return -1;
        if(ny.includes('8kg')) return 1;
        return 0;
      });
      for(const item of sorted){
        const baseName = String(item.name).replace(/\s*\(?\d+kg\)?/gi, '').trim();
        if(!seen.has(baseName)){
          unique.push(item);
          seen.add(baseName);
        }
      }
      setServices(unique);

      const pid = route.params?.serviceId; 
      if(pid){ const f = raw.find(x => x.id === pid); if(f) setService(f); }
    }catch{ Alert.alert('Error','Failed to load.'); }finally{ setLoading(false); }
  };

  const ok = ()=>{
    if(step===1) return !!branch;
    if(step===2) return !!address?.address;
    if(step===3) return !!service;
    if(step===5) return !!schTime&&!!slots.find(s=>s.label===schTime&&s.available);
    return true;
  };

  const next = ()=>{
    if (submitting) return;
    if(step===1){ if(!branch) return; setStep(needsAddr?2:3); }
    else if(step===2){ if(!address?.address){ setAddrSheet(true); return; } setStep(3); }
    else if(step===3){ if(!service) return; setStep(4); }
    else if(step===4) setStep(5);
    else if(step===5){ if(!ok()) return; setStep(6); }
    else if(step===6) confirm_();
  };
  const back = ()=>{
    if(step===1){ navigation.goBack(); return; }
    if(step===3&&!needsAddr){ setStep(1); return; }
    setStep(s=>s-1);
  };

  const confirm_ = async()=>{
    if (submitting) return;
    if(needsAddr&&!address?.address){ 
      Alert.alert('Address Required','Please set an address.',[{text:'Set',onPress:()=>{setStep(2);setAddrSheet(true);}},{text:'Cancel',style:'cancel'}]); 
      return; 
    }
    setSub(true);
    try{
      const dk = needsAddr && address?.latitude && branch?.latitude ? distKm(branch.latitude, branch.longitude, address.latitude, address.longitude) : 0;
      const _svcPrice  = getServiceBasePrice(service, loadSize === 'LARGE' ? 8 : 5);
      const _supPrice  = ((DET_OPTS.find(o=>o.id===det)?.price||0) * (det==='none'?0:detQty)) + ((FAB_OPTS.find(o=>o.id===fab)?.price||0) * (fab==='none'?0:fabQty));
      const _rushPrice = rush ? 150 : 0;
      const _delPrice  = needsAddr ? deliveryFee : 0;

      const r = await createOrder({ 
        branchId: branch.id,
        serviceId: service.id,
        serviceType: service.name,
        serviceMode: svcMode,
        serviceModeLabel: mode.label,
        serviceTypeBackend: mode.backendServiceType,
        scheduleDate: schDate,
        scheduleTime: schTime,
        detergent: DET_OPTS.find(o=>o.id===det)?.label||'None',
        detergentQuantity: det === 'none' ? 0 : detQty,
        conditioner: FAB_OPTS.find(o=>o.id===fab)?.label||'None',
        conditionerQuantity: fab === 'none' ? 0 : fabQty,
        estimatedWeightKg: loadSize === 'LARGE' ? 8 : 5,
        delivery: needsAddr,
        isRush: rush,
        instructions: notes,
        paymentMethod: payMethod,
        total: total,
        serviceName: service.name,
        loadSize: loadSize, 
        distanceKm: dk,
        deliveryLatitude: address?.latitude??null,
        deliveryLongitude: address?.longitude??null,
        deliveryAddress: address?.address??null,
        deliveryUnitFloor: address?.unitFloor??null,
        deliveryContactName: address?.contactName??null,
        deliveryContactPhone: address?.phone??null,
        branchLatitude: branch?.latitude||null,
        branchLongitude: branch?.longitude||null,
        servicePrice: _svcPrice,
        suppliesPrice: _supPrice,
        rushPrice: _rushPrice,
        deliveryPrice: _delPrice 
      });

      const tn = String(r?.trackingNumber||'').trim(); 
      if(!tn) throw new Error('No tracking number.');
      
      const successMsg = payMethod === 'gcash' 
        ? `Booking Successful!\n\nTracking #: ${tn}\n\nNote: Please wait for weighing at the branch. You will receive a notification to pay via GCash once the final price is set.`
        : `Booking Successful!\n\nTracking #: ${tn}`;

      Alert.alert('Confirmed', successMsg, [{text:'View Order',onPress:()=>{ setStep(1); navigation.navigate('Orders'); }}]);
    }catch(error){ 
      Alert.alert('Error', extractBookingErrorMessage(error)); 
    }finally{ setSub(false); }
  };

  const vis = VIS_MAP[step]||1;
  const progress = vis / VIS_STEPS.length;

  const Stepper = ()=>(
    <View style={S.stepperWrap}>
      <View style={S.progressTrack}>
        <View style={[S.progressFill,{width:`${progress*100}%`}]}/>
      </View>
      <Text style={S.stepCounter}>{vis} / {VIS_STEPS.length}</Text>
    </View>
  );

  const Footer = ()=>(
    <View style={[S.footer,{paddingBottom:insets.bottom+20}]}>
      {service&&(
        <View style={S.footerTop}>
          <View style={{flex:1}}>
            <Text style={S.footerHint} numberOfLines={1}>{hint}</Text>
          </View>
          <Text style={S.footerTotal}>₱{total.toLocaleString()}</Text>
        </View>
      )}
      <View style={S.footerRow}>
        <TouchableOpacity style={S.backBtn} onPress={back}>
          <Text style={S.backTxt}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.contBtn,!ok()&&S.contBtnOff]} onPress={next} disabled={!ok()||submitting}>
          {submitting
            ?<ActivityIndicator color="#fff" size="small"/>
            :<View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <Text style={S.contTxt}>{step===6?'Confirm Booking':'Continue'}</Text>
                {step!==6&&<Ionicons name="arrow-forward" size={16} color="#fff"/>}
              </View>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if(loading) return <View style={S.loadWrap}><ActivityIndicator size="large" color={colors.primary}/><Text style={S.loadTxt}>Loading...</Text></View>;

  return(
    <SafeAreaView style={S.container} edges={['top']}>
      <AddressPickerSheet 
        visible={addrSheet} 
        title={svcMode==='PICKUP_ONLY'?'Pickup Address':'Pickup & Delivery Address'} 
        onConfirm={a=>{setAddrSheet(false);setAddress(a);if(step===2)setStep(3);}} 
        onClose={()=>setAddrSheet(false)} 
        initialValue={address} 
        fallbackCoordinate={branch?.latitude?{latitude:Number(branch.latitude),longitude:Number(branch.longitude)}:null}
      />
      <View style={S.hdr}><Text style={S.hdrTitle}>New Booking</Text><Text style={S.hdrSub}>Step {vis} of {VIS_STEPS.length}</Text></View>
      <Stepper/>
      <ScrollView style={{flex:1}} contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {step===1&&(
          <View>
            <Text style={S.q}>Where are we washing?</Text>
            <Text style={S.hint}>Choose a branch and your preferred service type.</Text>
            <Text style={S.sec}>Service Type</Text>
            {SERVICE_MODES.map(m=>(
              <TouchableOpacity key={m.id} style={[S.modeCard,svcMode===m.id&&S.modeCardOn]} onPress={()=>setSvcMode(m.id)} activeOpacity={0.8}>
                <View style={[S.modeIcon,svcMode===m.id&&S.modeIconOn]}><MaterialCommunityIcons name={m.icon} size={20} color={svcMode===m.id?'#fff':colors.primary}/></View>
                <View style={{flex:1}}><Text style={[S.modeName,svcMode===m.id&&S.modeNameOn]}>{m.label}</Text><Text style={[S.modeHint,svcMode===m.id&&S.modeHintOn]}>{m.hint}</Text></View>
                {svcMode===m.id&&<Ionicons name="checkmark-circle" size={20} color={colors.primary}/>}
              </TouchableOpacity>
            ))}
            <Text style={S.sec}>Select Branch</Text>
            {branches_.map(b=>(
              <TouchableOpacity key={b.id} style={[S.brCard,branch?.id===b.id&&S.brCardOn]} onPress={()=>setBranch(b)} activeOpacity={0.8}>
                <View style={[S.brIcon,branch?.id===b.id&&S.brIconOn]}><Ionicons name="storefront-outline" size={16} color={branch?.id===b.id?'#fff':colors.primary}/></View>
                <View style={{flex:1}}><Text style={[S.brName,branch?.id===b.id&&S.brNameOn]}>{b.name}</Text><Text style={S.brAddr} numberOfLines={1}>{b.address}</Text></View>
                {branch?.id===b.id&&<Ionicons name="checkmark-circle" size={18} color={colors.primary}/>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step===2&&(
          <View>
            <Text style={S.q}>{svcMode==='PICKUP_ONLY'?'Where should we pick up?':'Pickup & delivery address?'}</Text>
            <Text style={S.hint}>{svcMode==='FULL_SERVICE'?"We'll pick up from here and deliver back clean.":"We'll come pick up your laundry from this address."}</Text>
            <View style={S.branchPill}><Ionicons name="storefront-outline" size={14} color={colors.accent}/><Text style={S.branchPillTxt}>Processing at: <Text style={{fontWeight:'700'}}>{branch?.name}</Text></Text></View>
            {!address?(
              <TouchableOpacity style={S.addrEmpty} onPress={()=>setAddrSheet(true)} activeOpacity={0.75}>
                <View style={S.addrEmptyIcon}><Ionicons name="location-outline" size={28} color={colors.primary}/></View>
                <Text style={S.addrEmptyTitle}>Set Your Address</Text>
                <Text style={S.addrEmptyHint}>Search, use GPS, pin on map, or pick from saved</Text>
                <View style={S.addrEmptyBtn}><Text style={S.addrEmptyBtnTxt}>Choose Address</Text></View>
                {defAddr&&<View style={S.savedHint}><Ionicons name="bookmark-outline" size={13} color={colors.accent}/><Text style={S.savedHintTxt} numberOfLines={1}>Saved: {defAddr.label} - {defAddr.address}</Text></View>}
              </TouchableOpacity>
            ):(
              <View style={S.addrFilled}>
                <View style={S.addrFilledHdr}><View style={S.addrFilledIcon}><Ionicons name="location" size={18} color="#fff"/></View>
                  <View style={{flex:1}}><Text style={S.addrLabel}>{address.label||'Address'}</Text><Text style={S.addrMain}>{address.address}</Text>{address.unitFloor&&<Text style={S.addrSub}>{address.unitFloor}</Text>}{address.contactName&&<Text style={S.addrSub}>{address.contactName}{address.phone?` - ${address.phone}`:''}</Text>}</View>
                </View>
                <TouchableOpacity style={S.changeAddr} onPress={()=>setAddrSheet(true)}><Ionicons name="pencil-outline" size={14} color={colors.primary}/><Text style={S.changeAddrTxt}>Change Address</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {step===3&&(
          <View>
            <Text style={S.q}>Choose a service</Text>
            <Text style={S.hint}>Select the laundry package that suits your load. Prices shown are per-load flat rates (except Handwash).</Text>
            
            <Text style={S.sec}>Laundry Package</Text>
            <View style={S.svcGrid}>
              {services_.map(svc=>(
                <TouchableOpacity key={svc.id} style={[S.svcCard,service?.id===svc.id&&S.svcCardOn]} onPress={()=>setService(svc)} activeOpacity={0.8}>
                  <MaterialCommunityIcons name={getSvcIcon(svc)} size={26} color={service?.id===svc.id?'#fff':colors.primary}/>
                  <Text style={[S.svcName,service?.id===svc.id&&S.svcNameOn]}>{svc.name}</Text>
                  <Text style={[S.svcPrice,service?.id===svc.id&&S.svcPriceOn]} numberOfLines={2}>{getServicePriceLabel(svc)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={S.sec}>Estimated Load Size</Text>
            <View style={{flexDirection:'row',gap:12}}>
              <TouchableOpacity 
                style={[S.loadSizeCard, loadSize==='SMALL'&&S.loadSizeCardOn]} 
                onPress={()=>setLoadSize('SMALL')}
              >
                <Text style={[S.loadSizeName, loadSize==='SMALL'&&S.loadSizeNameOn]}>Small Load</Text>
                <Text style={[S.loadSizeHint, loadSize==='SMALL'&&S.loadSizeHintOn]}>Up to 7kg</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[S.loadSizeCard, loadSize==='LARGE'&&S.loadSizeCardOn]} 
                onPress={()=>setLoadSize('LARGE')}
              >
                <Text style={[S.loadSizeName, loadSize==='LARGE'&&S.loadSizeNameOn]}>Large Load</Text>
                <Text style={[S.loadSizeHint, loadSize==='LARGE'&&S.loadSizeHintOn]}>8kg to 10kg</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step===4&&(
          <View style={{gap:16}}>
            <Text style={S.q}>Any extras?</Text>
            <Text style={S.hint}>Add detergent or fabric conditioner — or bring your own.</Text>

            {/* ── Premium Pricing Info Card ── */}
            <View style={S.pricingInfoCard}>
              <View style={S.pricingInfoContent}>
                <View style={S.pricingInfoIcon}>
                  <Ionicons name="information-circle" size={20} color={colors.primary}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={S.pricingInfoTitle}>Transparent Pricing</Text>
                  <Text style={S.pricingInfoText}>
                    Laundry is weighed upon arrival. You'll get a <Text style={{fontWeight:'700',color:colors.primary}}>final price for confirmation</Text> before we start washing.
                  </Text>
                </View>
              </View>
            </View>

            {/* ── DETERGENT ── */}
            <Text style={S.sec}>Detergent</Text>
            {DET_OPTS.map(o=>(
              <TouchableOpacity key={o.id}
                style={[{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:colors.surface,borderRadius:14,padding:14,marginBottom:8,borderWidth:1.5,borderColor:det===o.id?colors.primary:colors.border},det===o.id&&{backgroundColor:colors.primaryLight}]}
                onPress={()=>{setDet(o.id); if(o.id!=='none')setDetQty(q=>q||1);}}
                activeOpacity={0.8}
              >
                <View style={{flex:1}}>
                  <Text style={{fontSize:14,fontWeight:'700',color:det===o.id?colors.primary:colors.text}}>{o.label}</Text>
                  {o.price>0&&<Text style={{fontSize:12,color:colors.textSecondary,marginTop:2}}>₱{o.price} per pack</Text>}
                </View>
                {det===o.id && o.id!=='none' && (
                  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                    <TouchableOpacity onPress={()=>setDetQty(q=>Math.max(1,q-1))} style={{width:32,height:32,borderRadius:16,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'}}>
                      <Text style={{color:'#fff',fontSize:18,fontWeight:'700',lineHeight:22}}>-</Text>
                    </TouchableOpacity>
                    <Text style={{fontSize:16,fontWeight:'800',color:colors.text,minWidth:24,textAlign:'center'}}>{detQty}</Text>
                    <TouchableOpacity onPress={()=>setDetQty(q=>q+1)} style={{width:32,height:32,borderRadius:16,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'}}>
                      <Text style={{color:'#fff',fontSize:18,fontWeight:'700',lineHeight:22}}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {det===o.id&&<Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{marginLeft:8}}/>}
              </TouchableOpacity>
            ))}

            {/* ── FABRIC CONDITIONER ── */}
            <Text style={S.sec}>Fabric Conditioner</Text>
            {FAB_OPTS.map(o=>(
              <TouchableOpacity key={o.id}
                style={[{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:colors.surface,borderRadius:14,padding:14,marginBottom:8,borderWidth:1.5,borderColor:fab===o.id?colors.primary:colors.border},fab===o.id&&{backgroundColor:colors.primaryLight}]}
                onPress={()=>{setFab(o.id); if(o.id!=='none')setFabQty(q=>q||1);}}
                activeOpacity={0.8}
              >
                <View style={{flex:1}}>
                  <Text style={{fontSize:14,fontWeight:'700',color:fab===o.id?colors.primary:colors.text}}>{o.label}</Text>
                  {o.price>0&&<Text style={{fontSize:12,color:colors.textSecondary,marginTop:2}}>₱{o.price} per pack</Text>}
                </View>
                {fab===o.id && o.id!=='none' && (
                  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                    <TouchableOpacity onPress={()=>setFabQty(q=>Math.max(1,q-1))} style={{width:32,height:32,borderRadius:16,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'}}>
                      <Text style={{color:'#fff',fontSize:18,fontWeight:'700',lineHeight:22}}>-</Text>
                    </TouchableOpacity>
                    <Text style={{fontSize:16,fontWeight:'800',color:colors.text,minWidth:24,textAlign:'center'}}>{fabQty}</Text>
                    <TouchableOpacity onPress={()=>setFabQty(q=>q+1)} style={{width:32,height:32,borderRadius:16,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'}}>
                      <Text style={{color:'#fff',fontSize:18,fontWeight:'700',lineHeight:22}}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {fab===o.id&&<Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{marginLeft:8}}/>}
              </TouchableOpacity>
            ))}
            
            <View style={S.rushCard}>
              <View style={{flex:1,gap:4}}>
                <Text style={S.rushTitle}>Rush service</Text>
                <Text style={S.rushSub}>Same-day priority processing</Text>
                <View style={S.rushBadge}><Text style={S.rushBadgeTxt}>+₱150 fee</Text></View>
              </View>
              <Switch value={rush} onValueChange={setRush} trackColor={{false:colors.border,true:colors.primary}} thumbColor="#fff"/>
            </View>

            <View>
              <Text style={S.sec}>Special Instructions</Text>
              <TextInput style={S.notesInput} multiline value={notes} onChangeText={setNotes} placeholder="e.g. handle with care, separate whites..." placeholderTextColor={colors.textTertiary}/>
            </View>
          </View>
        )}

        {step===5&&(
          <View style={{gap:14}}>
            <Text style={S.q}>When should we do it?</Text>
            <Text style={S.hint}>Choose your preferred date and time slot.</Text>
            
            <View style={S.dateSection}>
              <View style={S.dateSectionHead}>
                <Text style={S.sectionLabel}>DATE</Text>
                <Text style={S.dateSectionMonth}>{schDate.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.weekStrip}>
                {dates.map(d=>{
                  const sel=schDate.toDateString()===d.toDateString();
                  const isToday=new Date().toDateString()===d.toDateString();
                  return(
                    <TouchableOpacity key={d.toISOString()} style={[S.dayChip,sel&&S.dayChipOn,isToday&&!sel&&S.dayChipToday]} onPress={()=>setSchDate(d)} activeOpacity={0.75}>
                      <Text style={[S.dayChipName,sel&&S.dayChipNameOn]}>{d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</Text>
                      <Text style={[S.dayChipNum,sel&&S.dayChipNumOn]}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={S.timeSection}>
              <Text style={S.sectionLabel}>TIME SLOT</Text>
              {slotsLoad ? (
                <View style={S.slotsLoading}><ActivityIndicator color={colors.primary}/><Text style={S.slotsLoadingTxt}>Checking availability...</Text></View>
              ) : slots.length === 0 ? (
                <View style={S.slotsEmpty}><Ionicons name="calendar-outline" size={28} color={colors.border}/><Text style={S.slotsEmptyTitle}>No slots available</Text><Text style={S.slotsEmptyHint}>Try a different date.</Text></View>
              ) : (
                <View style={S.timeGrid}>
                  {slots.map(sl=>{
                    const sel=schTime===sl.label;
                    return(
                      <TouchableOpacity key={sl.label} style={[S.timeItem,sel&&S.timeItemOn,!sl.available&&S.timeItemOff]} onPress={()=>sl.available&&setSchTime(sl.label)} disabled={!sl.available} activeOpacity={0.8}>
                        <Text style={[S.timeItemTime,sel&&S.timeItemTimeOn,!sl.available&&S.timeItemTextOff]}>{sl.label}</Text>
                        <Text style={[S.timeItemPeriod,sel&&S.timeItemPeriodOn,!sl.available&&S.timeItemTextOff]}>{sl.available?'Available':'Full'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {step===6&&(
          <View style={{gap:16}}>
            <Text style={S.q}>Review & Confirm</Text>
            <Text style={S.hint}>Check your booking details before finishing.</Text>
            
            <View style={S.reviewCard}>
              <View style={S.reviewHeader}><MaterialCommunityIcons name={getSvcIcon(service)} size={22} color={colors.primary}/><Text style={S.reviewTitle}>{service?.name}</Text></View>
              <View style={S.reviewBody}>
                <View style={S.reviewRow}><Ionicons name="location-outline" size={16} color={colors.textTertiary}/><Text style={S.reviewVal} numberOfLines={1}>{address?.address || 'Branch Drop-off'}</Text></View>
                <View style={S.reviewRow}><Ionicons name="calendar-outline" size={16} color={colors.textTertiary}/><Text style={S.reviewVal}>{schDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} at {schTime}</Text></View>
                <View style={S.reviewRow}><Ionicons name="scale-outline" size={16} color={colors.textTertiary}/><Text style={S.reviewVal}>Estimated: {loadSize==='LARGE'?'8kg+':'5kg-7kg'}</Text></View>
              </View>
            </View>

            <Text style={S.sec}>Payment Method</Text>
            <View style={{flexDirection:'row',gap:12}}>
              <TouchableOpacity style={[S.payBtn,payMethod==='gcash'&&S.payBtnOn]} onPress={()=>setPay('gcash')}>
                <Ionicons name="phone-portrait-outline" size={18} color={payMethod==='gcash'?'#fff':colors.primary}/>
                <Text style={[S.payBtnTxt,payMethod==='gcash'&&S.payBtnTxtOn]}>GCash</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.payBtn,payMethod==='cash'&&S.payBtnOn]} onPress={()=>setPay('cash')}>
                <Ionicons name="cash-outline" size={18} color={payMethod==='cash'?'#fff':colors.primary}/>
                <Text style={[S.payBtnTxt,payMethod==='cash'&&S.payBtnTxtOn]}>COD / Cash</Text>
              </TouchableOpacity>
            </View>

            {/*  Breakdown  */}
            <View style={S.breakdown}>
              <View style={S.breakRow}><Text style={S.breakLbl}>Service Fee</Text><Text style={S.breakVal}>₱{getServiceBasePrice(service, loadSize==='LARGE'?8:5).toLocaleString()}</Text></View>
              {det!=='none'&&<View style={S.breakRow}><Text style={S.breakLbl}>{detOpt?.label} x{detQty}</Text><Text style={S.breakVal}>₱{detCost.toLocaleString()}</Text></View>}
              {fab!=='none'&&<View style={S.breakRow}><Text style={S.breakLbl}>{fabOpt?.label} x{fabQty}</Text><Text style={S.breakVal}>₱{fabCost.toLocaleString()}</Text></View>}
              {rush&&<View style={S.breakRow}><Text style={S.breakLbl}>Rush Fee</Text><Text style={S.breakVal}>₱150</Text></View>}
              {needsAddr&&<View style={S.breakRow}><Text style={S.breakLbl}>Delivery Fee</Text><Text style={S.breakVal}>₱{deliveryFee.toLocaleString()}</Text></View>}
              <View style={S.breakDiv}/>
              <View style={S.breakRow}><Text style={S.breakTotalLbl}>Total Estimated</Text><Text style={S.breakTotalVal}>₱{total.toLocaleString()}</Text></View>
            </View>
          </View>
        )}

      </ScrollView>
      <Footer/>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex:1, backgroundColor:colors.background },
  hdr: { padding:20, paddingBottom:10 },
  hdrTitle: { fontSize:24, fontWeight:'800', color:colors.text },
  hdrSub: { fontSize:13, color:colors.textTertiary, marginTop:2, fontWeight:'600' },
  stepperWrap: { paddingHorizontal:20, marginBottom:10 },
  progressTrack: { height:6, backgroundColor:colors.border, borderRadius:3, overflow:'hidden' },
  progressFill: { height:'100%', backgroundColor:colors.primary },
  stepCounter: { fontSize:12, color:colors.textTertiary, textAlign:'right', marginTop:6, fontWeight:'700' },
  scroll: { padding:20, paddingBottom:140 },
  loadWrap: { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  loadTxt: { fontSize:14, color:colors.textSecondary, fontWeight:'600' },
  q: { fontSize:20, fontWeight:'800', color:colors.text, marginBottom:6 },
  hint: { fontSize:14, color:colors.textSecondary, marginBottom:24, lineHeight:20 },
  sec: { fontSize:14, fontWeight:'700', color:colors.textTertiary, marginTop:24, marginBottom:12, textTransform:'uppercase', letterSpacing:0.5 },
  modeCard: { flexDirection:'row', alignItems:'center', padding:16, backgroundColor:colors.surface, borderRadius:16, marginBottom:12, borderWidth:1.5, borderColor:colors.border },
  modeCardOn: { borderColor:colors.primary, backgroundColor:colors.primaryLight },
  modeIcon: { width:44, height:44, borderRadius:12, backgroundColor:colors.surface, alignItems:'center', justifyContent:'center', marginRight:16 },
  modeIconOn: { backgroundColor:colors.primary },
  modeName: { fontSize:16, fontWeight:'700', color:colors.text },
  modeNameOn: { color:colors.primary },
  modeHint: { fontSize:13, color:colors.textSecondary, marginTop:2 },
  modeHintOn: { color:colors.primary, opacity:0.8 },
  brCard: { flexDirection:'row', alignItems:'center', padding:12, backgroundColor:colors.surface, borderRadius:14, marginBottom:8, borderWidth:1, borderColor:colors.border },
  brCardOn: { borderColor:colors.primary, backgroundColor:colors.primaryLight },
  brIcon: { width:32, height:32, borderRadius:8, backgroundColor:colors.surface, alignItems:'center', justifyContent:'center', marginRight:12 },
  brIconOn: { backgroundColor:colors.primary },
  brName: { fontSize:14, fontWeight:'700', color:colors.text },
  brNameOn: { color:colors.primary },
  brAddr: { fontSize:12, color:colors.textTertiary, marginTop:1 },
  branchPill: { flexDirection:'row', alignItems:'center', backgroundColor:colors.surface, alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:6, borderRadius:20, marginBottom:16, borderSize:1, borderColor:colors.border },
  branchPillTxt: { fontSize:12, color:colors.textSecondary, marginLeft:6 },
  addrEmpty: { backgroundColor:colors.surface, borderRadius:20, padding:24, alignItems:'center', borderStyle:'dashed', borderWidth:2, borderColor:colors.border },
  addrEmptyIcon: { width:56, height:56, borderRadius:28, backgroundColor:colors.primaryLight, alignItems:'center', justifyContent:'center', marginBottom:16 },
  addrEmptyTitle: { fontSize:18, fontWeight:'800', color:colors.text },
  addrEmptyHint: { fontSize:13, color:colors.textTertiary, textAlign:'center', marginTop:4, marginBottom:20 },
  addrEmptyBtn: { backgroundColor:colors.primary, paddingHorizontal:24, paddingVertical:12, borderRadius:12 },
  addrEmptyBtnTxt: { color:'#fff', fontWeight:'700', fontSize:14 },
  savedHint: { flexDirection:'row', alignItems:'center', marginTop:16, opacity:0.7 },
  savedHintTxt: { fontSize:11, color:colors.textTertiary, marginLeft:4 },
  addrFilled: { backgroundColor:colors.surface, borderRadius:20, padding:16, borderWidth:1, borderColor:colors.border },
  addrFilledHdr: { flexDirection:'row', gap:12 },
  addrFilledIcon: { width:32, height:32, borderRadius:8, backgroundColor:colors.primary, alignItems:'center', justifyContent:'center' },
  addrLabel: { fontSize:12, fontWeight:'700', color:colors.primary, textTransform:'uppercase' },
  addrMain: { fontSize:14, fontWeight:'600', color:colors.text, marginTop:2 },
  addrSub: { fontSize:12, color:colors.textTertiary, marginTop:1 },
  changeAddr: { flexDirection:'row', alignItems:'center', marginTop:12, paddingTop:12, borderTopWidth:1, borderTopColor:colors.border },
  changeAddrTxt: { fontSize:12, color:colors.primary, fontWeight:'700', marginLeft:4 },
  svcGrid: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  svcCard: { width:(width-50)/2, backgroundColor:colors.surface, borderRadius:16, padding:16, borderWidth:1.5, borderColor:colors.border, gap:8 },
  svcCardOn: { borderColor:colors.primary, backgroundColor:colors.primary },
  svcName: { fontSize:14, fontWeight:'700', color:colors.text },
  svcNameOn: { color:'#fff' },
  svcPrice: { fontSize:12, color:colors.textSecondary },
  svcPriceOn: { color:'rgba(255,255,255,0.8)' },
  loadSizeCard: { flex:1, backgroundColor:colors.surface, borderRadius:16, padding:16, borderWidth:1.5, borderColor:colors.border },
  loadSizeCardOn: { borderColor:colors.primary, backgroundColor:colors.primaryLight },
  loadSizeName: { fontSize:15, fontWeight:'800', color:colors.text },
  loadSizeNameOn: { color:colors.primary },
  loadSizeHint: { fontSize:12, color:colors.textTertiary, marginTop:4 },
  loadSizeHintOn: { color:colors.primary, opacity:0.7 },
  pricingInfoCard: { backgroundColor:'#f0f7ff', borderRadius:16, padding:14, borderLeftWidth:4, borderLeftColor:colors.primary },
  pricingInfoContent: { flexDirection:'row', gap:10 },
  pricingInfoIcon: { marginTop:2 },
  pricingInfoTitle: { fontSize:14, fontWeight:'800', color:colors.text },
  pricingInfoText: { fontSize:13, color:colors.textSecondary, lineHeight:18, marginTop:2 },
  rushCard: { flexDirection:'row', alignItems:'center', backgroundColor:colors.surface, padding:16, borderRadius:16, borderWidth:1, borderColor:colors.border },
  rushTitle: { fontSize:15, fontWeight:'800', color:colors.text },
  rushSub: { fontSize:12, color:colors.textTertiary },
  rushBadge: { backgroundColor:'#fff0f0', alignSelf:'flex-start', paddingHorizontal:8, paddingVertical:2, borderRadius:6, marginTop:4 },
  rushBadgeTxt: { fontSize:10, fontWeight:'800', color:'#ff4d4d' },
  notesInput: { backgroundColor:colors.surface, borderRadius:16, padding:16, height:100, textAlignVertical:'top', fontSize:14, color:colors.text, borderWidth:1, borderColor:colors.border },
  dateSection: { backgroundColor:colors.surface, borderRadius:20, padding:16, borderWidth:1, borderColor:colors.border },
  dateSectionHead: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  sectionLabel: { fontSize:11, fontWeight:'800', color:colors.textTertiary, letterSpacing:1 },
  dateSectionMonth: { fontSize:13, fontWeight:'700', color:colors.textSecondary },
  weekStrip: { gap:10, paddingRight:20 },
  dayChip: { width:54, height:70, borderRadius:14, backgroundColor:colors.background, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:colors.border },
  dayChipOn: { backgroundColor:colors.primary, borderColor:colors.primary },
  dayChipToday: { borderColor:colors.primary, borderWidth:1 },
  dayChipName: { fontSize:10, fontWeight:'700', color:colors.textTertiary, marginBottom:6 },
  dayChipNameOn: { color:'rgba(255,255,255,0.7)' },
  dayChipNum: { fontSize:18, fontWeight:'800', color:colors.text },
  dayChipNumOn: { color:'#fff' },
  timeSection: { backgroundColor:colors.surface, borderRadius:20, padding:16, borderWidth:1, borderColor:colors.border },
  timeGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:12 },
  timeItem: { width:(width-72)/2, padding:14, borderRadius:14, backgroundColor:colors.background, borderWidth:1, borderColor:colors.border },
  timeItemOn: { backgroundColor:colors.primary, borderColor:colors.primary },
  timeItemOff: { opacity:0.4 },
  timeItemTime: { fontSize:14, fontWeight:'700', color:colors.text, textAlign:'center' },
  timeItemTimeOn: { color:'#fff' },
  timeItemPeriod: { fontSize:10, fontWeight:'600', color:colors.textTertiary, textAlign:'center', marginTop:2 },
  timeItemPeriodOn: { color:'rgba(255,255,255,0.8)' },
  timeItemTextOff: { color:colors.textTertiary },
  slotsLoading: { padding:40, alignItems:'center', gap:12 },
  slotsLoadingTxt: { fontSize:13, color:colors.textTertiary, fontWeight:'600' },
  slotsEmpty: { padding:40, alignItems:'center', gap:8 },
  slotsEmptyTitle: { fontSize:15, fontWeight:'700', color:colors.textSecondary },
  slotsEmptyHint: { fontSize:12, color:colors.textTertiary },
  reviewCard: { backgroundColor:colors.surface, borderRadius:20, padding:16, borderWidth:1, borderColor:colors.border },
  reviewHeader: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:12, paddingBottom:12, borderBottomWidth:1, borderBottomColor:colors.border },
  reviewTitle: { fontSize:16, fontWeight:'800', color:colors.text },
  reviewBody: { gap:8 },
  reviewRow: { flexDirection:'row', alignItems:'center', gap:10 },
  reviewVal: { fontSize:13, color:colors.textSecondary, flex:1 },
  payBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', padding:16, borderRadius:16, backgroundColor:colors.surface, borderWidth:1.5, borderColor:colors.border, gap:8 },
  payBtnOn: { backgroundColor:colors.primary, borderColor:colors.primary },
  payBtnTxt: { fontSize:14, fontWeight:'700', color:colors.text },
  payBtnTxtOn: { color:'#fff' },
  breakdown: { backgroundColor:colors.surface, borderRadius:20, padding:16, marginTop:8 },
  breakRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:10 },
  breakLbl: { fontSize:13, color:colors.textSecondary },
  breakVal: { fontSize:13, fontWeight:'600', color:colors.text },
  breakDiv: { height:1, backgroundColor:colors.border, marginVertical:12 },
  breakTotalLbl: { fontSize:15, fontWeight:'800', color:colors.text },
  breakTotalVal: { fontSize:18, fontWeight:'800', color:colors.primary },
  footer: { position:'absolute', bottom:0, left:0, right:0, backgroundColor:colors.surface, padding:20, borderTopWidth:1, borderTopColor:colors.border },
  footerTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  footerHint: { fontSize:12, fontWeight:'600', color:colors.textTertiary },
  footerTotal: { fontSize:20, fontWeight:'800', color:colors.primary },
  footerRow: { flexDirection:'row', gap:12 },
  backBtn: { flex:1, height:50, borderRadius:12, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:colors.border },
  backTxt: { fontSize:15, fontWeight:'700', color:colors.textSecondary },
  contBtn: { flex:2, height:50, backgroundColor:colors.primary, borderRadius:12, alignItems:'center', justifyContent:'center' },
  contBtnOff: { backgroundColor:colors.border },
  contTxt: { fontSize:15, fontWeight:'700', color:'#fff' },
});
