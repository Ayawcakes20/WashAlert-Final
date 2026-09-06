import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  { id: 'DELIVERY',  label: 'Delivery',  hint: 'We pick up your laundry and deliver it back clean', icon: 'truck-outline',  backendServiceType: 'PICKUP_DELIVERY', needsAddress: true  },
  { id: 'PICK_UP',   label: 'Pick Up',   hint: 'Drop off your laundry at our branch and pick it up when done', icon: 'store-outline', backendServiceType: 'DROP_OFF',        needsAddress: false },
];
const DET_OPTS = [
  { id: 'none',  label: 'Customer Provided',           price: 0  },
  { id: 'surf',  label: 'Surf (Basic Det.)',            price: 25 },
  { id: 'ariel', label: 'Ariel (Premium Det.)',         price: 30 },
];
const FAB_OPTS = [
  { id: 'none',  label: 'Customer Provided',           price: 0  },
  { id: 'charm', label: 'Charm Fabcon (Basic)',         price: 15 },
  { id: 'downy', label: 'Downy (Premium)',              price: 25 },
];
const VIS_STEPS = ['Package','Location','Extras','Schedule','Payment','Confirm'];
const VIS_MAP   = { 1:1, 2:2, 3:2, 4:3, 5:4, 6:5, 7:6 };

// ── Accurate Pricing Engine ──────────────────────────────────────────────────
// Wash (7kg)=₱80 · Dry (7kg)=₱90 · Ecowash Full (5kg)=₱220
// Basic Full 7kg=₱240 · Basic Full 8kg=₱245
// Premium Full 7kg=₱270 · Premium Full 8kg=₱275
// Handwash ≤3kg → ₱150/kg ; >3kg → ₱90/kg
// Madness extra 1kg on top of 8kg → +₱50
const getServiceBasePrice = (svc, weightKg) => {
  const name = String(svc?.name || '').toLowerCase();
  if (name.includes('handwash')) {
    return weightKg <= 3 ? weightKg * 150 : weightKg * 90;
  }
  if (name.includes('dry'))          return 90;
  if (name.includes('ecowash'))      return 220;
  if (name.includes('basic full')) {
    // 7kg variant = 240, 8kg variant = 245
    return name.includes('7kg') ? 240 : 245;
  }
  if (name.includes('premium full')) {
    // 7kg variant = 270, 8kg variant = 275
    return name.includes('7kg') ? 270 : 275;
  }
  // Generic wash
  return svc?.price || 80;
};

// Madness surcharge: +₱50 for every kg over 8kg
const getMadnessSurcharge = (weightKg) => {
  if (weightKg > 8) return (weightKg - 8) * 50;
  return 0;
};

const getServicePriceLabel = (svc) => {
  const name = String(svc?.name || '').toLowerCase();
  if (name.includes('handwash'))     return '₱150/kg (≤3kg) · ₱90/kg (>3kg)';
  if (name.includes('dry'))         return '₱90 / 7kg';
  if (name.includes('ecowash'))     return '₱220 / 5kg';
  if (name.includes('basic full'))  return name.includes('7kg') ? '₱240 / 7kg' : '₱245 / 8kg';
  if (name.includes('premium full'))return name.includes('7kg') ? '₱270 / 7kg' : '₱275 / 8kg';
  return `₱${svc?.price ?? 0}`;
};

// Format slot label: "8:00 AM - 9:30 AM" → "8:00–9:30"
const fmtSlot = (label) => label;

// Remove slotPeriod - we no longer show Morning/Afternoon/Evening labels

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
  
  const Row = ({ label, value }) => (
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:4}}>
      <Text style={{color:colors.textSecondary,fontSize:13}}>{label}</Text>
      <Text style={{color:colors.textPrimary,fontSize:13,fontWeight:'600',textAlign:'right',flex:1,marginLeft:12}}>{value || '—'}</Text>
    </View>
  );
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSub]      = useState(false);
  const [checking, setChecking]   = useState(false);  // true while pre-flight supply check runs
  const [stockError, setStockError] = useState(null); // inline inventory warning on step 4
  // Two-step supply source selection: null = not chosen, 'customer' = Customer Provided, 'shop' = Laundry Shop Provided
  const [detSource, setDetSource] = useState(null); // 'customer' | 'shop' | null
  const [fabSource, setFabSource] = useState(null); // 'customer' | 'shop' | null
  // Per-addon qty map — initialised to 0 so unselected items display 0 until the
  // customer explicitly selects or taps +. Switches between items do not cross-copy.
  const [detQtyMap, setDetQtyMap] = useState({ surf: 0, ariel: 0 });
  const [fabQtyMap, setFabQtyMap] = useState({ charm: 0, downy: 0 });
  // Supply availability fetched when entering step 4. null = not yet loaded.
  const [supplyAvail, setSupplyAvail] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  // Lightweight toast state — message auto-clears after 3.5 s
  const [toastMsg, setToastMsg]   = useState('');
  const scrollRef                 = useRef(null); // ref for main ScrollView — used to reset scroll on step change
  const prevStepRef               = useRef(null); // tracks previous step so scroll only fires on a real step change
  const submittingRef             = useRef(false); // sync guard — prevents duplicate submissions even if setSub hasn't re-rendered yet
  const [branches_, setBranches]  = useState([]);
  const [services_, setServices]  = useState([]);
  const [branch, setBranch]       = useState(null);
  const [svcMode, setSvcMode]     = useState('DELIVERY');
  const [address, setAddress]     = useState(null);
  const [addrSheet, setAddrSheet] = useState(false);
  const [defAddr, setDefAddr]     = useState(null);
  const [service, setService]     = useState(null);
  const [det, setDet]             = useState('none');   // detergent option id
  const [fab, setFab]             = useState('none');   // fabcon option id
  const [schDate, setSchDate]     = useState(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; });
  const [schTime, setSchTime]     = useState(null);
  const [slots, setSlots]         = useState([]);
  const [slotsLoad, setSlotsLoad] = useState(false);
  const [rush, setRush]           = useState(false);
  const [notes, setNotes]         = useState('');
  const [payMethod, setPay]       = useState('cod');
  const [loadSize, setLoadSize]   = useState('SMALL'); // SMALL or LARGE
  const dates                     = useMemo(() => mkDates(14), []);
  const mode                      = SERVICE_MODES.find(m=>m.id===svcMode)||SERVICE_MODES[0];
  const needsAddr                 = mode.needsAddress;

  // Mirrors PricingService.computeLoadCount() — caps add-on qty per booking.
  // Returns 0 for Dry-only because drying does not use detergent or fabric conditioner.
  const computedLoadCount = useMemo(() => {
    if (!service) return 1;
    const name = (service.name || '').toLowerCase();
    if (name.includes('dry')) return 0;
    const kg = loadSize === 'LARGE' ? 8 : 5;
    if (name.includes('double')) return 2;
    if (name.includes('ecowash')) return Math.max(1, Math.ceil(kg / 5));
    if (name.includes('full') || name.includes('handwash')) return Math.max(1, Math.ceil(kg / 8));
    return 1;
  }, [service, loadSize]);

  // True when the selected service is Dry-only (no washing cycle, add-ons not applicable).
  const isDryOnly = computedLoadCount === 0;

  // Active qty for the selected addon.
  // Returns 0 if the item is out of stock (supplyAvail loaded and available=false),
  // otherwise clamps to at least 1 so the booking payload is correct.
  const detQty = (detSource === 'shop' && det !== 'none')
    ? (() => {
        const avail = supplyAvail?.detergent?.find(d => d.id === det);
        if (avail !== null && avail !== undefined && !avail.available) return 0;
        return Math.max(0, detQtyMap[det] ?? 0);
      })()
    : 0;
  const fabQty = (fabSource === 'shop' && fab !== 'none')
    ? (() => {
        const avail = supplyAvail?.conditioner?.find(c => c.id === fab);
        if (avail !== null && avail !== undefined && !avail.available) return 0;
        return Math.max(0, fabQtyMap[fab] ?? 0);
      })()
    : 0;

  // Show a floating toast for 3.5 s — clears automatically
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };


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
    if(deliveryFee>0) p.push(`Delivery ${address?.latitude&&branch?.latitude?'':'(est.) '}+₱${deliveryFee}`);
    return p.filter(Boolean).join(' · ');
  },[service,det,detQty,fab,fabQty,rush,deliveryFee,address,branch]);

  useEffect(()=>{ load(); },[]);
  useFocusEffect(useCallback(()=>{ getDefaultSavedAddress().then(setDefAddr).catch(()=>{}); },[]));
  useEffect(()=>{
    if(!branch||!schDate){ setSlots([]); setSchTime(null); return; }
    (async()=>{
      try{ setSlotsLoad(true); const raw=await bookings.getAvailableSlots(branch.name,schDate); const now=new Date(); const isToday=schDate.toDateString()===now.toDateString(); const parseSlotStart=(label)=>{const start=(label||'').split(' - ')[0].trim();const match=start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!match)return null;let h=parseInt(match[1],10);const m=parseInt(match[2],10);const period=match[3].toUpperCase();if(period==='PM'&&h!==12)h+=12;if(period==='AM'&&h===12)h=0;return{h,m};}; const s=isToday?raw.map(sl=>{ if(!sl.available) return sl; const parsed=parseSlotStart(sl.label); if(!parsed) return sl; const slotTime=new Date(); slotTime.setHours(parsed.h,parsed.m,0,0); return slotTime<=now?{...sl,available:false,pastSlot:true}:sl; }):raw; setSlots(s); const f=s.find(x=>x.available); setSchTime(p=>s.find(x=>x.label===p&&x.available)?p:(f?.label||null)); }
      catch{ setSlots([]); } finally{ setSlotsLoad(false); }
    })();
  },[branch,schDate]);

  // Load per-item supply availability when entering step 4, and clear when leaving.
  // Shows an immediate toast if some or all supplies are out of stock.
  useEffect(()=>{
    if(step!==4){ setSupplyAvail(null); return; }
    if(!branch?.name) return;
    setAvailLoading(true);
    bookings.getSuppliesAvailability(branch.name)
      .then(data=>{
        setSupplyAvail(data);
        // Clamp stored qtys to availableQty; the re-clamp effect below applies the load-count cap
        if(data?.detergent){
          setDetQtyMap(m=>{
            const next={...m};
            data.detergent.forEach(item=>{
              if(typeof item.availableQty==='number'&&(next[item.id]??0)>item.availableQty)
                next[item.id]=item.availableQty;
            });
            return next;
          });
        }
        if(data?.conditioner){
          setFabQtyMap(m=>{
            const next={...m};
            data.conditioner.forEach(item=>{
              if(typeof item.availableQty==='number'&&(next[item.id]??0)>item.availableQty)
                next[item.id]=item.availableQty;
            });
            return next;
          });
        }
        if(data?.message){
          setToastMsg(data.message);
          setTimeout(()=>setToastMsg(''),4500);
        }
      })
      .catch(()=>setSupplyAvail(null))
      .finally(()=>setAvailLoading(false));
  },[step,branch?.name]);

  // Force add-ons to None when Dry-only is selected — drying has no wash cycle
  useEffect(()=>{
    if(computedLoadCount !== 0) return;
    setDet('none');
    setFab('none');
    setDetSource(null);
    setFabSource(null);
    setDetQtyMap({ surf: 0, ariel: 0 });
    setFabQtyMap({ charm: 0, downy: 0 });
  },[computedLoadCount]);

  // NOTE: Removed auto-clamp that forced qty down to availableQty.
  // Customers are free to pick any quantity. Backend validates at booking time.

  // Scroll to top ONLY when the booking step actually changes (not on addon selection,
  // quantity tweaks, or any other state change that leaves `step` the same).
  // prevStepRef comparison prevents the initial-mount fire from triggering on re-renders
  // where step hasn't moved, which was causing the "None tap scrolls to top" bug.
  useEffect(()=>{
    if(prevStepRef.current === step) return;
    prevStepRef.current = step;
    setTimeout(()=>{ scrollRef.current?.scrollTo({ y: 0, animated: false }); }, 0);
  },[step]);

  const load = async()=>{
    try{ 
      setLoading(true); 
      const [b,s]=await Promise.all([branches.getAll(),laundry.getServices()]); 
      setBranches(b.branches||[]); 
      
      // Deduplicate services by name (prefer 8kg over 7kg if both exist)
      const raw = s.services||[];
      const unique = [];
      const seen = new Set();
      // Sort so that 8kg comes before 7kg to prioritize it in deduplication
      const sorted = [...raw].sort((x,y)=>{
        const nx=String(x.name).toLowerCase();
        const ny=String(y.name).toLowerCase();
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

      const pid=route.params?.serviceId; 
      if(pid){ const f=raw.find(x=>x.id===pid); if(f) setService(f); }
    }catch{ Alert.alert('Error','Failed to load.'); }finally{ setLoading(false); }
  };

  const ok = ()=>{
    if(step===1) return !!service;            // Package
    if(step===2) return !!branch;             // Service Type + Branch
    if(step===3) return !!address?.address;   // Address
    // Block Continue while there is a confirmed inventory error from a previous attempt.
    if(step===4) return !stockError;          // Extras
    if(step===5) return !!schTime&&!!slots.find(s=>s.label===schTime&&s.available); // Schedule
    if(step===6) return !!payMethod;          // Payment Method
    return true;
  };

  const next = async ()=>{
    if(step===1){ if(!service) return; setStep(2); }                                     // Package → Location
    else if(step===2){ if(!branch) return; setStep(needsAddr?3:4); }                    // Location → Address or Extras
    else if(step===3){ if(!address?.address){ setAddrSheet(true); return; } setStep(4); } // Address → Extras
    else if(step===4){
      // Hard gate: if a stock error was set by a previous attempt, block until selection changes.
      if(stockError){ showToast('Stock unavailable — please adjust your extras before continuing.'); return; }
      // If no extras selected, skip the network check entirely.
      if(det==='none' && fab==='none'){ setStep(5); return; }
      // Pre-flight supply availability check — keeps user on Extras if stock is insufficient.
      setChecking(true);
      try {
        await bookings.checkSupplies(
          branch?.name,
          det==='none' ? 'Customer Provided' : (DET_OPTS.find(o=>o.id===det)?.label || 'Customer Provided'),
          det==='none' ? 0 : detQty,
          fab==='none' ? 'Customer Provided' : (FAB_OPTS.find(o=>o.id===fab)?.label || 'Customer Provided'),
          fab==='none' ? 0 : fabQty
        );
        setStep(5);
      } catch(err){
        const msg = err?.message || 'Selected item is out of stock at this branch.';
        setStockError(msg);
        showToast(msg);
      } finally {
        setChecking(false);
      }
    }
    else if(step===5){ if(!ok()) return; setStep(6); }   // Schedule → Payment
    else if(step===6){ setStep(7); }                      // Payment → Confirm
    else if(step===7) confirm_();
  };
  const back = ()=>{
    if(step===1){ navigation.goBack(); return; }
    if(step===4&&!needsAddr){ setStep(2); return; }  // Extras → Location (skip Address)
    setStep(s=>s-1);
  };

  const confirm_ = async()=>{
    if(submittingRef.current) return;
    if(needsAddr&&!address?.address){ Alert.alert('Address Required','Please set an address.',[{text:'Set',onPress:()=>{setStep(3);setAddrSheet(true);}},{text:'Cancel',style:'cancel'}]); return; }
    // Check if any selected supply is out of stock; ask user to confirm or cancel.
    let submitDet = det, submitFab = fab;
    if(branch?.name && (det!=='none' || fab!=='none')){
      try{
        const avail = await bookings.getSuppliesAvailability(branch.name);
        const unavailable=[];
        if(det!=='none' && avail?.detergent?.find(d=>d.id===det)?.availableQty===0)
          unavailable.push(DET_OPTS.find(o=>o.id===det)?.label||'Detergent');
        if(fab!=='none' && avail?.conditioner?.find(c=>c.id===fab)?.availableQty===0)
          unavailable.push(FAB_OPTS.find(o=>o.id===fab)?.label||'Fabric Conditioner');
        if(unavailable.length>0){
          const choice = await new Promise(resolve=>{
            Alert.alert(
              'Supply Unavailable',
              `${unavailable.join(' and ')} is out of stock at this branch.\n\nProceed without it?`,
              [
                {text:'Cancel',style:'cancel',onPress:()=>resolve('cancel')},
                {text:'Proceed Without',style:'default',onPress:()=>resolve('proceed')},
              ],
              {cancelable:false}
            );
          });
          if(choice==='cancel') return; // Stay on review screen.
          // Override unavailable supplies to 'none' for this submission only.
          if(avail?.detergent?.find(d=>d.id===det)?.availableQty===0) submitDet='none';
          if(avail?.conditioner?.find(c=>c.id===fab)?.availableQty===0) submitFab='none';
        }
      } catch{
        // Non-fatal: proceed with original selections if check fails
      }
    }
    // Source-first override: if source is not 'shop', force none regardless of stale item state.
    if (detSource !== 'shop') submitDet = 'none';
    if (fabSource !== 'shop') submitFab = 'none';
    submittingRef.current = true;
    setSub(true);
    try{
      const dk=needsAddr&&address?.latitude&&branch?.latitude?distKm(branch.latitude,branch.longitude,address.latitude,address.longitude):0;
      const _svcPrice  = getServiceBasePrice(service, loadSize === 'LARGE' ? 8 : 5);
      const _supDet = submitDet !== 'none' ? Math.max(0, detQtyMap[submitDet] ?? 0) : 0;
      const _supFab = submitFab !== 'none' ? Math.max(0, fabQtyMap[submitFab] ?? 0) : 0;
      const _supPrice  = ((DET_OPTS.find(o=>o.id===submitDet)?.price||0) * _supDet) + ((FAB_OPTS.find(o=>o.id===submitFab)?.price||0) * _supFab);
      const _rushPrice = rush ? 150 : 0;
      const _delPrice  = needsAddr ? deliveryFee : 0;
      const r=await createOrder({
        branchId:branch.id,
        serviceId:service.id,
        serviceType:service.name,
        serviceMode:svcMode,
        serviceModeLabel:mode.label,
        serviceTypeBackend:mode.backendServiceType,
        scheduleDate:schDate,
        scheduleTime:schTime,
        detergent: (submitDet !== 'none' && _supDet > 0) ? (DET_OPTS.find(o=>o.id===submitDet)?.label || 'Customer Provided') : 'Customer Provided',
        detergentQuantity: _supDet,
        conditioner: (submitFab !== 'none' && _supFab > 0) ? (FAB_OPTS.find(o=>o.id===submitFab)?.label || 'Customer Provided') : 'Customer Provided',
        conditionerQuantity: _supFab,
        estimatedWeightKg: loadSize === 'LARGE' ? 8 : 5,
        delivery: needsAddr,
        isRush:rush,
        instructions:notes,
        paymentMethod:payMethod,
        total: total,
        serviceName:service.name,
        loadSize: loadSize, 
        distanceKm:dk,
        deliveryLatitude:address?.latitude??null,
        deliveryLongitude:address?.longitude??null,
        deliveryAddress:address?.address??null,
        deliveryUnitFloor:address?.unitFloor??null,
        deliveryContactName:address?.contactName??null,
        deliveryContactPhone:address?.phone??null,
        branchLatitude:branch?.latitude||null,
        branchLongitude:branch?.longitude||null,
        servicePrice: _svcPrice,
        suppliesPrice: _supPrice,
        rushPrice: _rushPrice,
        deliveryPrice: _delPrice 
      });
      const tn=String(r?.trackingNumber||'').trim(); if(!tn) throw new Error('No tracking number.');
      
      const successMsg = payMethod === 'gcash' 
        ? `Booking Successful!\n\nTracking #: ${tn}\n\nNote: Please wait for weighing at the branch. You will receive a notification to pay via GCash once the final price is set.`
        : `Booking Successful!\n\nTracking #: ${tn}`;

      Alert.alert('Confirmed', successMsg, [{text:'View Order',onPress:()=>{ setStep(1); navigation.navigate('Orders'); }}]);
    }catch(err){
      const rawMessage = String(err?.message || '').trim();
      const msg = rawMessage || 'Failed to place booking. Please try again.';
      const isStockError = msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('inventory') || msg.toLowerCase().includes('stock');
      if(isStockError){
        // Set inline banner AND show toast so the user gets immediate feedback
        setStockError(msg);
        showToast(msg); // toast tells the user which item failed
        setStep(4); // return to Extras (step 4) — ok() now blocks Continue until selection changes
      } else {
        const friendlyMessage =
          /internal server error/i.test(msg)
            ? 'We could not place your booking right now. Please check your details and try again in a moment.'
            : msg;
        Alert.alert('Booking Failed', friendlyMessage);
      }
    }finally{ submittingRef.current = false; setSub(false); }
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

  // Footer: running total + Back / Continue buttons
  const Footer = ()=>(
    <View style={[S.footer,{paddingBottom:insets.bottom+90}]}>
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
        <TouchableOpacity style={[S.contBtn,(!ok()||checking)&&S.contBtnOff]} onPress={next} disabled={!ok()||submitting||checking}>
          {(submitting||checking)
            ?<ActivityIndicator color="#fff" size="small"/>
            :<View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <Text style={S.contTxt}>{step===7?'Confirm Booking':'Continue'}</Text>
                {step!==7&&<Ionicons name="arrow-forward" size={16} color="#fff"/>}
              </View>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if(loading) return <View style={S.loadWrap}><ActivityIndicator size="large" color={colors.primary}/><Text style={S.loadTxt}>Loading…</Text></View>;

  return(
    <SafeAreaView style={S.container} edges={['top']}>
      <AddressPickerSheet visible={addrSheet} title="Pickup & Delivery Address" onConfirm={a=>{setAddrSheet(false);setAddress(a);if(step===3)setStep(4);}} onClose={()=>setAddrSheet(false)} initialValue={address} fallbackCoordinate={branch?.latitude?{latitude:Number(branch.latitude),longitude:Number(branch.longitude)}:null}/>
      <View style={S.hdr}><Text style={S.hdrTitle}>New Booking</Text><Text style={S.hdrSub}>Step {vis} of {VIS_STEPS.length}</Text></View>
      <Stepper/>
      <ScrollView ref={scrollRef} style={{flex:1}} contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {step===2&&(
          <View>
            <Text style={S.q}>{"Let's start your booking"}</Text>
            <Text style={S.hint}>Select how you want the service and choose a branch near you.</Text>
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

        {step===3&&(
          <View>
            <Text style={S.q}>What is your address?</Text>
            <Text style={S.hint}>We will pick up your laundry from here and deliver it back clean.</Text>
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

        {step===1&&(
          <View>
            <Text style={S.q}>Choose a package</Text>
            <Text style={S.hint}>Select the laundry package that fits your needs.</Text>

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

            {/* Service inclusions — shown when a service is selected */}
            {service && (()=>{
              const n = (service.name||'').toLowerCase();
              let inclusions = [];
              if(n.includes('premium full'))     inclusions = ['Machine wash','Machine dry','Folding','Fabric conditioner included','Priority processing'];
              else if(n.includes('basic full'))  inclusions = ['Machine wash','Machine dry','Folding'];
              else if(n.includes('ecowash'))     inclusions = ['Eco-friendly wash cycle','Machine dry','Folding'];
              else if(n.includes('handwash'))    inclusions = ['Hand wash (gentle on delicates)','Air dry recommended'];
              else if(n.includes('dry'))         inclusions = ['Machine dry only','No washing included'];
              else                               inclusions = ['Machine wash','Folding'];
              return inclusions.length>0?(
                <View style={{backgroundColor:'#F0FDF4',borderRadius:14,padding:14,borderWidth:1,borderColor:'#BBF7D0',marginTop:4}}>
                  <Text style={{fontSize:12,fontWeight:'800',color:'#166534',marginBottom:8,letterSpacing:0.3}}>{"WHAT'S INCLUDED"}</Text>
                  {inclusions.map((item,i)=>(
                    <View key={i} style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:5}}>
                      <Ionicons name="checkmark-circle" size={15} color="#16A34A"/>
                      <Text style={{fontSize:13,color:'#166534'}}>{item}</Text>
                    </View>
                  ))}
                </View>
              ):null;
            })()}

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

            {/* ── Dry-only notice ── add-ons are not applicable for drying-only orders ── */}
            {isDryOnly && (
              <View style={{backgroundColor:'#FEF9C3',borderRadius:12,padding:14,borderWidth:1,borderColor:'#FDE047',flexDirection:'row',alignItems:'flex-start',gap:10}}>
                <Ionicons name="information-circle" size={18} color="#CA8A04" style={{marginTop:1}}/>
                <Text style={{flex:1,fontSize:13,color:'#78350F',lineHeight:18}}>
                  Add-ons are not needed for Dry-only service. Detergent and fabric conditioner have been cleared.
                </Text>
              </View>
            )}

            {/* ── Inventory Stock Error ── shown when booking failed due to insufficient stock ── */}
            {stockError && (
              <View style={{backgroundColor:'#FEF2F2',borderRadius:12,padding:14,borderWidth:1,borderColor:'#FECACA',flexDirection:'row',alignItems:'flex-start',gap:10}}>
                <Ionicons name="warning" size={18} color="#DC2626" style={{marginTop:1}}/>
                <View style={{flex:1}}>
                  <Text style={{fontSize:13,fontWeight:'700',color:'#DC2626',marginBottom:3}}>Insufficient Stock</Text>
                  <Text style={{fontSize:12,color:'#7F1D1D',lineHeight:18}}>{stockError}</Text>
                  <Text style={{fontSize:11,color:'#B91C1C',marginTop:6}}>Please adjust your selection or try a different option.</Text>
                </View>
              </View>
            )}

            {/* ── Premium Pricing Info Card ── */}
            <View style={S.pricingInfoCard}>
              <View style={S.pricingInfoContent}>
                <View style={S.pricingInfoIcon}>
                  <Ionicons name="information-circle" size={20} color={colors.primary}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={S.pricingInfoTitle}>Transparent Pricing</Text>
                  <Text style={S.pricingInfoText}>
                    Laundry is weighed at the branch. You will be notified of the <Text style={{fontWeight:'700',color:colors.primary}}>final number of loads and final amount</Text> before washing begins.
                  </Text>
                </View>
              </View>
            </View>

            {/* ── DETERGENT — Two-step: first choose source, then choose item ── */}
            <Text style={S.sec}>Detergent</Text>
            {availLoading&&<ActivityIndicator size="small" color={colors.primary} style={{alignSelf:'flex-start',marginBottom:8}}/>}

            {/* Step 1: source selection */}
            <View style={{flexDirection:'row',gap:10,marginBottom:8}}>
              {[{id:'customer',label:'Customer Provided'},{id:'shop',label:'Laundry Shop Provided'}].map(src=>{
                const isSrc = detSource===src.id;
                return (
                  <TouchableOpacity
                    key={src.id}
                    style={{flex:1,paddingVertical:14,paddingHorizontal:12,borderRadius:14,borderWidth:1.5,
                      borderColor:isSrc?colors.primary:colors.border,
                      backgroundColor:isSrc?colors.primaryLight:colors.surface,
                      opacity:isDryOnly&&src.id==='shop'?0.4:1,
                      alignItems:'center'}}
                    onPress={()=>{
                      if(isDryOnly&&src.id==='shop'){ showToast('Add-ons are not needed for Dry-only service.'); return; }
                      setDetSource(src.id);
                      if(src.id==='customer'){
                        setDet('none');
                        setDetQtyMap({ surf: 0, ariel: 0 });
                      } else {
                        if(det==='none') {
                          const detItems = ['surf','ariel'];
                          const firstInStock = detItems.find(id => {
                            const a = supplyAvail?.detergent?.find(d => d.id === id);
                            return !a || a.available;
                          });
                          if(firstInStock) {
                            setDet(firstInStock);
                          }
                        }
                      }
                      setStockError(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={isSrc?'checkmark-circle':'radio-button-off'} size={18} color={isSrc?colors.primary:colors.textSecondary} style={{marginBottom:4}}/>
                    <Text style={{fontSize:13,fontWeight:'700',color:isSrc?colors.primary:colors.text,textAlign:'center'}}>{src.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Step 2: shop item selection (only when source = shop) */}
            {detSource==='shop' && DET_OPTS.filter(o=>o.id!=='none').map(o=>{
              const isSel  = det === o.id;
              const avail  = supplyAvail?.detergent?.find(d=>d.id===o.id);
              const isOut  = avail !== null && avail !== undefined && !avail.available;
              const displayQty = detQtyMap[o.id] ?? 0;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[{flexDirection:'row',alignItems:'center',minHeight:66,backgroundColor:colors.surface,borderRadius:14,marginBottom:8,borderWidth:1.5,borderColor:isSel?colors.primary:colors.border},
                    isSel&&{backgroundColor:colors.primaryLight},
                    isOut&&{opacity:0.6}]}
                  onPress={()=>{
                    if(isOut){ showToast(`${o.label} is currently out of stock at this branch.`); return; }
                    setDet(o.id);
                    setDetQtyMap(m => ({ ...m, [o.id]: (m[o.id] && m[o.id] > 0) ? m[o.id] : 1 }));
                    setStockError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{flex:1,paddingVertical:14,paddingLeft:14}}>
                    <Text style={{fontSize:14,fontWeight:'700',color:isSel?colors.primary:colors.text}}>{o.label}</Text>
                    {!isOut&&<Text style={{fontSize:12,color:colors.textSecondary,marginTop:2}}>₱{o.price} per sachet</Text>}
                    {isOut&&<Text style={{fontSize:11,fontWeight:'700',color:'#DC2626',marginTop:2}}>Out of stock</Text>}
                  </View>
                  <View style={{flexDirection:'row',alignItems:'center',paddingRight:12,gap:6}}>
                    <TouchableOpacity
                      onPress={()=>{
                        if(isOut){ showToast(`${o.label} is out of stock.`); return; }
                        setDet(o.id);
                        setDetQtyMap(m=>({...m,[o.id]:Math.max(0,(m[o.id]??0)-1)}));
                        setStockError(null);
                      }}
                      disabled={isOut || displayQty <= 0}
                      style={{width:28,height:28,borderRadius:14,backgroundColor:(isOut || displayQty <= 0)?'#D1D5DB':colors.primary,alignItems:'center',justifyContent:'center'}}
                    >
                      <Text style={{color:(isOut || displayQty <= 0)?'#9CA3AF':'#fff',fontSize:16,fontWeight:'700',lineHeight:20}}>-</Text>
                    </TouchableOpacity>
                    <Text style={{fontSize:14,fontWeight:'800',color:isSel?colors.text:'#9CA3AF',minWidth:22,textAlign:'center'}}>{displayQty}</Text>
                    <TouchableOpacity
                      onPress={()=>{
                        if(isOut){ showToast(`${o.label} is currently out of stock at this branch.`); return; }
                        setDet(o.id);
                        setDetQtyMap(m=>({...m,[o.id]:(m[o.id]??0)+1}));
                        setStockError(null);
                      }}
                      style={{width:28,height:28,borderRadius:14,backgroundColor:isOut?'#D1D5DB':colors.primary,alignItems:'center',justifyContent:'center'}}
                    >
                      <Text style={{color:isOut?'#9CA3AF':'#fff',fontSize:16,fontWeight:'700',lineHeight:20}}>+</Text>
                    </TouchableOpacity>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{opacity:isSel && displayQty > 0?1:0,marginLeft:4}}/>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* ── FABRIC CONDITIONER — same two-step pattern ── */}
            <Text style={S.sec}>Fabric Conditioner</Text>

            <View style={{flexDirection:'row',gap:10,marginBottom:8}}>
              {[{id:'customer',label:'Customer Provided'},{id:'shop',label:'Laundry Shop Provided'}].map(src=>{
                const isSrc = fabSource===src.id;
                return (
                  <TouchableOpacity
                    key={src.id}
                    style={{flex:1,paddingVertical:14,paddingHorizontal:12,borderRadius:14,borderWidth:1.5,
                      borderColor:isSrc?colors.primary:colors.border,
                      backgroundColor:isSrc?colors.primaryLight:colors.surface,
                      opacity:isDryOnly&&src.id==='shop'?0.4:1,
                      alignItems:'center'}}
                    onPress={()=>{
                      if(isDryOnly&&src.id==='shop'){ showToast('Add-ons are not needed for Dry-only service.'); return; }
                      setFabSource(src.id);
                      if(src.id==='customer'){
                        setFab('none');
                        setFabQtyMap({ charm: 0, downy: 0 });
                      } else {
                        if(fab==='none') {
                          const fabItems = ['charm','downy'];
                          const firstInStock = fabItems.find(id => {
                            const a = supplyAvail?.conditioner?.find(c => c.id === id);
                            return !a || a.available;
                          });
                          if(firstInStock) {
                            setFab(firstInStock);
                          }
                        }
                      }
                      setStockError(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={isSrc?'checkmark-circle':'radio-button-off'} size={18} color={isSrc?colors.primary:colors.textSecondary} style={{marginBottom:4}}/>
                    <Text style={{fontSize:13,fontWeight:'700',color:isSrc?colors.primary:colors.text,textAlign:'center'}}>{src.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {fabSource==='shop' && FAB_OPTS.filter(o=>o.id!=='none').map(o=>{
              const isSel  = fab === o.id;
              const avail  = supplyAvail?.conditioner?.find(c=>c.id===o.id);
              const isOut  = avail !== null && avail !== undefined && !avail.available;
              const displayQty = fabQtyMap[o.id] ?? 0;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[{flexDirection:'row',alignItems:'center',minHeight:66,backgroundColor:colors.surface,borderRadius:14,marginBottom:8,borderWidth:1.5,borderColor:isSel?colors.primary:colors.border},
                    isSel&&{backgroundColor:colors.primaryLight},
                    isOut&&{opacity:0.6}]}
                  onPress={()=>{
                    if(isOut){ showToast(`${o.label} is currently out of stock at this branch.`); return; }
                    setFab(o.id);
                    setFabQtyMap(m => ({ ...m, [o.id]: (m[o.id] && m[o.id] > 0) ? m[o.id] : 1 }));
                    setStockError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{flex:1,paddingVertical:14,paddingLeft:14}}>
                    <Text style={{fontSize:14,fontWeight:'700',color:isSel?colors.primary:colors.text}}>{o.label}</Text>
                    {!isOut&&<Text style={{fontSize:12,color:colors.textSecondary,marginTop:2}}>₱{o.price} per sachet</Text>}
                    {isOut&&<Text style={{fontSize:11,fontWeight:'700',color:'#DC2626',marginTop:2}}>Out of stock</Text>}
                  </View>
                  <View style={{flexDirection:'row',alignItems:'center',paddingRight:12,gap:6}}>
                    <TouchableOpacity
                      onPress={()=>{
                        if(isOut){ showToast(`${o.label} is out of stock.`); return; }
                        setFab(o.id);
                        setFabQtyMap(m=>({...m,[o.id]:Math.max(0,(m[o.id]??0)-1)}));
                        setStockError(null);
                      }}
                      disabled={isOut || displayQty <= 0}
                      style={{width:28,height:28,borderRadius:14,backgroundColor:(isOut || displayQty <= 0)?'#D1D5DB':colors.primary,alignItems:'center',justifyContent:'center'}}
                    >
                      <Text style={{color:(isOut || displayQty <= 0)?'#9CA3AF':'#fff',fontSize:16,fontWeight:'700',lineHeight:20}}>-</Text>
                    </TouchableOpacity>
                    <Text style={{fontSize:14,fontWeight:'800',color:isSel?colors.text:'#9CA3AF',minWidth:22,textAlign:'center'}}>{displayQty}</Text>
                    <TouchableOpacity
                      onPress={()=>{
                        if(isOut){ showToast(`${o.label} is currently out of stock at this branch.`); return; }
                        setFab(o.id);
                        setFabQtyMap(m=>({...m,[o.id]:(m[o.id]??0)+1}));
                        setStockError(null);
                      }}
                      style={{width:28,height:28,borderRadius:14,backgroundColor:isOut?'#D1D5DB':colors.primary,alignItems:'center',justifyContent:'center'}}
                    >
                      <Text style={{color:isOut?'#9CA3AF':'#fff',fontSize:16,fontWeight:'700',lineHeight:20}}>+</Text>
                    </TouchableOpacity>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{opacity:isSel && displayQty > 0?1:0,marginLeft:4}}/>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Availability notice — below both card groups so it never shifts card layout */}
            {!stockError && (det !== 'none' || fab !== 'none') && (
              <View style={{backgroundColor:'#EFF6FF',borderRadius:10,padding:10,flexDirection:'row',alignItems:'center',gap:8}}>
                <Ionicons name="information-circle-outline" size={15} color="#3B82F6"/>
                <Text style={{fontSize:11,color:'#1D4ED8',flex:1}}>Selected items are subject to branch stock availability.</Text>
              </View>
            )}

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
            
            {/* ── DATE ── */}
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

            {/* ── TIME SLOT ── */}
            <View style={S.timeSection}>
              <Text style={S.sectionLabel}>TIME SLOT</Text>
              {slotsLoad ? (
                <View style={S.slotsLoading}><ActivityIndicator color={colors.primary}/><Text style={S.slotsLoadingTxt}>Checking availability…</Text></View>
              ) : slots.length === 0 ? (
                <View style={S.slotsEmpty}><Ionicons name="calendar-outline" size={28} color={colors.border}/><Text style={S.slotsEmptyTitle}>No slots available</Text><Text style={S.slotsEmptyHint}>Try a different date.</Text></View>
              ) : (
                <View style={S.timeGrid}>
                  {slots.map(sl=>{
                    const sel=schTime===sl.label;
                    return(
                      <TouchableOpacity key={sl.label} style={[S.timeItem,sel&&S.timeItemOn,!sl.available&&S.timeItemOff]} onPress={()=>sl.available&&setSchTime(sl.label)} disabled={!sl.available} activeOpacity={0.8}>
                        <Text style={[S.timeItemTime,sel&&S.timeItemTimeOn,!sl.available&&S.timeItemTextOff]}>{fmtSlot(sl.label)}</Text>
                        {!sl.available&&<Text style={[S.timeItemPeriod,S.timeItemTextOff]}>{sl.pastSlot?'Past':'Full'}</Text>}
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
            <Text style={S.q}>Payment Method</Text>
            <Text style={S.hint}>Choose how you will pay for your laundry service.</Text>

            {/* COD - available */}
            <TouchableOpacity style={[S.payCard,payMethod==='cod'&&S.payCardOn]} onPress={()=>setPay('cod')}>
              <MaterialCommunityIcons name="cash" size={22} color={payMethod==='cod'?'#fff':colors.primary}/>
              <View style={{flex:1}}>
                <Text style={[S.payName,payMethod==='cod'&&S.payNameOn]}>Cash on Delivery / Pick Up</Text>
                <Text style={{fontSize:11,color:payMethod==='cod'?'rgba(255,255,255,0.7)':colors.textSecondary}}>Pay when your laundry is delivered or at the branch</Text>
              </View>
              {payMethod==='cod'&&<Ionicons name="checkmark-circle" size={18} color="#fff"/>}
            </TouchableOpacity>

            {/* GCash payment option */}
            <TouchableOpacity style={[S.payCard,payMethod==='gcash'&&S.payCardOn]} onPress={()=>setPay('gcash')} activeOpacity={0.8}>
              <MaterialCommunityIcons name="cellphone-wireless" size={22} color={payMethod==='gcash'?'#fff':colors.primary}/>
              <View style={{flex:1}}>
                <Text style={[S.payName,payMethod==='gcash'&&S.payNameOn]}>GCash / QRPh</Text>
                <Text style={{fontSize:11,color:payMethod==='gcash'?'rgba(255,255,255,0.7)':colors.textSecondary}}>Pay via GCash QR code once the branch confirms your final price</Text>
              </View>
              {payMethod==='gcash'&&<Ionicons name="checkmark-circle" size={18} color="#fff"/>}
            </TouchableOpacity>
          </View>
        )}

        {step===7&&(
          <View style={{gap:16}}>
            <Text style={S.q}>Review & Confirm</Text>
            <Text style={S.hint}>Check your booking before submitting. Final price will be confirmed at the branch.</Text>
            
            {/* ── Section 1: LAUNDRY SERVICES ── */}
            <View style={S.summarySection}>
              <View style={S.summaryHeader}>
                <Ionicons name="shirt-outline" size={14} color={colors.primary}/>
                <Text style={S.summaryTitle}>LAUNDRY SERVICES</Text>
              </View>
              <Row label="Package" value={service?.name}/>
              <Row label="Load Size" value={loadSize === 'SMALL' ? 'Small (~7kg)' : 'Large (8-10kg)'}/>
            </View>

            {/* ── Section 2: EXTRAS ── */}
            <View style={S.summarySection}>
              <View style={S.summaryHeader}>
                <Ionicons name="sparkles-outline" size={14} color={colors.primary}/>
                <Text style={S.summaryTitle}>EXTRAS</Text>
              </View>
              <Row label="Detergent" value={det==='none'||detQty===0?'Customer Provided':`${detOpt?.label} x${detQty} (₱${detCost})`}/>
              <Row label="Fabric Conditioner" value={fab==='none'||fabQty===0?'Customer Provided':`${fabOpt?.label} x${fabQty} (₱${fabCost})`}/>
              {rush && <Row label="Rush Service" value="Yes (+₱150)"/>}
            </View>

            {/* ── Section 3: LOGISTICS ── */}
            <View style={S.summarySection}>
              <View style={S.summaryHeader}>
                <Ionicons name="bus-outline" size={14} color={colors.primary}/>
                <Text style={S.summaryTitle}>LOGISTICS</Text>
              </View>
              <Row label="Branch" value={branch?.name}/>
              <Row label="Schedule" value={`${schDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${schTime}`}/>
              {needsAddr && <Row label="Address" value={address?.address}/>}
              {needsAddr && <Row label="Delivery Fee" value={`₱${deliveryFee}`}/>}
            </View>

            {/* Estimated total */}
            <View style={[S.sumRow,S.sumTotal]}>
              <View>
                <Text style={S.sumTotalKey}>Estimated Total</Text>
                <Text style={{fontSize:10, color:colors.textTertiary, fontWeight:'700', textTransform:'uppercase', marginTop:2}}>Subject to change after weighing</Text>
              </View>
              <Text style={[S.sumTotalVal,{color:colors.textSecondary, opacity:0.6}]}>₱{total.toLocaleString()}</Text>
            </View>
            
            <View style={S.pricingInfoCard}>
              <Ionicons name="information-circle-outline" size={14} color="#2563EB"/>
              <Text style={[S.pricingInfoText,{flex:1}]}>Final amount confirmed after weighing at branch. You will receive a notification to approve before washing begins.</Text>
            </View>

            {/* Payment Method — read-only summary (selected on previous step) */}
            <View style={S.summarySection}>
              <View style={S.summaryHeader}>
                <Ionicons name="cash-outline" size={14} color={colors.primary}/>
                <Text style={S.summaryTitle}>PAYMENT</Text>
              </View>
              <Row label="Method" value={payMethod==='cod'?'Cash on Delivery / Pick Up':'GCash'}/>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Floating toast — auto-dismisses after 3.5 s; shown for stock errors and gate blocks */}
      {!!toastMsg && (
        <View pointerEvents="none" style={{position:'absolute',bottom:120,left:20,right:20,zIndex:999,backgroundColor:'rgba(20,20,20,0.88)',borderRadius:14,paddingHorizontal:18,paddingVertical:14,shadowColor:'#000',shadowOpacity:0.25,shadowRadius:8,elevation:8}}>
          <Text style={{color:'#fff',fontSize:13,fontWeight:'600',textAlign:'center',lineHeight:20}}>{toastMsg}</Text>
        </View>
      )}

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
  // Pricing info card - premium glassmorphism style
  pricingInfoCard:{backgroundColor:'rgba(37,99,235,0.06)',borderRadius:16,padding:16,borderWidth:1,borderColor:'rgba(37,99,235,0.15)',flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:4},
  pricingInfoContent:{flexDirection:'row',gap:12},
  pricingInfoIcon:{width:36,height:36,borderRadius:12,backgroundColor:'rgba(37,99,235,0.1)',alignItems:'center',justifyContent:'center'},
  pricingInfoTitle:{fontSize:14,fontWeight:'800',color:'#1E3A8A',marginBottom:2},
  pricingInfoText:{fontSize:13,color:'#1E3A8A',lineHeight:20},
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
  // ── Section label (all caps) ─────────────────────────────────────────────────
  sectionLabel:{fontSize:11,fontWeight:'700',color:colors.textTertiary,letterSpacing:1.2,textTransform:'uppercase',marginBottom:12},
  // ── Beddings toggle ───────────────────────────────────────────────────
  beddingsCard:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:14,padding:14,borderWidth:1,borderColor:colors.border,marginBottom:16,gap:12},
  beddingsIconWrap:{width:38,height:38,borderRadius:12,backgroundColor:colors.primaryLight,alignItems:'center',justifyContent:'center'},
  beddingsTitle:{fontSize:14,fontWeight:'700',color:colors.text},
  beddingsSub:{fontSize:12,color:colors.textSecondary,marginTop:2},
  // ── Weight card ───────────────────────────────────────────────────────────
  weightCard:{backgroundColor:colors.surface,borderRadius:16,padding:20,borderWidth:1,borderColor:colors.border},
  weightCardHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},
  maxKgBadge:{paddingHorizontal:12,paddingVertical:5,borderRadius:100},
  maxKgBadgeTxt:{fontSize:12,fontWeight:'700'},
  kgBarLabels:{flexDirection:'row',justifyContent:'space-between',marginTop:6},
  kgBarLbl:{fontSize:11,color:colors.textTertiary,fontWeight:'500'},
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
  loadSizeCard:{flex:1,backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1.5,borderColor:colors.border,gap:4},
  loadSizeCardOn:{backgroundColor:colors.primary,borderColor:colors.primary},
  loadSizeName:{fontSize:14,fontWeight:'700',color:colors.text},
  loadSizeNameOn:{color:'#fff'},
  loadSizeHint:{fontSize:12,color:colors.textSecondary},
  loadSizeHintOn:{color:'rgba(255,255,255,0.8)'},
  kgSelector:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:24,marginVertical:16,backgroundColor:colors.surface,padding:20,borderRadius:20,borderWidth:1,borderColor:colors.border},
  kgBtn:{width:50,height:50,borderRadius:25,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center',shadowColor:colors.primary,shadowOffset:{width:0,height:4},shadowOpacity:0.3,shadowRadius:8,elevation:4},
  kgDisplay:{alignItems:'center',minWidth:90},
  kgVal:{fontSize:48,fontWeight:'900',color:colors.text,lineHeight:54},
  kgUnit:{fontSize:14,color:colors.textSecondary,fontWeight:'800',marginTop:-4},
  kgHint:{fontSize:12,color:colors.textTertiary,textAlign:'center',fontStyle:'italic'},
  surcharge:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:colors.warningLight,padding:10,borderRadius:10,marginBottom:12},
  surchargeTxt:{fontSize:12,color:colors.warning,fontWeight:'600'},
  kgBar:{height:6,backgroundColor:colors.border,borderRadius:3,marginVertical:16,overflow:'hidden'},
  kgFill:{height:6,borderRadius:3},
  liveCard:{backgroundColor:colors.surface,borderRadius:16,padding:18,borderWidth:1,borderColor:colors.border,gap:6},
  liveLbl:{fontSize:11,color:colors.primary,fontWeight:'700',letterSpacing:0.5,marginBottom:4},
  liveRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  liveKey:{fontSize:13,color:colors.textSecondary,flex:1},
  liveVal:{fontSize:13,fontWeight:'700',color:colors.text},
  liveAmt:{fontSize:22,fontWeight:'900',color:colors.primary},
  liveDivider:{height:1,backgroundColor:colors.border,marginVertical:4},
  liveTotalAmt:{fontSize:22,fontWeight:'900',color:colors.text},
  liveBreak:{fontSize:12,color:colors.textSecondary},
  pillRow:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:4},
  pill:{paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:1.5,borderColor:colors.border,backgroundColor:colors.surface},
  pillOn:{borderColor:colors.primary,backgroundColor:colors.primary},
  pillTxt:{fontSize:13,fontWeight:'600',color:colors.text},
  pillTxtOn:{color:'#fff'},
  // ── Date section ───────────────────────────────────────────────────────────
  dateSection:{backgroundColor:colors.surface,borderRadius:16,padding:16,marginBottom:0,borderWidth:1,borderColor:colors.border},
  dateSectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},
  dateSectionTitle:{fontSize:15,fontWeight:'800',color:colors.text},
  dateSectionMonth:{fontSize:13,fontWeight:'600',color:colors.textSecondary},
  weekStrip:{gap:8,paddingBottom:4,paddingHorizontal:2},
  dayChip:{alignItems:'center',justifyContent:'center',width:58,height:72,borderRadius:14,backgroundColor:colors.background,borderWidth:1.5,borderColor:colors.border,gap:4},
  dayChipOn:{backgroundColor:colors.text,borderColor:colors.text},
  dayChipToday:{borderColor:colors.primary,borderWidth:2},
  dayChipName:{fontSize:10,fontWeight:'700',color:colors.textTertiary,letterSpacing:0.5},
  dayChipNameOn:{color:'rgba(255,255,255,0.65)'},
  dayChipNum:{fontSize:24,fontWeight:'900',color:colors.text},
  dayChipNumOn:{color:'#fff'},
  todayDot:{width:5,height:5,borderRadius:3,backgroundColor:colors.accent,position:'absolute',bottom:6},
  // ── Time grid (2-col with period labels) ─────────────────────────────────
  timeSection:{backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.border},
  timeGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:12},
  timeItem:{width:'47%',backgroundColor:colors.background,borderRadius:12,padding:14,borderWidth:1.5,borderColor:colors.border},
  timeItemOn:{backgroundColor:colors.text,borderColor:colors.text},
  timeItemOff:{opacity:0.45},
  timeItemTime:{fontSize:15,fontWeight:'800',color:colors.text,letterSpacing:-0.5},
  timeItemTimeOn:{color:'#fff'},
  timeItemPeriod:{fontSize:12,color:colors.textSecondary,marginTop:3},
  timeItemPeriodOn:{color:'rgba(255,255,255,0.65)'},
  timeItemTextOff:{color:colors.disabled},
  timeItemLabel:{fontSize:13,fontWeight:'700',color:colors.text,flex:1},
  timeItemLabelOn:{color:'#fff'},
  timeItemLabelOff:{color:colors.disabled},
  timeItemFull:{fontSize:10,fontWeight:'700',color:colors.disabled},
  slotsLoading:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:20,justifyContent:'center'},
  slotsLoadingTxt:{fontSize:13,color:colors.textSecondary},
  slotsEmpty:{alignItems:'center',paddingVertical:28,gap:8},
  slotsEmptyTitle:{fontSize:15,fontWeight:'700',color:colors.text},
  slotsEmptyHint:{fontSize:13,color:colors.textSecondary},
  rushCard:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.border,gap:12},
  rushTitle:{fontSize:16,fontWeight:'800',color:colors.text},
  rushSub:{fontSize:13,color:colors.textSecondary},
  rushBadge:{alignSelf:'flex-start',backgroundColor:'#FFF3E0',paddingHorizontal:10,paddingVertical:4,borderRadius:100,marginTop:4},
  rushBadgeTxt:{fontSize:12,fontWeight:'700',color:'#E65100'},
  notesInput:{backgroundColor:colors.surface,borderRadius:12,padding:14,borderWidth:1,borderColor:colors.border,fontSize:13,color:colors.text,minHeight:80,textAlignVertical:'top',marginTop:8},
  sumRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border},
  sumKey:{fontSize:13,color:colors.textSecondary,fontWeight:'500'},
  sumVal:{fontSize:13,color:colors.text,fontWeight:'700',flex:1,textAlign:'right'},
  sumTotal:{borderBottomWidth:0,marginTop:4,paddingTop:16,borderTopWidth:2,borderTopColor:colors.primary},
  sumTotalKey:{fontSize:16,fontWeight:'900',color:colors.text},
  sumTotalVal:{fontSize:20,fontWeight:'900',color:colors.primary},
  payCard:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.surface,borderRadius:14,padding:14,marginBottom:10,borderWidth:1.5,borderColor:colors.border},
  payCardOn:{borderColor:colors.primary,backgroundColor:colors.primary},
  payName:{fontSize:14,fontWeight:'700',color:colors.text,flex:1,flexShrink:1},
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
  summarySection:{backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.border,gap:2},
  summaryHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8,borderBottomWidth:1,borderBottomColor:colors.border,paddingBottom:8},
  summaryTitle:{fontSize:12,fontWeight:'800',color:colors.primary,letterSpacing:0.5},
});
