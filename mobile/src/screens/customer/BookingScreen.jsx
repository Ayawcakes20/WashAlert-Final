import React, { useState, useEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors } from '../../theme/colors';
import { Card, Button } from '../../components';
import { branches, bookings, laundry, createOrder, estimatePrice, payments } from '../../services/api';
import { GOOGLE_MAPS_API_KEY } from '../../config/env';
import { getDefaultSavedAddress } from '../../services/savedAddresses';
import AddressPickerSheet from '../../components/AddressPickerSheet';

const { width } = Dimensions.get('window');

// ─── Constants ───────────────────────────────────────────────────────────────

const SERVICE_MODES = [
  {
    id: 'FULL_SERVICE',
    label: 'Full Service',
    hint: 'Pickup → Laundry → Delivery back to you',
    icon: 'washing-machine',
    backendServiceType: 'PICKUP_DELIVERY',
    needsAddress: true,
  },
  {
    id: 'DROP_OFF_ONLY',
    label: 'Drop-off Only',
    hint: 'You bring & pick up at the branch',
    icon: 'store-outline',
    backendServiceType: 'DROP_OFF',
    needsAddress: false,
  },
  {
    id: 'PICKUP_ONLY',
    label: 'Pickup Only',
    hint: 'We pick up — you get at branch',
    icon: 'truck-outline',
    backendServiceType: 'PICKUP_DELIVERY',
    needsAddress: true,
  },
];

const SERVICE_ICON_BY_ID = {
  wash: 'washing-machine',
  dry: 'tumble-dryer',
  'ecowash-full': 'leaf',
  'basic-full-7': 'tshirt-crew-outline',
  'basic-full-8': 'tshirt-crew-outline',
  'premium-full-7': 'star-four-points-outline',
  'premium-full-8': 'star-four-points-outline',
  handwash: 'hand-wash',
};

const STEP_LABELS = ['Branch', 'Address', 'Schedule', 'Prefs', 'Pay', 'Confirm'];
const DEFAULT_MAX_LOAD_KG = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDateChipLabel = (date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const formatDateSummary = (date) =>
  date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const createDateOptions = (days = 7) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() + idx);
    return date;
  });
};

const resolveServiceIcon = (service = {}) => {
  const byId = SERVICE_ICON_BY_ID[String(service.id || '').toLowerCase()];
  if (byId) return byId;
  const byName = String(service.name || '').toLowerCase();
  if (byName.includes('dry')) return 'tumble-dryer';
  if (byName.includes('handwash')) return 'hand-wash';
  if (byName.includes('premium')) return 'star-four-points-outline';
  if (byName.includes('wash')) return 'washing-machine';
  return 'washing-machine';
};

const resolveServiceMaxLoadKg = (service) => {
  const serviceName = String(service?.name || '');
  const match = serviceName.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (match?.[1]) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_MAX_LOAD_KG;
};

const normalizeCheckoutUrl = (payload) => {
  const candidate = payload?.checkout_url || payload?.checkoutUrl || payload?.url || payload || null;
  if (!candidate) return null;
  return String(candidate).trim();
};

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const toFiniteCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const resolveBranchFallbackCoordinate = (branch) => {
  const latitude = toFiniteCoordinate(branch?.latitude);
  const longitude = toFiniteCoordinate(branch?.longitude);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
};

// ─── Component ───────────────────────────────────────────────────────────────

const BookingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const preSelectedServiceId = route.params?.serviceId;

  // ── Step (1–6) ─────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ── API data ───────────────────────────────────────────────────────────
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [availableDetergents, setAvailableDetergents] = useState([]);
  const [availableConditioners, setAvailableConditioners] = useState([]);

  // ── Step 1: Branch & service ───────────────────────────────────────────
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceMode, setServiceMode] = useState('FULL_SERVICE');

  // ── Step 2: Address ────────────────────────────────────────────────────
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  // deliveryAddress shape: { address, unitFloor, contactName, phone, latitude, longitude, label }

  // ── Step 3: Schedule ───────────────────────────────────────────────────
  const [scheduleDate, setScheduleDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [scheduleTime, setScheduleTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState('');

  // ── Step 4: Preferences ────────────────────────────────────────────────
  const [loadKg, setLoadKg] = useState('5');
  const [loadKgError, setLoadKgError] = useState('');
  const [selectedDetergent, setSelectedDetergent] = useState('None');
  const [selectedConditioner, setSelectedConditioner] = useState('None');
  const [isRush, setIsRush] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // ── Step 5: Payment ────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState('gcash');

  // ── Price  ─────────────────────────────────────────────────────────────
  const [priceDetails, setPriceDetails] = useState({ deliveryPrice: 0, totalPrice: 0 });

  // ── Default saved address (for auto-fill hint) ─────────────────────────
  const [defaultSavedAddress, setDefaultSavedAddress] = useState(null);

  const dateOptions = createDateOptions(7);
  const selectedServiceMode = SERVICE_MODES.find((m) => m.id === serviceMode) || SERVICE_MODES[0];
  const serviceModeNeedsAddress = selectedServiceMode.needsAddress;
  const branchFallbackCoordinate = React.useMemo(
    () => resolveBranchFallbackCoordinate(selectedBranch),
    [selectedBranch]
  );
  const selectedServiceMaxLoadKg = resolveServiceMaxLoadKg(selectedService);
  const selectedSlot = availableSlots.find((slot) => slot.label === scheduleTime) || null;
  const isSelectedSlotAvailable = Boolean(selectedSlot?.available);

  const sanitizeLoadKgInput = (value) => {
    const cleaned = String(value || '').replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot < 0) return cleaned;
    return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
  };

  const validateLoadKgInput = (showAlert = false) => {
    const parsedKg = Number.parseFloat(loadKg);
    let message = '';
    if (!Number.isFinite(parsedKg) || parsedKg <= 0) {
      message = 'Please enter a valid load size in kilograms.';
    } else if (parsedKg > selectedServiceMaxLoadKg) {
      message = `Maximum load for this service is ${selectedServiceMaxLoadKg}kg.`;
    }

    setLoadKgError(message);
    if (message && showAlert) {
      Alert.alert('Invalid Load Size', message);
    }
    return !message;
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.info(`GOOGLE MAPS KEY LOADED: ${GOOGLE_MAPS_API_KEY ? 'YES' : 'NO'}`);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      getDefaultSavedAddress().then(setDefaultSavedAddress).catch(() => setDefaultSavedAddress(null));
    }, [])
  );

  useEffect(() => {
    if (selectedService && loadKg) void handleEstimate();
  }, [selectedService, loadKg, isRush, selectedDetergent, selectedConditioner, deliveryAddress, selectedBranch]);

  useEffect(() => {
    void validateLoadKgInput(false);
  }, [loadKg, selectedServiceMaxLoadKg]);

  useEffect(() => {
    if (!serviceModeNeedsAddress) setDeliveryAddress(null);
  }, [serviceModeNeedsAddress]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedBranch || !scheduleDate) {
        setAvailableSlots([]);
        setScheduleTime(null);
        return;
      }
      try {
        setSlotsLoading(true);
        setSlotError('');
        const slots = await bookings.getAvailableSlots(selectedBranch.name, scheduleDate);
        setAvailableSlots(slots);
        if (!slots.find((s) => s.label === scheduleTime && s.available)) {
          const firstOpen = slots.find((s) => s.available);
          setScheduleTime(firstOpen?.label || null);
        }
      } catch (error) {
        setAvailableSlots([]);
        setScheduleTime(null);
        setSlotError('Unable to load slots for this date. Please try again.');
      } finally {
        setSlotsLoading(false);
      }
    };
    void loadSlots();
  }, [selectedBranch, scheduleDate]);

  // ── Data loaders ───────────────────────────────────────────────────────
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [branchesRes, servicesRes, prefsRes] = await Promise.all([
        branches.getAll(),
        laundry.getServices(),
        laundry.getPreferences(),
      ]);
      setAvailableBranches(branchesRes.branches || []);
      setAvailableServices(servicesRes.services || []);
      setAvailableDetergents(prefsRes.detergents || []);
      setAvailableConditioners(prefsRes.conditioners || []);
      if (preSelectedServiceId) {
        const found = servicesRes.services.find((s) => s.id === preSelectedServiceId);
        if (found) setSelectedService(found);
      }
    } catch {
      Alert.alert('Error', 'Failed to load services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Price estimation ───────────────────────────────────────────────────
  const handleEstimate = async () => {
    try {
      let computedDistance = 0;
      if (serviceModeNeedsAddress && deliveryAddress?.latitude && selectedBranch?.latitude) {
        computedDistance = getDistanceFromLatLonInKm(
          selectedBranch.latitude,
          selectedBranch.longitude,
          deliveryAddress.latitude,
          deliveryAddress.longitude
        );
      } else if (serviceModeNeedsAddress) {
        computedDistance = selectedBranch?.distance || 0;
      }
      const estimation = await estimatePrice({
        branch: selectedBranch?.name || 'Main',
        serviceName: selectedService?.name,
        weightKg: parseFloat(loadKg) || 0,
        isRush,
        detergent: selectedDetergent,
        fabcon: selectedConditioner,
        distanceKm: computedDistance,
      });
      setPriceDetails({ ...estimation, calculatedDistance: computedDistance });
    } catch {
      // silent
    }
  };

  // ── Navigation guards ──────────────────────────────────────────────────

  /**
   * Step 1 → 2:  Branch + service must be selected.
   * For address-needing modes, Step 2 shows address picker.
   * For DROP_OFF, no address needed → skip to Step 3.
   */
  const handleStep1Continue = () => {
    if (!selectedBranch || !selectedService) return;
    if (serviceModeNeedsAddress) {
      setStep(2); // show address step
    } else {
      setStep(3); // skip address for drop-off
    }
  };

  /**
   * Step 2 → 3: Address must be set.
   * Opens address sheet if missing.
   */
  const handleStep2Continue = () => {
    if (!deliveryAddress?.address) {
      setAddressSheetVisible(true);
      return;
    }
    setStep(3);
  };

  const handleAddressConfirmed = (addr) => {
    setAddressSheetVisible(false);
    setDeliveryAddress(addr);
  };

  const handleStep3Continue = () => {
    if (!scheduleTime || !isSelectedSlotAvailable) {
      Alert.alert('Schedule Unavailable', 'Please choose an available time slot before continuing.');
      return;
    }
    setStep(4);
  };

  const handleStep4Continue = () => {
    if (!validateLoadKgInput(true)) return;
    setStep(5);
  };

  // ── Booking confirm ────────────────────────────────────────────────────
  const handleConfirmBooking = async () => {
    if (serviceModeNeedsAddress && !deliveryAddress?.address) {
      Alert.alert('Address Required', 'Please set a pickup/delivery address before placing your booking.', [
        { text: 'Set Address', onPress: () => { setStep(2); setAddressSheetVisible(true); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!scheduleTime || !isSelectedSlotAvailable) {
      Alert.alert('Time Slot Full', 'The selected time slot is no longer available. Please pick another slot.');
      setStep(3);
      return;
    }
    if (!validateLoadKgInput(true)) {
      setStep(4);
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        branchId: selectedBranch.id,
        serviceId: selectedService.id,
        serviceType: selectedService.name,
        serviceMode,
        serviceModeLabel: selectedServiceMode.label,
        serviceTypeBackend: selectedServiceMode.backendServiceType,
        scheduleDate,
        scheduleTime,
        loadKg: parseFloat(loadKg),
        detergent: selectedDetergent,
        conditioner: selectedConditioner,
        delivery: serviceModeNeedsAddress,
        isRush,
        instructions: specialInstructions,
        paymentMethod,
        total: priceDetails.totalPrice,
        serviceName: selectedService.name,
        distanceKm: priceDetails.calculatedDistance || 0,
        // Address fields — all from deliveryAddress obj
        deliveryLatitude: deliveryAddress?.latitude ?? null,
        deliveryLongitude: deliveryAddress?.longitude ?? null,
        deliveryAddress: deliveryAddress?.address ?? null,
        deliveryUnitFloor: deliveryAddress?.unitFloor ?? null,
        deliveryContactName: deliveryAddress?.contactName ?? null,
        deliveryContactPhone: deliveryAddress?.phone ?? null,
        branchLatitude: selectedBranch?.latitude || null,
        branchLongitude: selectedBranch?.longitude || null,
      };

      const result = await createOrder(orderData);
      const trackingNumber = String(result?.trackingNumber || '').trim();
      if (!trackingNumber) throw new Error('Booking created without a tracking number.');

      if (paymentMethod === 'gcash') {
        try {
          const checkoutPayload = await payments.initiateGcashCheckout(trackingNumber);
          const checkoutUrl = normalizeCheckoutUrl(checkoutPayload);
          if (!checkoutUrl || !/^https?:\/\//i.test(checkoutUrl)) {
            throw new Error('Missing checkout URL from backend payment response.');
          }
          try {
            await WebBrowser.openBrowserAsync(checkoutUrl);
          } catch {
            const canOpen = await Linking.canOpenURL(checkoutUrl);
            if (canOpen) await Linking.openURL(checkoutUrl);
          }
        } catch (payError) {
          Alert.alert(
            'Payment Error',
            'Booking was created but we could not open the payment gateway. Go to Orders to pay.',
            [{ text: 'OK', onPress: () => navigation.navigate('Orders') }]
          );
          return;
        }
      }

      Alert.alert(
        '🧺 Booking Confirmed!',
        `Tracking #: ${trackingNumber}\n\nWe'll pick up from:\n${deliveryAddress?.address || 'your drop-off location'}`,
        [{ text: 'View Order', onPress: () => { setStep(1); navigation.navigate('Orders'); } }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to place booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading services…</Text>
      </View>
    );
  }

  // ── Step indicator ─────────────────────────────────────────────────────
  const renderStepIndicator = () => (
    <View style={styles.indicatorContainer}>
      {STEP_LABELS.map((label, i) => {
        const active = step >= i + 1;
        const done = step > i + 1;
        return (
          <View key={label} style={styles.indicatorItem}>
            <View style={[styles.indicatorCircle, active ? styles.indicatorActive : styles.indicatorInactive]}>
              {done
                ? <Ionicons name="checkmark" size={12} color="#FFF" />
                : <Text style={[styles.indicatorText, active && styles.indicatorTextActive]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.indicatorLabel, active && styles.indicatorLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Address Picker Modal */}
      <AddressPickerSheet
        visible={addressSheetVisible}
        title={serviceMode === 'PICKUP_ONLY' ? 'Set Pickup Address' : 'Set Pickup & Delivery Address'}
        onConfirm={handleAddressConfirmed}
        onClose={() => setAddressSheetVisible(false)}
        initialValue={deliveryAddress}
        fallbackCoordinate={branchFallbackCoordinate}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 150 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Header */}
        <View style={styles.bookingHeader}>
          <View>
            <Text style={styles.screenTitle}>New Booking</Text>
            <Text style={styles.screenSubtitle}>Step {step} of {STEP_LABELS.length}</Text>
          </View>
          <View style={styles.stepCountChip}>
            <Text style={styles.stepCountText}>{step}/{STEP_LABELS.length}</Text>
          </View>
        </View>
        {renderStepIndicator()}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1 — Branch & Service
        ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <View style={styles.stepContent}>
            {/* Service Mode */}
            <Text style={styles.sectionTitle}>How can we help?</Text>
            <View style={styles.modeGrid}>
              {SERVICE_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.modeCard, serviceMode === mode.id && styles.modeCardActive]}
                  onPress={() => setServiceMode(mode.id)}
                >
                  <View style={styles.modeCardLeft}>
                    <View style={[styles.modeIconBox, serviceMode === mode.id && styles.modeIconBoxActive]}>
                      <MaterialCommunityIcons
                        name={mode.icon}
                        size={20}
                        color={serviceMode === mode.id ? '#FFF' : colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modeTitle, serviceMode === mode.id && styles.modeTitleActive]}>
                        {mode.label}
                      </Text>
                      <Text style={[styles.modeHint, serviceMode === mode.id && styles.modeHintActive]}>
                        {mode.hint}
                      </Text>
                    </View>
                  </View>
                  {serviceMode === mode.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Branch */}
            <Text style={styles.sectionTitle}>Select Branch</Text>
            <View style={styles.branchGrid}>
              {availableBranches.map((branch) => (
                <TouchableOpacity
                  key={branch.id}
                  style={[styles.branchCard, selectedBranch?.id === branch.id && styles.selectedCard]}
                  onPress={() => setSelectedBranch(branch)}
                >
                  <View style={[styles.branchIconBox, selectedBranch?.id === branch.id && styles.branchIconBoxActive]}>
                    <Ionicons
                      name="storefront-outline"
                      size={18}
                      color={selectedBranch?.id === branch.id ? '#FFF' : colors.primary}
                    />
                  </View>
                  <View style={styles.branchInfo}>
                    <Text style={[styles.branchName, selectedBranch?.id === branch.id && styles.branchNameActive]}>
                      {branch.name}
                    </Text>
                    <Text style={styles.branchAddress} numberOfLines={1}>
                      {branch.address}
                    </Text>
                  </View>
                  {selectedBranch?.id === branch.id && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Service / Package */}
            <Text style={styles.sectionTitle}>Laundry Package</Text>
            <View style={styles.serviceGrid}>
              {availableServices.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceCard, selectedService?.id === service.id && styles.selectedServiceCard]}
                  onPress={() => setSelectedService(service)}
                >
                  <MaterialCommunityIcons
                    name={resolveServiceIcon(service)}
                    size={28}
                    color={selectedService?.id === service.id ? '#FFF' : colors.primary}
                  />
                  <Text style={[styles.serviceName, selectedService?.id === service.id && styles.selectedCardText]}>
                    {service.name}
                  </Text>
                  <Text style={[styles.servicePrice, selectedService?.id === service.id && styles.selectedCardPrice]}>
                    ₱{service.price}/kg
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Continue"
              onPress={handleStep1Continue}
              disabled={!selectedBranch || !selectedService}
              style={styles.nextButton}
            />
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2 — Address (only shown if service mode needs it)
        ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>
              {serviceMode === 'PICKUP_ONLY' ? 'Where should we pick up?' : 'Pickup & Delivery Address'}
            </Text>
            <Text style={styles.addressStepHint}>
              {serviceMode === 'FULL_SERVICE'
                ? "We'll pick up your laundry here and deliver it back clean to the same address."
                : "We'll come pick up your laundry from this address."}
            </Text>

            {/* Branch context pill */}
            <View style={styles.branchContextPill}>
              <Ionicons name="storefront-outline" size={14} color={colors.accent} />
              <Text style={styles.branchContextText}>
                Processing at: <Text style={{ fontWeight: '700' }}>{selectedBranch?.name}</Text>
              </Text>
            </View>

            {/* Address card — empty or filled */}
            {!deliveryAddress ? (
              <TouchableOpacity
                style={styles.addressEmptyCard}
                onPress={() => setAddressSheetVisible(true)}
                activeOpacity={0.75}
              >
                <View style={styles.addressEmptyIconBox}>
                  <Ionicons name="location-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.addressEmptyTitle}>Set Your Address</Text>
                <Text style={styles.addressEmptyHint}>
                  Search, use GPS, pin on map, or pick from saved addresses
                </Text>
                <View style={styles.addressEmptyBtn}>
                  <Text style={styles.addressEmptyBtnText}>Choose Address</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFF" />
                </View>

                {/* Quick hint for saved address */}
                {defaultSavedAddress && (
                  <View style={styles.savedHintBanner}>
                    <Ionicons name="bookmark-outline" size={13} color={colors.accent} />
                    <Text style={styles.savedHintText} numberOfLines={1}>
                      Saved: {defaultSavedAddress.label} — {defaultSavedAddress.address}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.addressFilledCard}>
                <View style={styles.addressFilledHeader}>
                  <View style={styles.addressFilledIconBox}>
                    <Ionicons name="location" size={18} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressFilledLabel}>{deliveryAddress.label || 'Delivery Address'}</Text>
                    <Text style={styles.addressFilledMain}>{deliveryAddress.address}</Text>
                    {deliveryAddress.unitFloor
                      ? <Text style={styles.addressFilledSub}>{deliveryAddress.unitFloor}</Text>
                      : null}
                    {deliveryAddress.contactName
                      ? (
                        <Text style={styles.addressFilledSub}>
                          {deliveryAddress.contactName}
                          {deliveryAddress.phone ? `  ·  ${deliveryAddress.phone}` : ''}
                        </Text>
                      ) : null}
                  </View>
                </View>

                {/* Service mode flow reminder */}
                {serviceMode === 'FULL_SERVICE' && (
                  <View style={styles.flowIndicator}>
                    <View style={styles.flowStep}>
                      <Ionicons name="home" size={12} color={colors.primary} />
                      <Text style={styles.flowText}>Your Address</Text>
                    </View>
                    <View style={styles.flowArrow}>
                      <Ionicons name="arrow-forward" size={12} color={colors.textTertiary} />
                    </View>
                    <View style={styles.flowStep}>
                      <Ionicons name="storefront-outline" size={12} color={colors.accent} />
                      <Text style={styles.flowText}>{selectedBranch?.name || 'Branch'}</Text>
                    </View>
                    <View style={styles.flowArrow}>
                      <Ionicons name="arrow-forward" size={12} color={colors.textTertiary} />
                    </View>
                    <View style={styles.flowStep}>
                      <Ionicons name="home" size={12} color={colors.primary} />
                      <Text style={styles.flowText}>Back to You</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.changeAddressBtn}
                  onPress={() => setAddressSheetVisible(true)}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                  <Text style={styles.changeAddressBtnText}>Change Address</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(1)} style={styles.halfButton} />
              <Button
                title="Continue"
                onPress={handleStep2Continue}
                disabled={!deliveryAddress}
                style={styles.halfButton}
              />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3 — Schedule
        ══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <View style={styles.stepContent}>
            {/* ── Premium calendar header ── */}
            <View style={styles.calendarHeader}>
              <View>
                <Text style={styles.calendarMonthLabel}>
                  {scheduleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <Text style={styles.calendarDayLabel}>
                  {scheduleDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}
                </Text>
              </View>
              <View style={styles.calendarBadge}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              </View>
            </View>

            {/* ── Week strip: day name + date circle ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekStrip}
            >
              {dateOptions.map((dateOption) => {
                const isSelected = scheduleDate.toDateString() === dateOption.toDateString();
                const isToday = new Date().toDateString() === dateOption.toDateString();
                const dayName = dateOption.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = dateOption.getDate();
                return (
                  <TouchableOpacity
                    key={dateOption.toISOString()}
                    style={styles.dayColumn}
                    onPress={() => setScheduleDate(dateOption)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{dayName}</Text>
                    <View style={[
                      styles.dayCircle,
                      isSelected && styles.dayCircleActive,
                    ]}>
                      <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{dayNum}</Text>
                    </View>
                    {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotActive]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Time slots ── */}
            <Text style={styles.sectionTitle}>Available Time Slots</Text>
            {slotsLoading ? (
              <View style={styles.slotLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.slotLoadingText}>Loading available slots…</Text>
              </View>
            ) : null}
            {!!slotError && !slotsLoading ? <Text style={styles.errorText}>{slotError}</Text> : null}
            <View style={styles.timeGrid2Col}>
              {availableSlots.map((slot) => {
                const isTimeSelected = scheduleTime === slot.label;
                const isSlotAvailable = slot.available !== false;
                return (
                  <TouchableOpacity
                    key={`${slot.slotStartTime}-${slot.slotEndTime}`}
                    style={[
                      styles.timeCard2,
                      isTimeSelected && styles.selectedTimeCard2,
                      !isSlotAvailable && styles.timeCardUnavailable,
                    ]}
                    onPress={() => {
                      if (!isSlotAvailable) return;
                      setScheduleTime(slot.label);
                    }}
                    disabled={!isSlotAvailable}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={isTimeSelected ? '#FFF' : isSlotAvailable ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.timeText2, isTimeSelected && styles.selectedTimeText2, !isSlotAvailable && styles.timeTextUnavailable]}>
                      {slot.label}
                    </Text>
                    {!isSlotAvailable ? <Text style={styles.slotTagUnavailable}>Full</Text> : null}
                    {isTimeSelected && isSlotAvailable && (
                      <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {!slotsLoading && !!availableSlots.length && !availableSlots.some((slot) => slot.available) ? (
              <View style={styles.noSlotBox}>
                <Ionicons name="alert-circle-outline" size={32} color={colors.warning} />
                <Text style={styles.slotHintText}>All slots are currently full.</Text>
                <Text style={styles.slotHintSub}>Please pick another day above.</Text>
              </View>
            ) : null}
            {!slotsLoading && !availableSlots.length ? (
              <View style={styles.noSlotBox}>
                <Ionicons name="calendar-clear-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.slotHintText}>No open slots for this date.</Text>
                <Text style={styles.slotHintSub}>Please pick another day above.</Text>
              </View>
            ) : null}

            <View style={styles.buttonRow}>
              <Button
                title="Back"
                variant="ghost"
                onPress={() => (serviceModeNeedsAddress ? setStep(2) : setStep(1))}
                style={styles.halfButton}
              />
              <Button
                title="Continue"
                onPress={handleStep3Continue}
                disabled={!scheduleTime || !isSelectedSlotAvailable || slotsLoading}
                style={styles.halfButton}
              />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 4 — Preferences (load, detergent, conditioner, rush)
        ══════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Load Size (kg)</Text>
            <View style={styles.kgInputContainer}>
              <TextInput
                style={styles.kgInput}
                keyboardType="numeric"
                value={loadKg}
                onChangeText={(value) => setLoadKg(sanitizeLoadKgInput(value))}
                onBlur={() => validateLoadKgInput(false)}
                placeholder="0"
              />
              <Text style={styles.kgUnit}>kg</Text>
            </View>
            <Text style={styles.kgTip}>Maximum load for this service: {selectedServiceMaxLoadKg}kg.</Text>
            {!!loadKgError ? <Text style={styles.errorText}>{loadKgError}</Text> : null}

            <Text style={styles.sectionTitle}>Detergent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {availableDetergents.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pill, selectedDetergent === d && styles.pillActive]}
                  onPress={() => setSelectedDetergent(d)}
                >
                  <Text style={[styles.pillText, selectedDetergent === d && styles.pillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Fabric Conditioner</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {availableConditioners.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, selectedConditioner === c && styles.pillActive]}
                  onPress={() => setSelectedConditioner(c)}
                >
                  <Text style={[styles.pillText, selectedConditioner === c && styles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.deliveryToggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Rush Service?</Text>
                <Text style={styles.toggleSub}>₱150.00 additional fee applies.</Text>
              </View>
              <TouchableOpacity onPress={() => setIsRush(!isRush)} style={[styles.toggleSwitch, isRush && styles.toggleSwitchActive]}>
                <View style={[styles.toggleCircle, isRush && styles.toggleCircleActive]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              placeholder="e.g. Separate whites, use delicate mode…"
            />

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(3)} style={styles.halfButton} />
              <Button title="Continue" onPress={handleStep4Continue} style={styles.halfButton} />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 5 — Payment Method
        ══════════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Choose Payment Method</Text>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === 'gcash' && styles.selectedPaymentCard]}
              onPress={() => setPaymentMethod('gcash')}
            >
              <View style={styles.paymentLeft}>
                <View style={[styles.paymentIconBox, { backgroundColor: '#EBF5FF' }]}>
                  <Ionicons name="card-outline" size={24} color="#1D4ED8" />
                </View>
                <View>
                  <Text style={styles.paymentName}>GCash</Text>
                  <Text style={styles.paymentDesc}>Pay instantly via GCash</Text>
                </View>
              </View>
              {paymentMethod === 'gcash' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === 'cash' && styles.selectedPaymentCard]}
              onPress={() => setPaymentMethod('cash')}
            >
              <View style={styles.paymentLeft}>
                <View style={[styles.paymentIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="cash-outline" size={24} color="#15803D" />
                </View>
                <View>
                  <Text style={styles.paymentName}>Cash on Pickup</Text>
                  <Text style={styles.paymentDesc}>Pay at branch or to rider</Text>
                </View>
              </View>
              {paymentMethod === 'cash' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(4)} style={styles.halfButton} />
              <Button title="Review Order" onPress={() => setStep(6)} style={styles.halfButton} />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 6 — Review & Confirm
        ══════════════════════════════════════════════════════════════════ */}
        {step === 6 && (
          <View style={styles.stepContent}>
            <Card style={styles.receiptCard}>
              <Text style={styles.receiptHeader}>Order Summary</Text>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Branch</Text>
                <Text style={styles.receiptValue}>{selectedBranch?.name}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Service Mode</Text>
                <Text style={styles.receiptValue}>{selectedServiceMode.label}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Package</Text>
                <Text style={styles.receiptValue}>{selectedService?.name}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Schedule</Text>
                <Text style={styles.receiptValue}>{formatDateSummary(scheduleDate)} | {scheduleTime}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Load Size</Text>
                <Text style={styles.receiptValue}>{loadKg} kg</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Preferences</Text>
                <Text style={styles.receiptValue}>{selectedDetergent}, {selectedConditioner}</Text>
              </View>

              {/* Address summary */}
              {serviceModeNeedsAddress && deliveryAddress && (
                <>
                  <View style={styles.receiptDivider} />
                  <View style={styles.receiptAddressBlock}>
                    <View style={styles.receiptAddressHeader}>
                      <Ionicons name="location" size={13} color={colors.primary} />
                      <Text style={styles.receiptAddressTitle}>
                        {serviceMode === 'FULL_SERVICE' ? 'Pickup & Delivery' : 'Pickup'} Address
                      </Text>
                    </View>
                    <Text style={styles.receiptAddressMain}>{deliveryAddress.address}</Text>
                    {deliveryAddress.unitFloor
                      ? <Text style={styles.receiptAddressSub}>{deliveryAddress.unitFloor}</Text>
                      : null}
                    {deliveryAddress.contactName
                      ? <Text style={styles.receiptAddressSub}>Contact: {deliveryAddress.contactName}{deliveryAddress.phone ? `  ·  ${deliveryAddress.phone}` : ''}</Text>
                      : null}

                    {/* Flow: your address → branch → your address */}
                    {serviceMode === 'FULL_SERVICE' && (
                      <View style={[styles.flowIndicator, { marginTop: 10 }]}>
                        <View style={styles.flowStep}>
                          <Ionicons name="home" size={11} color={colors.primary} />
                          <Text style={styles.flowText}>You</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={10} color={colors.textTertiary} />
                        <View style={styles.flowStep}>
                          <Ionicons name="storefront-outline" size={11} color={colors.accent} />
                          <Text style={styles.flowText}>{selectedBranch?.name}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={10} color={colors.textTertiary} />
                        <View style={styles.flowStep}>
                          <Ionicons name="home" size={11} color={colors.primary} />
                          <Text style={styles.flowText}>You</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}

              <View style={styles.receiptDivider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Service Fee</Text>
                <Text style={styles.receiptValue}>₱{priceDetails.servicePrice?.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Supplies</Text>
                <Text style={styles.receiptValue}>₱{priceDetails.suppliesPrice?.toFixed(2)}</Text>
              </View>
              {serviceModeNeedsAddress && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Delivery Fee</Text>
                  <Text style={styles.receiptValue}>₱{priceDetails.deliveryPrice?.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.receiptDivider} />

              <View style={styles.receiptTotalRow}>
                <Text style={styles.totalLabel}>Grand Total</Text>
                <Text style={styles.totalValue}>₱{(priceDetails.totalPrice || 0).toFixed(2)}</Text>
              </View>

              <View style={styles.paymentInfoRow}>
                <Text style={styles.payInfoLabel}>Payment Method:</Text>
                <Text style={styles.payInfoValue}>{paymentMethod === 'gcash' ? 'GCash' : 'Cash on Pickup'}</Text>
              </View>
            </Card>

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(5)} style={styles.halfButton} />
              <Button
                title={submitting ? 'Processing…' : 'Place Booking'}
                onPress={handleConfirmBooking}
                disabled={submitting}
                style={styles.halfButton}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  bookingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },
  stepCountChip: {
    backgroundColor: colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  stepCountText: { fontSize: 13, fontWeight: '800', color: colors.primary },

  // ── Indicator ────────────────────────────────────────────────────────────
  indicatorContainer: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 32, paddingHorizontal: 4,
  },
  indicatorItem: { alignItems: 'center', flex: 1 },
  indicatorCircle: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  indicatorActive: { backgroundColor: colors.primary },
  indicatorInactive: { backgroundColor: colors.border },
  indicatorText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  indicatorTextActive: { color: '#FFF' },
  indicatorLabel: { fontSize: 8, fontWeight: '600', color: colors.textTertiary },
  indicatorLabelActive: { color: colors.primary },

  stepContent: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 12 },

  // ── Mode cards ───────────────────────────────────────────────────────────
  modeGrid: { gap: 10 },
  modeCard: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card, padding: 14, gap: 12,
  },
  modeCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  modeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  modeIconBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  modeIconBoxActive: { backgroundColor: colors.primary },
  modeTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  modeTitleActive: { color: colors.primary },
  modeHint: { marginTop: 3, fontSize: 12, color: colors.textSecondary },
  modeHintActive: { color: colors.primary },

  // ── Branch ───────────────────────────────────────────────────────────────
  branchGrid: { gap: 12 },
  branchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  selectedCard: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  branchIconBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  branchIconBoxActive: { backgroundColor: colors.primary },
  branchInfo: { flex: 1 },
  branchName: { fontSize: 14, fontWeight: '700', color: colors.text },
  branchNameActive: { color: colors.primary },
  branchAddress: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // ── Service grid ─────────────────────────────────────────────────────────
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceCard: {
    width: (width - 52) / 2, padding: 20, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  selectedServiceCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  serviceName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 4 },
  servicePrice: { fontSize: 12, fontWeight: '800', color: colors.accent },
  selectedCardText: { color: '#FFF' },
  selectedCardPrice: { color: colors.accentLight },

  nextButton: { marginTop: 32 },

  // ── Address (Step 2) ─────────────────────────────────────────────────────
  addressStepHint: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  branchContextPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accentLight, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  branchContextText: { fontSize: 12, color: colors.accentDark, fontWeight: '600' },

  addressEmptyCard: {
    marginTop: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    backgroundColor: colors.surface, padding: 28,
    alignItems: 'center', gap: 8,
  },
  addressEmptyIconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  addressEmptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  addressEmptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  addressEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24, marginTop: 8,
  },
  addressEmptyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  savedHintBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accentLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, marginTop: 8,
    width: '100%',
  },
  savedHintText: { fontSize: 12, color: colors.accentDark, fontWeight: '600', flex: 1 },

  addressFilledCard: {
    marginTop: 8, borderRadius: 18,
    borderWidth: 1.5, borderColor: colors.primary + '40',
    backgroundColor: colors.surface, padding: 16, gap: 12,
  },
  addressFilledHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  addressFilledIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  addressFilledLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  addressFilledMain: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20, marginTop: 2 },
  addressFilledSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Flow indicator (Customer → Branch → Customer)
  flowIndicator: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceVariant, borderRadius: 10,
    padding: 10, gap: 6, flexWrap: 'nowrap',
  },
  flowStep: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flowArrow: {},
  flowText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },

  changeAddressBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: colors.background,
  },
  changeAddressBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // ── Schedule — Premium Calendar ─────────────────────────────────────────
  calendarHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, marginTop: 8,
  },
  calendarMonthLabel: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  calendarDayLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },
  calendarBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  weekStrip: { flexDirection: 'row', gap: 8, paddingVertical: 8, marginBottom: 8 },
  dayColumn: { alignItems: 'center', gap: 6, width: 52 },
  dayName: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNameActive: { color: colors.primary },
  dayCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  dayNum: { fontSize: 16, fontWeight: '700', color: colors.text },
  dayNumActive: { color: '#FFF' },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  todayDotActive: { backgroundColor: '#FFF' },
  slotLoadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  slotLoadingText: { fontSize: 12, color: colors.textSecondary },
  timeGrid2Col: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  timeCard2: {
    width: (width - 60) / 2,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  selectedTimeCard2: {
    backgroundColor: colors.primary, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  timeCardUnavailable: { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.7 },
  timeText2: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
  selectedTimeText2: { color: '#FFF' },
  timeTextUnavailable: { color: colors.textSecondary },
  slotTagUnavailable: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    backgroundColor: `${colors.warning}1A`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  noSlotBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  slotHintText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  slotHintSub: { fontSize: 12, color: colors.textTertiary },

  // ── Preferences ──────────────────────────────────────────────────────────
  kgInputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 20, height: 60,
  },
  kgInput: { flex: 1, fontSize: 24, fontWeight: '800', color: colors.text },
  kgUnit: { fontSize: 18, fontWeight: '700', color: colors.textTertiary },
  kgTip: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  pillScroll: { flexDirection: 'row', marginBottom: 8 },
  pill: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: 10,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#FFF' },
  deliveryToggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(22, 189, 202, 0.05)', padding: 20,
    borderRadius: 20, marginTop: 20, borderWidth: 1, borderColor: 'rgba(22, 189, 202, 0.2)',
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  toggleSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  toggleSwitch: { width: 52, height: 30, borderRadius: 15, backgroundColor: colors.border, padding: 2 },
  toggleSwitchActive: { backgroundColor: colors.accent },
  toggleCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF' },
  toggleCircleActive: { transform: [{ translateX: 22 }] },
  textArea: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 16, height: 100, fontSize: 14, color: colors.text, textAlignVertical: 'top',
  },

  // ── Payment ───────────────────────────────────────────────────────────────
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderRadius: 20, backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 16,
  },
  selectedPaymentCard: { borderColor: colors.primary, backgroundColor: 'rgba(26, 86, 219, 0.02)' },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  paymentIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  paymentName: { fontSize: 16, fontWeight: '700', color: colors.text },
  paymentDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // ── Receipt / Confirm ─────────────────────────────────────────────────────
  receiptCard: {
    padding: 24, borderRadius: 24, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  receiptHeader: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 24 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  receiptLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  receiptValue: { fontSize: 13, color: colors.text, fontWeight: '700', textAlign: 'right', maxWidth: '60%' },
  receiptDivider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  receiptAddressBlock: { gap: 4, marginBottom: 4 },
  receiptAddressHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  receiptAddressTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  receiptAddressMain: { fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 18 },
  receiptAddressSub: { fontSize: 12, color: colors.textSecondary },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 24, fontWeight: '900', color: colors.primary },
  paymentInfoRow: {
    backgroundColor: colors.background, padding: 12, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  payInfoLabel: { fontSize: 12, color: colors.textSecondary },
  payInfoValue: { fontSize: 12, fontWeight: '700', color: colors.text },

  // ── Shared ────────────────────────────────────────────────────────────────
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  halfButton: { flex: 1 },
  errorText: { fontSize: 12, color: colors.error, fontWeight: '600' },
});

export default BookingScreen;
