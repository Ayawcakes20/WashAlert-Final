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
  { id: 'FULL_SERVICE',  label: 'Full Service',  hint: 'Pickup → Laundry → Delivery', icon: 'washing-machine',  backendServiceType: 'PICKUP_DELIVERY', needsAddress: true  },
  { id: 'DROP_OFF_ONLY', label: 'Drop-off Only', hint: 'You bring & pick up at branch', icon: 'store-outline',    backendServiceType: 'DROP_OFF',        needsAddress: false },
  { id: 'PICKUP_ONLY',   label: 'Pickup Only',   hint: 'We pick up — you get at branch',icon: 'truck-outline',   backendServiceType: 'PICKUP_DELIVERY', needsAddress: true  },
];
const DET_OPTS = [
  { id: 'none',  label: 'None',           price: 0  },
  { id: 'surf',  label: 'Surf (Basic)',    price: 25 },
  { id: 'ariel', label: 'Ariel (Premium)', price: 30 },
];
const FAB_OPTS = [
  { id: 'none',  label: 'None',            price: 0  },
  { id: 'charm', label: 'Charm (Basic)',    price: 15 },
  { id: 'downy', label: 'Downy (Premium)', price: 25 },
];
const VIS_STEPS = ['Branch','Service','Load','Supplies','Schedule','Confirm'];
const VIS_MAP   = { 1:1, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6 };

const getSvcIcon = s => {
  const n = String(s?.name||'').toLowerCase();
  if(n.includes('handwash')) return 'hand-wash';
  if(n.includes('dry'))      return 'tumble-dryer';
  if(n.includes('premium'))  return 'star-four-points-outline';
  if(n.includes('eco'))      return 'leaf';
  return 'washing-machine';
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
  const [loadType, setLoadType]   = useState('clothes');
  const [kg, setKg]               = useState(5);
  const [det, setDet]             = useState('none');
  const [fab, setFab]             = useState('none');
  const [schDate, setSchDate]     = useState(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; });
  const [schTime, setSchTime]     = useState(null);
  const [slots, setSlots]         = useState([]);
  const [slotsLoad, setSlotsLoad] = useState(false);
  const [rush, setRush]           = useState(false);
  const [notes, setNotes]         = useState('');
  const [payMethod, setPay]       = useState('gcash');
  const dates                     = mkDates(7);
  const mode                      = SERVICE_MODES.find(m=>m.id===svcMode)||SERVICE_MODES[0];
  const needsAddr                 = mode.needsAddress;
  const maxKg                     = loadType==='beddings' ? 7 : 8;

  const deliveryFee = useMemo(()=>{
    if(!needsAddr) return 0;
    if(!address?.latitude||!branch?.latitude) return 50;
    const d=distKm(branch.latitude,branch.longitude,address.latitude,address.longitude);
    return Math.min(100,Math.max(40,Math.round(40+d*12)));
  },[needsAddr,address,branch]);

  const total = useMemo(()=>{
    if(!service) return 0;
    const hw=String(service.name||'').toLowerCase().includes('handwash');
    const base=hw?(kg<=3?kg*150:kg*90):(service.price||0)*kg;
    const s9=kg>=9?50:0;
    const d=DET_OPTS.find(o=>o.id===det)?.price||0;
    const f=FAB_OPTS.find(o=>o.id===fab)?.price||0;
    return base+s9+d+f+(rush?150:0)+deliveryFee;
  },[service,kg,det,fab,rush,deliveryFee]);

  const hint = useMemo(()=>{
    if(!service) return '';
    const p=[service.name,`${kg}kg`];
    if(det!=='none') p.push(DET_OPTS.find(o=>o.id===det)?.label);
    if(fab!=='none') p.push(FAB_OPTS.find(o=>o.id===fab)?.label);
    if(rush) p.push('Rush +₱150');
    return p.filter(Boolean).join(' · ');
  },[service,kg,det,fab,rush]);

  useEffect(()=>{ load(); },[]);
  useFocusEffect(useCallback(()=>{ getDefaultSavedAddress().then(setDefAddr).catch(()=>{}); },[]));
  useEffect(()=>{
    if(!branch||!schDate){ setSlots([]); setSchTime(null); return; }
    (async()=>{
      try{ setSlotsLoad(true); const s=await bookings.getAvailableSlots(branch.name,schDate); setSlots(s); const f=s.find(x=>x.available); setSchTime(p=>s.find(x=>x.label===p&&x.available)?p:(f?.label||null)); }
      catch{ setSlots([]); } finally{ setSlotsLoad(false); }
    })();
  },[branch,schDate]);

  const load = async()=>{
    try{ setLoading(true); const [b,s]=await Promise.all([branches.getAll(),laundry.getServices()]); setBranches(b.branches||[]); setServices(s.services||[]);
      const pid=route.params?.serviceId; if(pid){ const f=s.services?.find(x=>x.id===pid); if(f) setService(f); }
    }catch{ Alert.alert('Error','Failed to load.'); }finally{ setLoading(false); }
  };

  const ok = ()=>{
    if(step===1) return !!branch;
    if(step===2) return !!address?.address;
    if(step===3) return !!service;
    if(step===4) return kg>=1&&kg<=9;
    if(step===6) return !!schTime&&!!slots.find(s=>s.label===schTime&&s.available);
    return true;
  };

  const next = ()=>{
    if(step===1){ if(!branch) return; setStep(needsAddr?2:3); }
    else if(step===2){ if(!address?.address){ setAddrSheet(true); return; } setStep(3); }
    else if(step===3){ if(!service) return; setStep(4); }
    else if(step===4) setStep(5);
    else if(step===5) setStep(6);
    else if(step===6){ if(!ok()) return; setStep(7); }
    else if(step===7) confirm_();
  };
  const back = ()=>{
    if(step===1){ navigation.goBack(); return; }
    if(step===3&&!needsAddr){ setStep(1); return; }
    setStep(s=>s-1);
  };

  const confirm_ = async()=>{
    if(needsAddr&&!address?.address){ Alert.alert('Address Required','Please set an address.',[{text:'Set',onPress:()=>{setStep(2);setAddrSheet(true);}},{text:'Cancel',style:'cancel'}]); return; }
    setSub(true);
    try{
      const dk=needsAddr&&address?.latitude&&branch?.latitude?distKm(branch.latitude,branch.longitude,address.latitude,address.longitude):0;
      const r=await createOrder({ branchId:branch.id,serviceId:service.id,serviceType:service.name,serviceMode:svcMode,serviceModeLabel:mode.label,serviceTypeBackend:mode.backendServiceType,scheduleDate:schDate,scheduleTime:schTime,loadKg:kg,detergent:DET_OPTS.find(o=>o.id===det)?.label||'None',conditioner:FAB_OPTS.find(o=>o.id===fab)?.label||'None',delivery:needsAddr,isRush:rush,instructions:notes,paymentMethod:payMethod,total,serviceName:service.name,distanceKm:dk,deliveryLatitude:address?.latitude??null,deliveryLongitude:address?.longitude??null,deliveryAddress:address?.address??null,deliveryUnitFloor:address?.unitFloor??null,deliveryContactName:address?.contactName??null,deliveryContactPhone:address?.phone??null,branchLatitude:branch?.latitude||null,branchLongitude:branch?.longitude||null });
      const tn=String(r?.trackingNumber||'').trim(); if(!tn) throw new Error('No tracking number.');
      if(payMethod==='gcash'){
        try{ const cp=await payments.initiateGcashCheckout(tn); const u=cp?.checkout_url||cp?.checkoutUrl||cp?.url||cp; const cu=u?String(u).trim():null; if(cu&&/^https?:\/\//i.test(cu)){ try{ await WebBrowser.openBrowserAsync(cu); }catch{ if(await Linking.canOpenURL(cu)) await Linking.openURL(cu); } } }
        catch{ Alert.alert('Payment Error','Booking created but payment gateway failed. Check Orders to pay.',[{text:'OK',onPress:()=>navigation.navigate('Orders')}]); return; }
      }
      Alert.alert('Booking Confirmed',`Tracking #: ${tn}`,[{text:'View Order',onPress:()=>{ setStep(1); navigation.navigate('Orders'); }}]);
    }catch{ Alert.alert('Error','Failed to place booking.'); }finally{ setSub(false); }
  };

  const vis = VIS_MAP[step]||1;
  const progress = vis / VIS_STEPS.length;

  // Clean progress bar (no labels) — like Image 3
  const Stepper = ()=>(
    <View style={S.stepperWrap}>
      <View style={S.progressTrack}>
        <View style={[S.progressFill,{width:`${progress*100}%`}]}/>
      </View>
      <Text style={S.stepCounter}>{vis} / {VIS_STEPS.length}</Text>
    </View>
  );

  // Footer: running total + pill Back/Next buttons — clears floating tab bar
  const Footer = ()=>(
    <View style={[S.footer,{paddingBottom:insets.bottom+90}]}>
      {service&&(
        <View style={S.footerTop}>
          <View style={{flex:1}}>
            <Text style={S.footerLabel}>Running Total</Text>
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
            :<Text style={S.contTxt}>{step===7?'Confirm & Pay':'Next'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if(loading) return <View style={S.loadWrap}><ActivityIndicator size="large" color={colors.primary}/><Text style={S.loadTxt}>Loading…</Text></View>;

  return(
    <SafeAreaView style={S.container} edges={['top']}>
      <AddressPickerSheet visible={addrSheet} title={svcMode==='PICKUP_ONLY'?'Pickup Address':'Pickup & Delivery Address'} onConfirm={a=>{setAddrSheet(false);setAddress(a);if(step===2)setStep(3);}} onClose={()=>setAddrSheet(false)} initialValue={address} fallbackCoordinate={branch?.latitude?{latitude:Number(branch.latitude),longitude:Number(branch.longitude)}:null}/>
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
                <View style={S.addrEmptyBtn}><Text style={S.addrEmptyBtnTxt}>Choose Address →</Text></View>
                {defAddr&&<View style={S.savedHint}><Ionicons name="bookmark-outline" size={13} color={colors.accent}/><Text style={S.savedHintTxt} numberOfLines={1}>Saved: {defAddr.label} — {defAddr.address}</Text></View>}
              </TouchableOpacity>
            ):(
              <View style={S.addrFilled}>
                <View style={S.addrFilledHdr}><View style={S.addrFilledIcon}><Ionicons name="location" size={18} color="#fff"/></View>
                  <View style={{flex:1}}><Text style={S.addrLabel}>{address.label||'Address'}</Text><Text style={S.addrMain}>{address.address}</Text>{address.unitFloor&&<Text style={S.addrSub}>{address.unitFloor}</Text>}{address.contactName&&<Text style={S.addrSub}>{address.contactName}{address.phone?` · ${address.phone}`:''}</Text>}</View>
                </View>
                <TouchableOpacity style={S.changeAddr} onPress={()=>setAddrSheet(true)}><Ionicons name="pencil-outline" size={14} color={colors.primary}/><Text style={S.changeAddrTxt}>Change Address</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {step===3&&(
          <View>
            <Text style={S.q}>What's in the bag?</Text>
            <Text style={S.hint}>Pick a laundry package and tell us what type of items.</Text>
            <Text style={S.sec}>Load Type</Text>
            <View style={S.toggleRow}>
              {['clothes','beddings'].map(t=>(
                <TouchableOpacity key={t} style={[S.toggleBtn,loadType===t&&S.toggleBtnOn]} onPress={()=>{ setLoadType(t); if(t==='beddings'&&kg>7) setKg(7); }}>
                  <Text style={[S.toggleTxt,loadType===t&&S.toggleTxtOn]}>{t==='clothes'?'👕 Clothes':'🛏 Beddings'}</Text>
                  <Text style={[S.toggleSub,loadType===t&&S.toggleSubOn]}>{t==='clothes'?'Max 8kg':'Max 7kg'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={S.sec}>Laundry Package</Text>
            <View style={S.svcGrid}>
              {services_.map(svc=>(
                <TouchableOpacity key={svc.id} style={[S.svcCard,service?.id===svc.id&&S.svcCardOn]} onPress={()=>setService(svc)} activeOpacity={0.8}>
                  <MaterialCommunityIcons name={getSvcIcon(svc)} size={26} color={service?.id===svc.id?'#fff':colors.primary}/>
                  <Text style={[S.svcName,service?.id===svc.id&&S.svcNameOn]}>{svc.name}</Text>
                  <Text style={[S.svcPrice,service?.id===svc.id&&S.svcPriceOn]}>₱{svc.price}/kg</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step===4&&(
          <View>
            <Text style={S.q}>How many kilos?</Text>
            <Text style={S.hint}>Max {maxKg}kg for {loadType}. Absolute limit is 9kg (+₱50 surcharge).</Text>
            <View style={S.kgRow}>
              <TouchableOpacity style={S.kgBtn} onPress={()=>setKg(k=>Math.max(1,k-1))}><Text style={S.kgBtnTxt}>−</Text></TouchableOpacity>
              <View style={S.kgDisplay}><Text style={S.kgNum}>{kg}</Text><Text style={S.kgUnit}>kg</Text></View>
              <TouchableOpacity style={S.kgBtn} onPress={()=>setKg(k=>Math.min(9,k+1))}><Text style={S.kgBtnTxt}>+</Text></TouchableOpacity>
            </View>
            {kg>=9&&<View style={S.surcharge}><Ionicons name="warning-outline" size={14} color={colors.warning}/><Text style={S.surchargeTxt}>9kg limit — ₱50 surcharge applies</Text></View>}
            {kg>maxKg&&kg<9&&<View style={S.surcharge}><Ionicons name="information-circle-outline" size={14} color={colors.info}/><Text style={S.surchargeTxt}>Exceeds recommended limit for {loadType} ({maxKg}kg)</Text></View>}
            <View style={S.kgBar}><View style={[S.kgFill,{width:`${Math.min(100,(kg/9)*100)}%`,backgroundColor:kg>=9?colors.error:kg>maxKg?colors.warning:colors.primary}]}/></View>
            <View style={S.liveCard}>
              <Text style={S.liveLbl}>Service Cost Preview</Text>
              <Text style={S.liveAmt}>₱{total.toLocaleString()}</Text>
              <Text style={S.liveBreak}>{service?.name} · {kg}kg{kg>=9?' + ₱50 surcharge':''}</Text>
            </View>
          </View>
        )}

        {step===5&&(
          <View>
            <Text style={S.q}>Any extras?</Text>
            <Text style={S.hint}>Add detergent or fabric conditioner — or bring your own.</Text>
            <Text style={S.sec}>Detergent</Text>
            <View style={S.pillRow}>
              {DET_OPTS.map(o=>(
                <TouchableOpacity key={o.id} style={[S.pill,det===o.id&&S.pillOn]} onPress={()=>setDet(o.id)}>
                  <Text style={[S.pillTxt,det===o.id&&S.pillTxtOn]}>{o.label}{o.price>0?` +₱${o.price}`:''}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={S.sec}>Fabric Conditioner</Text>
            <View style={S.pillRow}>
              {FAB_OPTS.map(o=>(
                <TouchableOpacity key={o.id} style={[S.pill,fab===o.id&&S.pillOn]} onPress={()=>setFab(o.id)}>
                  <Text style={[S.pillTxt,fab===o.id&&S.pillTxtOn]}>{o.label}{o.price>0?` +₱${o.price}`:''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step===6&&(
          <View>
            <Text style={S.q}>When should we come?</Text>
            <Text style={S.hint}>Pick a pickup date and available time slot.</Text>

            {/* ── DATE PICKER ── */}
            <View style={S.dateSection}>
              <View style={S.dateSectionHead}>
                <Text style={S.dateSectionTitle}>Select Date</Text>
                <Text style={S.dateSectionMonth}>
                  {schDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.weekStrip}>
                {dates.map(d=>{
                  const sel=schDate.toDateString()===d.toDateString();
                  const isToday=new Date().toDateString()===d.toDateString();
                  return(
                    <TouchableOpacity key={d.toISOString()} style={[S.dayChip, sel&&S.dayChipOn]} onPress={()=>setSchDate(d)} activeOpacity={0.75}>
                      <Text style={[S.dayChipName, sel&&S.dayChipNameOn]}>
                        {d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}
                      </Text>
                      <Text style={[S.dayChipNum, sel&&S.dayChipNumOn]}>{d.getDate()}</Text>
                      {isToday&&!sel&&<View style={S.todayDot}/>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── TIME SLOT PICKER ── */}
            <View style={S.timeSection}>
              <Text style={S.dateSectionTitle}>Select Time</Text>
              {slotsLoad ? (
                <View style={S.slotsLoading}>
                  <ActivityIndicator color={colors.primary}/>
                  <Text style={S.slotsLoadingTxt}>Checking availability…</Text>
                </View>
              ) : slots.length === 0 ? (
                <View style={S.slotsEmpty}>
                  <Ionicons name="calendar-outline" size={32} color={colors.border}/>
                  <Text style={S.slotsEmptyTitle}>No slots available</Text>
                  <Text style={S.slotsEmptyHint}>Try selecting a different date.</Text>
                </View>
              ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.timeStrip}>
                  {slots.map(sl=>{
                    const sel=schTime===sl.label;
                    // Parse "8:00 AM - 9:30 AM" → startTime="8:00 AM" → hour="8:00", period="AM"
                    const startTime = (sl.label||'').split(' - ')[0].trim();
                    const timeParts = startTime.split(' ');
                    const period = timeParts.length >= 2 ? timeParts[timeParts.length-1] : '';
                    const hour   = timeParts.slice(0, timeParts.length >= 2 ? -1 : timeParts.length).join('');
                    return(
                      <TouchableOpacity
                        key={sl.label}
                        style={[S.timeChip, sel&&S.timeChipOn, !sl.available&&S.timeChipOff]}
                        onPress={()=>sl.available&&setSchTime(sl.label)}
                        disabled={!sl.available}
                        activeOpacity={0.8}
                      >
                        <Text style={[S.timeChipPeriod, sel&&S.timeChipPeriodOn, !sl.available&&S.timeChipTextOff]}>{period||'--'}</Text>
                        <Text style={[S.timeChipHour, sel&&S.timeChipHourOn, !sl.available&&S.timeChipTextOff]}>{hour||sl.label}</Text>
                        {!sl.available&&<Text style={S.timeChipFull}>Full</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={S.rushCard}>
              <View style={{flex:1}}><Text style={S.rushTitle}>Rush Service?</Text><Text style={S.rushSub}>₱150.00 additional fee applies.</Text></View>
              <Switch value={rush} onValueChange={setRush} trackColor={{false:colors.border,true:colors.primary}} thumbColor="#fff"/>
            </View>
            <Text style={S.sec}>Special Instructions</Text>
            <TextInput style={S.notesInput} multiline value={notes} onChangeText={setNotes} placeholder="e.g. Separate whites, use delicate mode…" placeholderTextColor={colors.textTertiary}/>
          </View>
        )}

        {step===7&&(
          <View>
            <Text style={S.q}>Review & Confirm</Text>
            <Text style={S.hint}>Check your order before payment.</Text>
            {[
              {label:'Branch',       val:branch?.name},
              needsAddr&&{label:'Address',      val:address?.address},
              {label:'Service',      val:service?.name},
              {label:'Load Type',    val:`${loadType} · ${kg}kg`},
              {label:'Detergent',    val:DET_OPTS.find(o=>o.id===det)?.label},
              {label:'Fabcon',       val:FAB_OPTS.find(o=>o.id===fab)?.label},
              {label:'Schedule',     val:`${schDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${schTime}`},
              rush&&{label:'Rush',   val:'Yes +₱150'},
              needsAddr&&{label:'Delivery Fee', val:`₱${deliveryFee}`},
            ].filter(Boolean).map((row,i)=>(
              <View key={i} style={S.sumRow}>
                <Text style={S.sumKey}>{row.label}</Text>
                <Text style={S.sumVal}>{row.val||'—'}</Text>
              </View>
            ))}
            <View style={[S.sumRow,S.sumTotal]}><Text style={S.sumTotalKey}>Total</Text><Text style={S.sumTotalVal}>₱{total.toLocaleString()}</Text></View>
            <Text style={S.sec}>Payment Method</Text>
            {['gcash','cod'].map(p=>(
              <TouchableOpacity key={p} style={[S.payCard,payMethod===p&&S.payCardOn]} onPress={()=>setPay(p)}>
                <MaterialCommunityIcons name={p==='gcash'?'cellphone-wireless':'cash'} size={22} color={payMethod===p?'#fff':colors.primary}/>
                <Text style={[S.payName,payMethod===p&&S.payNameOn]}>{p==='gcash'?'GCash':'Cash on Delivery'}</Text>
                {payMethod===p&&<Ionicons name="checkmark-circle" size={18} color={payMethod===p?'#fff':colors.primary}/>}
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>
      <Footer/>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container:{flex:1,backgroundColor:colors.background},
  loadWrap:{flex:1,alignItems:'center',justifyContent:'center',gap:12},
  loadTxt:{fontSize:14,color:colors.textSecondary},
  hdr:{paddingHorizontal:20,paddingTop:12,paddingBottom:4,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  hdrTitle:{fontSize:22,fontWeight:'900',color:colors.text,letterSpacing:-0.4},
  hdrSub:{fontSize:13,color:colors.textSecondary,marginTop:2},
  // Progress bar stepper
  stepperWrap:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:16,gap:12},
  progressTrack:{flex:1,height:5,backgroundColor:colors.border,borderRadius:3,overflow:'hidden'},
  progressFill:{height:5,backgroundColor:colors.primary,borderRadius:3},
  stepCounter:{fontSize:12,fontWeight:'700',color:colors.textSecondary,minWidth:36,textAlign:'right'},
  scroll:{paddingHorizontal:20,paddingBottom:20},
  q:{fontSize:22,fontWeight:'900',color:colors.text,letterSpacing:-0.4,marginTop:8,marginBottom:4},
  hint:{fontSize:14,color:colors.textSecondary,marginBottom:20,lineHeight:20},
  sec:{fontSize:12,fontWeight:'700',color:colors.textTertiary,letterSpacing:1,textTransform:'uppercase',marginBottom:10,marginTop:16},
  modeCard:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:14,padding:14,marginBottom:10,borderWidth:1,borderColor:colors.border,gap:12},
  modeCardOn:{borderColor:colors.primary,backgroundColor:colors.primaryLight},
  modeIcon:{width:38,height:38,borderRadius:10,backgroundColor:colors.primaryLight,alignItems:'center',justifyContent:'center'},
  modeIconOn:{backgroundColor:colors.primary},
  modeName:{fontSize:15,fontWeight:'700',color:colors.text},
  modeNameOn:{color:colors.primary},
  modeHint:{fontSize:12,color:colors.textSecondary,marginTop:1},
  modeHintOn:{color:colors.primary},
  brCard:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:14,padding:14,marginBottom:8,borderWidth:1,borderColor:colors.border,gap:12},
  brCardOn:{borderColor:colors.primary,backgroundColor:colors.primaryLight},
  brIcon:{width:34,height:34,borderRadius:9,backgroundColor:colors.primaryLight,alignItems:'center',justifyContent:'center'},
  brIconOn:{backgroundColor:colors.primary},
  brName:{fontSize:14,fontWeight:'700',color:colors.text},
  brNameOn:{color:colors.primary},
  brAddr:{fontSize:12,color:colors.textSecondary,marginTop:1},
  branchPill:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:colors.accentLight,paddingHorizontal:12,paddingVertical:7,borderRadius:20,alignSelf:'flex-start',marginBottom:16},
  branchPillTxt:{fontSize:13,color:colors.accent},
  addrEmpty:{borderWidth:1.5,borderColor:colors.border,borderStyle:'dashed',borderRadius:18,padding:28,alignItems:'center',gap:8},
  addrEmptyIcon:{width:56,height:56,borderRadius:16,backgroundColor:colors.primaryLight,alignItems:'center',justifyContent:'center'},
  addrEmptyTitle:{fontSize:16,fontWeight:'800',color:colors.text},
  addrEmptyHint:{fontSize:13,color:colors.textSecondary,textAlign:'center'},
  addrEmptyBtn:{backgroundColor:colors.primary,borderRadius:12,paddingHorizontal:22,paddingVertical:12,marginTop:4},
  addrEmptyBtnTxt:{color:'#fff',fontWeight:'700',fontSize:14},
  savedHint:{flexDirection:'row',alignItems:'center',gap:5,marginTop:8},
  savedHintTxt:{fontSize:12,color:colors.accent},
  addrFilled:{backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.border,gap:12},
  addrFilledHdr:{flexDirection:'row',gap:12},
  addrFilledIcon:{width:36,height:36,borderRadius:10,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},
  addrLabel:{fontSize:11,color:colors.textTertiary,fontWeight:'600',marginBottom:2},
  addrMain:{fontSize:14,fontWeight:'700',color:colors.text},
  addrSub:{fontSize:12,color:colors.textSecondary,marginTop:1},
  changeAddr:{flexDirection:'row',alignItems:'center',gap:6,paddingTop:10,borderTopWidth:1,borderTopColor:colors.border},
  changeAddrTxt:{fontSize:13,color:colors.primary,fontWeight:'600'},
  toggleRow:{flexDirection:'row',gap:10,marginBottom:4},
  toggleBtn:{flex:1,borderWidth:1.5,borderColor:colors.border,borderRadius:14,padding:14,alignItems:'center',gap:4},
  toggleBtnOn:{borderColor:colors.primary,backgroundColor:colors.primaryLight},
  toggleTxt:{fontSize:15,fontWeight:'700',color:colors.text},
  toggleTxtOn:{color:colors.primary},
  toggleSub:{fontSize:11,color:colors.textTertiary},
  toggleSubOn:{color:colors.primary},
  svcGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  svcCard:{width:(width-50)/2,backgroundColor:colors.surface,borderRadius:14,padding:14,alignItems:'center',gap:6,borderWidth:1,borderColor:colors.border},
  svcCardOn:{backgroundColor:colors.primary,borderColor:colors.primary},
  svcName:{fontSize:12,fontWeight:'700',color:colors.text,textAlign:'center'},
  svcNameOn:{color:'#fff'},
  svcPrice:{fontSize:12,color:colors.textSecondary},
  svcPriceOn:{color:'rgba(255,255,255,0.8)'},
  kgRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:24,marginVertical:24},
  kgBtn:{width:52,height:52,borderRadius:26,backgroundColor:colors.primaryLight,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.primary},
  kgBtnTxt:{fontSize:24,fontWeight:'300',color:colors.primary},
  kgDisplay:{alignItems:'center'},
  kgNum:{fontSize:56,fontWeight:'900',color:colors.text,letterSpacing:-2},
  kgUnit:{fontSize:16,color:colors.textSecondary,fontWeight:'600'},
  surcharge:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:colors.warningLight,padding:10,borderRadius:10,marginBottom:12},
  surchargeTxt:{fontSize:12,color:colors.warning,fontWeight:'600'},
  kgBar:{height:6,backgroundColor:colors.border,borderRadius:3,marginVertical:16,overflow:'hidden'},
  kgFill:{height:6,borderRadius:3},
  liveCard:{backgroundColor:colors.primaryLight,borderRadius:14,padding:16,borderWidth:1,borderColor:colors.primary,alignItems:'center',gap:4},
  liveLbl:{fontSize:11,color:colors.primary,fontWeight:'700',letterSpacing:0.5},
  liveAmt:{fontSize:28,fontWeight:'900',color:colors.primary},
  liveBreak:{fontSize:12,color:colors.textSecondary},
  pillRow:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:4},
  pill:{paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:1.5,borderColor:colors.border,backgroundColor:colors.surface},
  pillOn:{borderColor:colors.primary,backgroundColor:colors.primary},
  pillTxt:{fontSize:13,fontWeight:'600',color:colors.text},
  pillTxtOn:{color:'#fff'},
  // ── Date section ───────────────────────────────────────────────────────────
  dateSection:{backgroundColor:colors.surface,borderRadius:20,padding:16,marginBottom:14,borderWidth:1,borderColor:colors.border},
  dateSectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16},
  dateSectionTitle:{fontSize:15,fontWeight:'800',color:colors.text},
  dateSectionMonth:{fontSize:13,fontWeight:'600',color:colors.textSecondary},
  weekStrip:{gap:8,paddingBottom:4,paddingHorizontal:2},
  dayChip:{alignItems:'center',justifyContent:'center',width:56,height:72,borderRadius:16,backgroundColor:colors.background,borderWidth:1.5,borderColor:colors.border,gap:4,position:'relative'},
  dayChipOn:{backgroundColor:colors.primary,borderColor:colors.primary},
  dayChipName:{fontSize:10,fontWeight:'700',color:colors.textTertiary,letterSpacing:0.5},
  dayChipNameOn:{color:'rgba(255,255,255,0.75)'},
  dayChipNum:{fontSize:22,fontWeight:'900',color:colors.text},
  dayChipNumOn:{color:'#fff'},
  todayDot:{width:5,height:5,borderRadius:3,backgroundColor:colors.accent,position:'absolute',bottom:6},
  // ── Time section ───────────────────────────────────────────────────────────
  timeSection:{backgroundColor:colors.surface,borderRadius:20,padding:16,marginBottom:14,borderWidth:1,borderColor:colors.border},
  timeStrip:{gap:10,paddingBottom:4,paddingHorizontal:2},
  timeChip:{alignItems:'center',justifyContent:'center',width:54,height:68,borderRadius:14,backgroundColor:colors.background,borderWidth:1.5,borderColor:colors.border,gap:1},
  timeChipOn:{backgroundColor:colors.primary,borderColor:colors.primary},
  timeChipOff:{opacity:0.45},
  timeChipPeriod:{fontSize:11,fontWeight:'700',color:colors.textTertiary,letterSpacing:0.5},
  timeChipPeriodOn:{color:'rgba(255,255,255,0.75)'},
  timeChipHour:{fontSize:20,fontWeight:'900',color:colors.text},
  timeChipHourOn:{color:'#fff'},
  timeChipTextOff:{color:colors.disabled},
  timeChipFull:{fontSize:9,fontWeight:'700',color:colors.disabled,marginTop:1,letterSpacing:0.3},
  slotsLoading:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:20,justifyContent:'center'},
  slotsLoadingTxt:{fontSize:13,color:colors.textSecondary},
  slotsEmpty:{alignItems:'center',paddingVertical:28,gap:8},
  slotsEmptyTitle:{fontSize:15,fontWeight:'700',color:colors.text},
  slotsEmptyHint:{fontSize:13,color:colors.textSecondary},
  rushCard:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:14,padding:16,borderWidth:1,borderColor:colors.border,marginTop:16,gap:12},
  rushTitle:{fontSize:15,fontWeight:'700',color:colors.text},
  rushSub:{fontSize:12,color:colors.textSecondary,marginTop:2},
  notesInput:{backgroundColor:colors.surface,borderRadius:12,padding:14,borderWidth:1,borderColor:colors.border,fontSize:13,color:colors.text,minHeight:80,textAlignVertical:'top',marginTop:8},
  sumRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border},
  sumKey:{fontSize:13,color:colors.textSecondary,fontWeight:'500'},
  sumVal:{fontSize:13,color:colors.text,fontWeight:'700',flex:1,textAlign:'right'},
  sumTotal:{borderBottomWidth:0,marginTop:4,paddingTop:16,borderTopWidth:2,borderTopColor:colors.primary},
  sumTotalKey:{fontSize:16,fontWeight:'900',color:colors.text},
  sumTotalVal:{fontSize:20,fontWeight:'900',color:colors.primary},
  payCard:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.surface,borderRadius:14,padding:14,marginBottom:10,borderWidth:1.5,borderColor:colors.border},
  payCardOn:{borderColor:colors.primary,backgroundColor:colors.primary},
  payName:{fontSize:14,fontWeight:'700',color:colors.text,flex:1},
  payNameOn:{color:'#fff'},
  footer:{backgroundColor:colors.surface,borderTopWidth:1,borderTopColor:colors.border,paddingHorizontal:20,paddingTop:14,gap:12},
  footerTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:colors.primaryLight,borderRadius:14,paddingHorizontal:14,paddingVertical:10},
  footerLabel:{fontSize:10,fontWeight:'700',color:colors.primary,letterSpacing:0.5,textTransform:'uppercase'},
  footerHint:{fontSize:11,color:colors.textSecondary,marginTop:1},
  footerTotal:{fontSize:22,fontWeight:'900',color:colors.primary},
  footerRow:{flexDirection:'row',gap:12},
  // Pill buttons — matching Image 3 style
  backBtn:{flex:1,paddingVertical:16,borderRadius:50,borderWidth:1.5,borderColor:colors.border,alignItems:'center',justifyContent:'center'},
  backTxt:{fontSize:16,fontWeight:'700',color:colors.text},
  contBtn:{flex:2,paddingVertical:16,borderRadius:50,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},
  contBtnOff:{opacity:0.35},
  contTxt:{fontSize:16,fontWeight:'700',color:'#fff'},
});
