/**
 * DeliveryDetailScreen — WashAlert Driver App
 *
 * Architecture: Full-screen dark Google Maps with overlay header + ETA strip
 * + Bottom Sheet state machine panel (Grab/Lalamove style).
 *
 * State Machine Flow:
 *   Phase A (Inbound):  accepted → at_customer → picked_up → at_branch → handed_over
 *   Phase B (Outbound): ready_for_dispatch → en_route → at_delivery → completed
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
  Linking,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Animated as RNAnimated,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MapView, Marker, PROVIDER_GOOGLE, MapViewDirections } from '../../components/SafeMap';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { deliveries as deliveriesApi } from '../../services/api';
import { GOOGLE_MAPS_API_KEY } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import SwipeSlider from '../../components/SwipeSlider';
import PhotoProofCapture from '../../components/PhotoProofCapture';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_RATIO = 0.24;
const SHEET_EXPANDED_RATIO = 0.74;
const SHEET_ACTION_BAR_HEIGHT = 92;
const TRACKABLE_STATUSES = ['accepted', 'at_customer', 'picked_up', 'at_branch', 'en_route', 'at_delivery'];
const GPS_MIN_UPDATE_INTERVAL_MS = 3000;
const GPS_MIN_MOVE_METERS = 8;
const GPS_BACKEND_SYNC_INTERVAL_MS = 10000;
const GPS_BACKEND_MIN_MOVE_METERS = 15;
const GPS_JUMP_GUARD_METERS = 1200;
const GPS_JUMP_GUARD_INTERVAL_MS = 10000;

// ─── Google Maps Dark / Night Style ──────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
  { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

// ─── Metro Manila fallback (map never blank) ──────────────────────────────────
const METRO_MANILA = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const toRadians = (value) => (value * Math.PI) / 180;

const distanceMeters = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// ─── State Machine Config ─────────────────────────────────────────────────────
const STATE_CONFIG = {
  // Phase A
  accepted:           { statusLabel: 'Heading to Pickup',    destination: 'customer', phase: 'A', routeColor: '#60A5FA' },
  at_customer:        { statusLabel: 'At Customer location', destination: 'customer', phase: 'A', routeColor: '#FBBF24' },
  picked_up:          { statusLabel: 'Heading to Branch',    destination: 'branch',   phase: 'A', routeColor: '#34D399' },
  at_branch:          { statusLabel: 'At Branch — Handover', destination: 'branch',   phase: 'A', routeColor: '#A78BFA' },
  handed_over:        { statusLabel: 'Laundry In Shop',      destination: null,       phase: 'A', routeColor: '#34D399' },
  // Phase B
  ready_for_dispatch: { statusLabel: 'Ready for Return',     destination: 'branch',   phase: 'B', routeColor: '#34D399' },
  en_route:           { statusLabel: 'Out for Delivery',     destination: 'customer', phase: 'B', routeColor: '#60A5FA' },
  at_delivery:        { statusLabel: 'At Customer (Return)', destination: 'customer', phase: 'B', routeColor: '#FBBF24' },
  completed:          { statusLabel: 'Order Completed',      destination: null,       phase: 'B', routeColor: '#34D399' },
  // Fallback
  pending:            { statusLabel: 'Waiting',              destination: null,       phase: null, routeColor: '#94A3B8' },
  failed:             { statusLabel: 'Cancelled',            destination: null,       phase: null, routeColor: '#F87171' },
};

// ─── Phase B Step Definitions ─────────────────────────────────────────────────
const PHASE_B_STEPS = [
  { key: 'ready_for_dispatch', label: 'Ready for Pickup' },
  { key: 'en_route',           label: 'Out for Delivery' },
  { key: 'at_delivery',        label: 'Arrived at Customer' },
  { key: 'completed',          label: 'Delivered' },
];

const isCashCodPaymentMethod = (method) => {
  const normalized = String(method || '').trim().toLowerCase();
  return normalized.includes('cash') || normalized.includes('cod');
};

// ─── Component ────────────────────────────────────────────────────────────────
const DeliveryDetailScreen = ({ route, navigation }) => {
  useAuth(); // Auth context
  const insets = useSafeAreaInsets();

  const deliveryId = route?.params?.deliveryId;
  const mockDelivery = route?.params?._mockDelivery; // DEV: test panel
  const mapRef = useRef(null);

  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  // Phase-specific form state
  const [bagCount, setBagCount] = useState('3');
  const [pickupPhoto, setPickupPhoto] = useState(null);
  const [handoverPhoto, setHandoverPhoto] = useState(null);
  const [deliveryPhoto, setDeliveryPhoto] = useState(null);
  const [confCode, setConfCode] = useState('');

  // Map / GPS state
  const [mapRegion, setMapRegion] = useState(METRO_MANILA);
  const [driverCoords, setDriverCoords] = useState(null);
  const [derivedBranchCoords, setDerivedBranchCoords] = useState(null);
  const [derivedCustomerCoords, setDerivedCustomerCoords] = useState(null);
  const [etaInfo, setEtaInfo] = useState({ distance: null, duration: null });
  const [locationWarning, setLocationWarning] = useState('');
  const [routeWarning, setRouteWarning] = useState('');
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const collapsedSheetHeight = Math.round(SCREEN_HEIGHT * SHEET_COLLAPSED_RATIO);
  const expandedSheetHeight = Math.round(SCREEN_HEIGHT * SHEET_EXPANDED_RATIO);
  const sheetHeightAnim = useRef(new RNAnimated.Value(collapsedSheetHeight)).current;
  const currentSheetHeight = useRef(collapsedSheetHeight);
  const locationSubscriptionRef = useRef(null);
  const lastAcceptedLocationRef = useRef(null);
  const lastBackendSyncRef = useRef(0);
  const lastCameraFitRef = useRef({ key: '', at: 0 });

  // Driver "You" pulse ring animation
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const pulseOpacity = useRef(new RNAnimated.Value(0.6)).current;

  useEffect(() => {
    const id = sheetHeightAnim.addListener(({ value }) => {
      currentSheetHeight.current = value;
    });
    return () => sheetHeightAnim.removeListener(id);
  }, [sheetHeightAnim]);

  const snapSheet = (expand) => {
    const toValue = expand ? expandedSheetHeight : collapsedSheetHeight;
    setSheetExpanded(expand);
    RNAnimated.spring(sheetHeightAnim, {
      toValue,
      useNativeDriver: false,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const toggleSheet = () => {
    snapSheet(!sheetExpanded);
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
      onPanResponderMove: (_, gestureState) => {
        const nextHeight = Math.min(
          expandedSheetHeight,
          Math.max(collapsedSheetHeight, currentSheetHeight.current - gestureState.dy)
        );
        sheetHeightAnim.setValue(nextHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const midpoint = (collapsedSheetHeight + expandedSheetHeight) / 2;
        const velocityThreshold = 0.2;
        if (gestureState.vy < -velocityThreshold) {
          snapSheet(true);
          return;
        }
        if (gestureState.vy > velocityThreshold) {
          snapSheet(false);
          return;
        }
        snapSheet(currentSheetHeight.current >= midpoint);
      },
    })
  ).current;

  // ─── Pulse loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.parallel([
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 2.2, duration: 1200, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(pulseOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          RNAnimated.timing(pulseOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // ─── Boot: load delivery or mock ───────────────────────────────────────────
  useEffect(() => {
    if (mockDelivery) {
      hydrateMock(mockDelivery);
    } else {
      if (!deliveryId) {
        setError('Delivery detail is unavailable because delivery ID is missing.');
        setLoading(false);
        return;
      }
      void loadDelivery();
    }
  }, [deliveryId]);

  useEffect(() => {
    let active = true;
    const geocodeMissingTargets = async () => {
      if (!delivery) return;
      try {
        if ((!delivery.branchLatitude || !delivery.branchLongitude) && delivery.branchAddress) {
          const branchResult = await Location.geocodeAsync(delivery.branchAddress);
          if (active && branchResult?.[0]) {
            setDerivedBranchCoords({
              latitude: branchResult[0].latitude,
              longitude: branchResult[0].longitude,
            });
          }
        } else {
          setDerivedBranchCoords(null);
        }

        if ((!delivery.deliveryLatitude || !delivery.deliveryLongitude) && delivery.deliveryAddress) {
          const customerResult = await Location.geocodeAsync(delivery.deliveryAddress);
          if (active && customerResult?.[0]) {
            setDerivedCustomerCoords({
              latitude: customerResult[0].latitude,
              longitude: customerResult[0].longitude,
            });
          }
        } else {
          setDerivedCustomerCoords(null);
        }
      } catch (error) {
        console.warn('[DeliveryDetail][Geocode] Unable to derive map coordinates:', error?.message || error);
      }
    };
    void geocodeMissingTargets();
    return () => {
      active = false;
    };
  }, [delivery?.branchAddress, delivery?.branchLatitude, delivery?.branchLongitude, delivery?.deliveryAddress, delivery?.deliveryLatitude, delivery?.deliveryLongitude]);

  const hydrateMock = (data) => {
    setDelivery(data);
    if (data.bagCount || data.loadCount) setBagCount(String(data.bagCount ?? data.loadCount));
    const coords = pickBestCoords(data);
    if (coords) setMapRegion({ ...coords, latitudeDelta: 0.018, longitudeDelta: 0.018 });
    if (data.currentLatitude) {
      setDriverCoords({ latitude: data.currentLatitude, longitude: data.currentLongitude });
    }
    setLoading(false);
  };

  // ─── Live GPS tracking (High-Accuracy Real-Time) ───────────────────────────
  useEffect(() => {
    let active = true;

    const startTracking = async () => {
      try {
        if (locationSubscriptionRef.current) {
          locationSubscriptionRef.current.remove();
          locationSubscriptionRef.current = null;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationWarning('Location permission not granted.');
          return;
        }

        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (initial?.coords && active) {
          const startingCoords = {
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
            heading: initial.coords.heading || 0,
          };
          lastAcceptedLocationRef.current = { ...startingCoords, timestamp: Date.now() };
          setDriverCoords(startingCoords);
        }
        setLocationWarning('');

        // Watch position instead of polling — this is "Real-Time"
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5, // Update every 5 meters
            timeInterval: 5000,  // Or every 5 seconds
          },
          async (loc) => {
            if (!active || !delivery) return;

            const now = Date.now();
            const coords = {
              latitude: loc.coords.latitude, 
              longitude: loc.coords.longitude,
              heading: loc.coords.heading || 0
            };

            const previous = lastAcceptedLocationRef.current;
            const movedMeters = previous ? distanceMeters(previous, coords) : Number.POSITIVE_INFINITY;
            const elapsedMs = previous?.timestamp ? now - previous.timestamp : Number.POSITIVE_INFINITY;
            const accuracy = Number(loc?.coords?.accuracy || 0);

            const looksLikeGpsJump =
              previous &&
              movedMeters > GPS_JUMP_GUARD_METERS &&
              elapsedMs < GPS_JUMP_GUARD_INTERVAL_MS &&
              accuracy > 40;

            if (looksLikeGpsJump) {
              setLocationWarning('Improving GPS accuracy...');
              return;
            }

            if (previous && elapsedMs < GPS_MIN_UPDATE_INTERVAL_MS && movedMeters < GPS_MIN_MOVE_METERS) {
              return;
            }

            lastAcceptedLocationRef.current = { ...coords, timestamp: now };
            setDriverCoords(coords);
            if (accuracy > 60) {
              setLocationWarning('Improving GPS accuracy...');
            } else {
              setLocationWarning('');
            }

            // Firestore real-time sync (Complete Payload)
            if (delivery.orderNumber) {
              await setDoc(
                doc(db, 'deliveries', delivery.orderNumber),
                { 
                  currentLatitude: coords.latitude, 
                  currentLongitude: coords.longitude,
                  heading: coords.heading,
                  status: delivery.status,
                  driverName: delivery.driverName,
                  driverPhone: delivery.driverPhone,
                  lastUpdated: serverTimestamp() 
                },
                { merge: true }
              );
            }

            const shouldSyncBackend =
              now - lastBackendSyncRef.current >= GPS_BACKEND_SYNC_INTERVAL_MS ||
              movedMeters >= GPS_BACKEND_MIN_MOVE_METERS;

            if (!mockDelivery && shouldSyncBackend) {
              lastBackendSyncRef.current = now;
              deliveriesApi.updateLocation(delivery.id, coords).catch(() => {});
            }
          }
        );
      } catch (err) {
        console.warn('[GPS] Tracking error:', err);
        setLocationWarning('Unable to access live GPS location right now.');
      }
    };

    if (delivery && TRACKABLE_STATUSES.includes(delivery.status)) {
      startTracking();
    } else if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    return () => {
      active = false;
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, [delivery?.id, delivery?.status, delivery?.orderNumber, mockDelivery, trackingRefreshKey]);

  // ─── Load from backend ─────────────────────────────────────────────────────
  const loadDelivery = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await deliveriesApi.getById(deliveryId);
      setDelivery(data);
      if (data?.bagCount || data?.loadCount) setBagCount(String(data.bagCount ?? data.loadCount));
      const coords = pickBestCoords(data);
      if (coords) setMapRegion({ ...coords, latitudeDelta: 0.018, longitudeDelta: 0.018 });
    } catch (e) {
      setError(e?.message || 'Unable to load delivery.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [deliveryId]);

  useFocusEffect(
    useCallback(() => {
      if (!mockDelivery && deliveryId) {
        void loadDelivery({ silent: true });
      }
      setTrackingRefreshKey((prev) => prev + 1);
      return () => {
        if (locationSubscriptionRef.current) {
          locationSubscriptionRef.current.remove();
          locationSubscriptionRef.current = null;
        }
      };
    }, [deliveryId, loadDelivery, mockDelivery])
  );

  // Returns best initial map center based on delivery status
  const pickBestCoords = (data) => {
    const cfg = STATE_CONFIG[data?.status];
    if (cfg?.destination === 'customer' && data?.deliveryLatitude)
      return { latitude: data.deliveryLatitude, longitude: data.deliveryLongitude };
    if (cfg?.destination === 'branch' && data?.branchLatitude)
      return { latitude: data.branchLatitude, longitude: data.branchLongitude };
    if (data?.deliveryLatitude)
      return { latitude: data.deliveryLatitude, longitude: data.deliveryLongitude };
    return null;
  };

  // ─── Global action handler ─────────────────────────────────────────────────
  const handleAction = async (method, args = null) => {
    if (updating) return;

    // DEV mock mode — local state transitions
    if (mockDelivery) {
      const MOCK_NEXT = {
        arriveAtCustomer:  'at_customer',
        completePickup:    'picked_up',
        arriveAtBranch:    'at_branch',
        branchHandover:    'handed_over',
        startDelivery:     'en_route',
        arriveForDelivery: 'at_delivery',
        finalHandover:     'completed',
        collectCodPayment: delivery?.status,
        resendConfirmationCode: delivery?.status,
      };
      const next = MOCK_NEXT[method];
      if (next) {
        setDelivery(prev => ({
          ...prev,
          status: next,
          bagCount: args?.bagCount || prev.bagCount,
        }));
        setEtaInfo({ distance: null, duration: null }); // reset ETA on transition
      }
      return;
    }

    try {
      if (method === 'collectCodPayment') {
        const paymentStatus = String(delivery?.paymentStatus || '').toUpperCase();
        if (delivery?.isPaid || paymentStatus === 'PAID' || paymentStatus === 'VERIFIED') {
          Alert.alert('Payment', 'Payment already collected.');
          return;
        }
        if (!isCashCodPaymentMethod(delivery?.paymentMethod)) {
          Alert.alert('Payment Not Allowed', 'COD collection is only available for cash/COD orders.');
          return;
        }
      }

      setUpdating(true);
      const updated = await deliveriesApi[method](delivery.id, args);
      if (!updated?.id || !updated?.orderNumber) {
        throw new Error('Delivery update returned incomplete data. Please refresh and try again.');
      }
      setDelivery(updated);
      if (method === 'collectCodPayment') {
        await loadDelivery({ silent: true });
        Alert.alert('Payment Collected', 'Cash payment marked as paid.');
      } else if (method === 'resendConfirmationCode') {
        Alert.alert('Code Sent', 'A delivery confirmation code was sent to the customer email.');
      }
      setEtaInfo({ distance: null, duration: null }); // reset ETA on transition
      if (method === 'finalHandover' && updated.status === 'completed') {
        Alert.alert('Delivery Completed', 'Great work. Returning to your dashboard.', [
          { text: 'OK', onPress: () => navigation.navigate('DriverTabs', { screen: 'Dashboard' }) },
        ]);
      }
    } catch (e) {
      const message = String(e?.message || '');
      console.warn('[DeliveryDetail][ActionFailed]', { method, deliveryId: delivery?.id, message });
      if (message.toLowerCase().includes('already collected')) {
        Alert.alert('Payment', 'Payment already collected.');
      } else if (message.toLowerCase().includes('cash/cod')) {
        Alert.alert('Payment Not Allowed', 'COD collection is only available for cash/COD orders.');
      } else if (message.toLowerCase().includes('cannot') || message.toLowerCase().includes('invalid')) {
        Alert.alert('Action Not Allowed', 'This action is not allowed for the current delivery state.');
      } else {
        Alert.alert('Action Failed', message || 'Something went wrong. Try again.');
      }
    } finally {
      setUpdating(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getTargetCoords = () => {
    if (!delivery) return null;
    const pickupToBranchStates = new Set(['accepted', 'at_customer', 'picked_up', 'at_branch', 'handed_over', 'ready_for_dispatch']);
    const deliveryToCustomerStates = new Set([
      'en_route',
      'at_delivery',
      'completed',
    ]);

    const branchCoords = (delivery.branchLatitude && delivery.branchLongitude)
      ? { latitude: delivery.branchLatitude, longitude: delivery.branchLongitude }
      : derivedBranchCoords;
    const customerCoords = (delivery.deliveryLatitude && delivery.deliveryLongitude)
      ? { latitude: delivery.deliveryLatitude, longitude: delivery.deliveryLongitude }
      : derivedCustomerCoords;

    if (pickupToBranchStates.has(delivery.status) && branchCoords) {
      return branchCoords;
    }
    if (deliveryToCustomerStates.has(delivery.status) && customerCoords) {
      return customerCoords;
    }
    if (branchCoords) {
      return branchCoords;
    }
    if (customerCoords) {
      return customerCoords;
    }
    return null;
  };

  const openExternalNav = () => {
    const t = getTargetCoords();
    if (!t) {
      const msg = ['accepted', 'at_customer'].includes(delivery?.status)
        ? 'Branch location unavailable.'
        : 'Customer location unavailable.';
      return Alert.alert('Navigation Unavailable', msg);
    }
    const origin = driverCoords?.latitude && driverCoords?.longitude
      ? `&origin=${driverCoords.latitude},${driverCoords.longitude}`
      : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${t.latitude},${t.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Navigation Unavailable', 'Unable to open Google Maps right now.');
    });
  };

  const normalizePhone = (value) => String(value || '').replace(/[^0-9+]/g, '');

  const callCustomer = async () => {
    const phone = normalizePhone(delivery?.customerPhone);
    if (!phone) {
      Alert.alert('No phone number available.', 'Customer contact number is not provided.');
      return;
    }
    try {
      const url = `tel:${phone}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('dialer unavailable');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open phone dialer.', 'Please try again later.');
    }
  };

  const messageCustomer = async () => {
    const phone = normalizePhone(delivery?.customerPhone);
    if (!phone) {
      Alert.alert('No phone number available.', 'Customer contact number is not provided.');
      return;
    }
    try {
      const url = `sms:${phone}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('messaging unavailable');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open messaging app.', 'Please try again later.');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this pickup?',
      [{ text: 'Keep Order', style: 'cancel' }, { text: 'Cancel Order', style: 'destructive', onPress: () => navigation.goBack() }]
    );
  };

  // ─── Step Tracker (Phase B) ────────────────────────────────────────────────
  const renderStepTracker = () => {
    const currentIdx = PHASE_B_STEPS.findIndex(s => s.key === delivery.status);
    const isCompleted = delivery.status === 'completed';
    return (
      <View style={styles.stepTracker}>
        {PHASE_B_STEPS.map((step, idx) => {
          const done = isCompleted ? true : idx < currentIdx;
          const active = !isCompleted && idx === currentIdx;
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                  {done ? <Ionicons name="checkmark" size={9} color="#FFF" /> : null}
                  {active && !done ? <View style={styles.stepDotCoreDot} /> : null}
                </View>
                {idx < PHASE_B_STEPS.length - 1 && (
                  <View style={[styles.stepConnector, done && styles.stepConnectorDone]} />
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text style={[styles.stepLabelText, done && styles.stepLabelDone, active && styles.stepLabelActive]}>
                  {step.label}
                </Text>
                {active && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // ─── Bottom Sheet Content per State ───────────────────────────────────────
  const renderSheetContent = () => {
    if (!delivery) return null;
    const { status, customerName, customerPhone, deliveryAddress, branchAddress, branchName, bagCount: bags } = delivery;

    // ── ACCEPTED: Heading to Customer ────────────────────────────────────────
    if (status === 'accepted') {
      return (
        <View style={styles.sheetInner}>
          <Text style={styles.sheetTitle}>Phase 1: Pickup — Go to {branchName || 'Assigned Branch'}</Text>

          {/* Customer Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={22} color={colors.textTertiary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileSubLabel}>Laundry Branch</Text>
              <Text style={styles.profileName}>{branchName || 'Assigned Branch'}</Text>
              {branchAddress ? (
                <Text style={styles.profileAddress}>{branchAddress}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={callCustomer}
              disabled={!normalizePhone(customerPhone)}
            >
              <Ionicons name="call" size={15} color="#FFF" />
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
            <Text style={styles.cancelLinkText}>Cancel Order</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ── AT_CUSTOMER: Bag Count + Photo + Confirm ──────────────────────────────
    if (status === 'at_customer') {
      return (
        <View style={styles.sheetInner}>
          <Text style={styles.sheetTitle}>Arrived at Branch Pickup Point</Text>

          {/* Bag count */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>BAG COUNT (EST)</Text>
            <TextInput
              style={styles.bagCountInput}
              value={bagCount}
              onChangeText={setBagCount}
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          {/* Photo proof card */}
          <View style={styles.photoCard}>
            <Text style={styles.photoCardTitle}>Proof of Pickup Photo Required</Text>
            <PhotoProofCapture
              label="Take Photo"
              value={pickupPhoto}
              onCapture={setPickupPhoto}
              onError={(message) => console.warn('[DeliveryDetail][PickupPhoto]', message)}
            />
          </View>

          <Text style={styles.mandatoryHint}>Mandatory items for processing.</Text>

        </View>
      );
    }

    // ── PICKED_UP: Inventory Confirmed → Head to Branch ───────────────────────
    if (status === 'picked_up') {
      return (
        <View style={styles.sheetInner}>
          <View style={styles.inventoryBanner}>
            <MaterialCommunityIcons name="check-decagram" size={30} color={colors.success} />
            <View style={styles.inventoryBannerText}>
              <Text style={styles.inventoryBannerTitle}>Pickup Complete!</Text>
              <Text style={styles.inventoryBannerSub}>
                Carrying <Text style={{ fontWeight: '900' }}>{bags || bagCount} bags</Text> for {customerName}
              </Text>
            </View>
          </View>

          <View style={styles.destinationRow}>
            <View style={[styles.destIcon, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="storefront-outline" size={15} color="#7C3AED" />
            </View>
            <Text style={styles.destText} numberOfLines={2}>
              {branchAddress || 'Head to the Laundry Branch for drop-off'}
            </Text>
          </View>

        </View>
      );
    }

    // ── AT_BRANCH: Handover Mode ──────────────────────────────────────────────
    if (status === 'at_branch') {
      return (
        <View style={[styles.sheetInner, styles.handoverSheetInner]}>
          <View style={styles.handoverHeaderRow}>
            <MaterialCommunityIcons name="storefront" size={20} color="#FFF" />
            <Text style={styles.handoverTitle}>Branch Handover Mode</Text>
          </View>
          <Text style={styles.handoverSubtext}>
            Place the {bags || bagCount} bags on the counter. Take a clear photo as proof.
          </Text>

          <View style={[styles.photoCard, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={[styles.photoCardTitle, { color: '#E9D5FF' }]}>Branch Counter Photo Required</Text>
            <PhotoProofCapture
              label="Take Photo"
              value={handoverPhoto}
              onCapture={setHandoverPhoto}
              onError={(message) => console.warn('[DeliveryDetail][BranchHandoverPhoto]', message)}
            />
          </View>

        </View>
      );
    }

    // ── HANDED_OVER: Waiting for Phase B ─────────────────────────────────────
    if (status === 'handed_over') {
      return (
        <View style={[styles.centerPanel, styles.centerPanelCompact]}>
          <MaterialCommunityIcons name="washing-machine" size={34} color={colors.accent} />
          <Text style={styles.waitTitle}>Phase 1 Complete!</Text>
          <Text style={styles.waitSub}>
            Laundry is being processed at the branch. You&apos;ll be notified when clean laundry is ready.
          </Text>
          <View style={styles.freeBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.freeBadgeText}>You are free to take other orders!</Text>
          </View>
        </View>
      );
    }

    // ── READY_FOR_DISPATCH: Phase 2 Start ────────────────────────────────────
    if (status === 'ready_for_dispatch') {
      return (
        <View style={styles.sheetInner}>
          <View style={styles.readyBanner}>
            <MaterialCommunityIcons name="check-circle-outline" size={26} color={colors.success} />
            <View style={styles.readyBannerText}>
              <Text style={styles.readyBannerTitle}>Phase 2: Clean Laundry Ready!</Text>
              <Text style={styles.readyBannerSub}>
                {bags || '?'} bags for {customerName} — waiting at branch
              </Text>
            </View>
          </View>

          <View style={styles.destinationRow}>
            <View style={[styles.destIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="location-outline" size={15} color={colors.primary} />
            </View>
            <Text style={styles.destText} numberOfLines={2}>
              {deliveryAddress || 'Customer delivery address not set'}
            </Text>
          </View>

        </View>
      );
    }

    // ── EN_ROUTE: Out for Delivery ────────────────────────────────────────────
    if (status === 'en_route') {
      return (
        <View style={styles.sheetInner}>
          <Text style={styles.sheetTitle}>Phase 2: Return Journey</Text>

          {renderStepTracker()}

          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={22} color={colors.textTertiary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileSubLabel} numberOfLines={1}>{deliveryAddress}</Text>
              <Text style={styles.profileName}>{customerName}</Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={callCustomer}
              disabled={!normalizePhone(customerPhone)}
            >
              <Ionicons name="call" size={15} color="#FFF" />
            </TouchableOpacity>
          </View>

        </View>
      );
    }

    // ── AT_DELIVERY: Final Handover ───────────────────────────────────────────
    if (status === 'at_delivery') {
      return (
        <View style={styles.sheetInner}>
          <Text style={styles.sheetTitle}>Arrived at Customer for Final Delivery</Text>

          {/* Call + Message row */}
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={callCustomer}
              disabled={!normalizePhone(customerPhone)}
            >
              <Ionicons name="call" size={16} color="#FFF" />
              <Text style={styles.contactBtnText}>Call{'\n'}Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: '#334e87' }]}
              onPress={messageCustomer}
              disabled={!normalizePhone(customerPhone)}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color="#FFF" />
              <Text style={styles.contactBtnText}>Message{'\n'}Customer</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.mandatoryHint}>Mandatory items for final processing.</Text>

          {/* Confirmation code card */}
          <View style={styles.codeCard}>
            <Text style={styles.inputLabel}>DELIVERY CONFIRMATION CODE</Text>
            {hasConfirmationCode ? (
              <TextInput
                style={styles.codeInput}
                value={confCode}
                onChangeText={setConfCode}
                placeholder="Ask customer - e.g. 9876"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={4}
              />
            ) : (
              <View style={styles.codeMissingCard}>
                <Text style={styles.codeMissingText}>
                  Confirmation code not available yet. Ask the customer to check email, then tap resend if needed.
                </Text>
                <TouchableOpacity
                  style={styles.codeResendBtn}
                  onPress={() => handleAction('resendConfirmationCode')}
                  disabled={updating}
                >
                  <Text style={styles.codeResendBtnText}>{updating ? 'Sending...' : 'Resend Code'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Photo proof */}
          <View style={styles.photoCard}>
            <PhotoProofCapture
              label="Take Photo"
              value={deliveryPhoto}
              onCapture={setDeliveryPhoto}
              onError={(message) => console.warn('[DeliveryDetail][FinalDeliveryPhoto]', message)}
            />
          </View>

        </View>
      );
    }

    // ── COMPLETED: Done ───────────────────────────────────────────────────────
    if (status === 'completed') {
      return (
        <View style={styles.centerPanel}>
          <MaterialCommunityIcons name="check-decagram" size={60} color={colors.success} />
          <Text style={styles.doneTitle}>Trip Completed! 🎉</Text>
          <Text style={styles.doneSub}>
            Clean laundry delivered to{' '}
            <Text style={{ fontWeight: '800' }}>{customerName}</Text>.
            {'\n'}Great work!
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={16} color="#FFF" />
            <Text style={styles.doneBtnText}>Back to Deliveries</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ── PENDING: New Order Incoming ───────────────────────────────────────────
    return (
      <View style={styles.sheetInner}>
        {/* Header row with animated badge */}
        <View style={styles.newOrderHeader}>
          <View style={styles.newOrderBadge}>
            <View style={styles.newOrderBadgeDot} />
            <Text style={styles.newOrderBadgeText}>NEW ORDER</Text>
          </View>
          <Text style={styles.newOrderSubhead}>Review & Accept</Text>
        </View>

        {/* Customer info card */}
        <View style={styles.newOrderCard}>
          <View style={styles.newOrderCardTop}>
            <View style={styles.newOrderAvatar}>
              <Ionicons name="person" size={22} color={colors.primary} />
            </View>
            <View style={styles.newOrderCardInfo}>
              <Text style={styles.newOrderCustomerName}>{customerName}</Text>
              <Text style={styles.newOrderAddress} numberOfLines={2}>
                {deliveryAddress || 'Customer address not set'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={callCustomer}
              disabled={!normalizePhone(customerPhone)}
            >
              <Ionicons name="call" size={15} color="#FFF" />
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          </View>

          {/* Distance & ETA chips */}
          <View style={styles.newOrderChipsRow}>
            <View style={styles.newOrderChip}>
              <Ionicons name="navigate-outline" size={13} color={colors.primary} />
              <Text style={styles.newOrderChipText}>
                {etaInfo.distance ? `${etaInfo.distance} km` : 'Calculating...'}
              </Text>
            </View>
            <View style={styles.newOrderChip}>
              <Ionicons name="time-outline" size={13} color={colors.accent} />
              <Text style={[styles.newOrderChipText, { color: colors.accent }]}>
                {etaInfo.duration ? `~${etaInfo.duration} min` : 'Getting ETA'}
              </Text>
            </View>
            <View style={[styles.newOrderChip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <MaterialCommunityIcons name="washing-machine" size={13} color={colors.success} />
              <Text style={[styles.newOrderChipText, { color: colors.success }]}>Laundry Pickup</Text>
            </View>
          </View>
        </View>

        {/* Route preview — pickup address */}
        <View style={styles.newOrderRouteCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>PICKUP FROM</Text>
              <Text style={styles.routeValue} numberOfLines={2}>{customerName}</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>{deliveryAddress || '—'}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: '#7C3AED' }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>DROP-OFF AT</Text>
              <Text style={styles.routeValue} numberOfLines={2}>
                {delivery.branchAddress?.split(',')[0] || 'Laundry Branch'}
              </Text>
              <Text style={styles.routeAddress} numberOfLines={2}>{branchAddress || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Accept CTA */}
        <TouchableOpacity
          style={[styles.acceptBtn, updating && styles.acceptBtnDisabled]}
          onPress={async () => {
            if (updating) return;
            try {
              setUpdating(true);
              const accepted = await deliveriesApi.acceptBooking(delivery.orderNumber);
              setDelivery(accepted);
            } catch (e) {
              console.error('[AcceptError]', e);
              Alert.alert('Accept Failed', e?.message || 'Unable to accept this delivery right now.');
            } finally {
              setUpdating(false);
            }
          }}
          disabled={updating}
          activeOpacity={0.85}
        >
          {updating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.acceptBtnText}>Accept Delivery</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
          <Text style={styles.cancelLinkText}>Decline Order</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.fullDark}>
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text style={styles.darkLoadText}>Loading order...</Text>
      </View>
    );
  }

  if (!delivery && error) {
    return (
      <View style={styles.fullDark}>
        <Ionicons name="alert-circle-outline" size={48} color="#F87171" />
        <Text style={[styles.darkLoadText, { color: '#F87171' }]}>{error}</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!delivery) return null;

  // ─── Live values ───────────────────────────────────────────────────────────
  const cfg = STATE_CONFIG[delivery.status] || STATE_CONFIG['pending'];
  const targetCoords = getTargetCoords();
  const isHandover = delivery.status === 'at_branch';
  const showCodBanner =
    !delivery.isPaid &&
    isCashCodPaymentMethod(delivery.paymentMethod) &&
    delivery.status !== 'completed';
  const hasConfirmationCode = Boolean(String(delivery.confirmationCode || '').trim());
  const loadCountValue = delivery.bagCount ?? delivery.loadCount ?? (delivery.loadKg ? `${delivery.loadKg} kg` : (bagCount || 'Not provided'));
  const trackingValue = delivery.orderNumber || delivery.trackingNumber || 'Not provided';
  const stickyAction = (() => {
    switch (delivery.status) {
      case 'accepted':
        return {
          label: 'Start Pickup',
          color: colors.primary,
          disabled: updating,
          onComplete: () => handleAction('arriveAtCustomer'),
        };
      case 'at_customer':
        return {
          label: 'Confirm Pickup',
          color: colors.primary,
          disabled: updating || !bagCount || !pickupPhoto,
          onComplete: () =>
            handleAction('completePickup', {
              bagCount: parseInt(bagCount, 10) || 1,
              pickupPhotoUrl: pickupPhoto,
            }),
        };
      case 'picked_up':
        return {
          label: 'Arrived at Branch',
          color: '#7C3AED',
          disabled: updating,
          onComplete: () => handleAction('arriveAtBranch'),
        };
      case 'at_branch':
        return {
          label: 'Confirm Branch Handover',
          color: '#7C3AED',
          disabled: updating || !handoverPhoto,
          onComplete: () =>
            handleAction('branchHandover', {
              branchHandoverPhotoUrl: handoverPhoto,
            }),
        };
      case 'ready_for_dispatch':
        return {
          label: 'Start Return Delivery',
          color: colors.accent,
          disabled: updating,
          onComplete: () => handleAction('startDelivery'),
        };
      case 'en_route':
        return {
          label: 'Arrive at Customer',
          color: colors.primary,
          disabled: updating,
          onComplete: () => handleAction('arriveForDelivery'),
        };
      case 'at_delivery':
        return {
          label: 'Mark Delivered',
          color: colors.primary,
          disabled: updating || !hasConfirmationCode || confCode.length < 4 || !deliveryPhoto,
          onComplete: () =>
            handleAction('finalHandover', {
              confirmationCode: confCode,
              finalDeliveryPhotoUrl: deliveryPhoto,
            }),
        };
      default:
        return null;
    }
  })();

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── FULL SCREEN DARK MAP ─────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton
        showsCompass={false}
        showsTraffic={false}
      >
        {/* Driver "You" marker with pulse ring */}
        {driverCoords && (
          <Marker coordinate={driverCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.driverWrap}>
              <RNAnimated.View
                style={[
                  styles.driverPulse,
                  { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
                ]}
              />
              <View style={styles.driverCore}>
                <Ionicons name="car-sport" size={14} color={colors.primary} />
              </View>
              <View style={styles.driverTag}>
                <Text style={styles.driverTagText}>You</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Customer destination pin */}
        {(delivery.deliveryLatitude && delivery.deliveryLongitude) || derivedCustomerCoords ? (
          <Marker
            coordinate={
              delivery.deliveryLatitude && delivery.deliveryLongitude
                ? { latitude: delivery.deliveryLatitude, longitude: delivery.deliveryLongitude }
                : derivedCustomerCoords
            }
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={styles.pinWrap}>
              <View style={styles.calloutBubble}>
                <Text style={styles.calloutText}>Customer: {delivery.customerName}</Text>
              </View>
              <View style={styles.calloutArrow} />
              <View style={styles.redDot} />
            </View>
          </Marker>
        ) : null}

        {/* Branch pin — always visible as reference point */}
        {(delivery.branchLatitude && delivery.branchLongitude) || derivedBranchCoords ? (
          <Marker
            coordinate={
              delivery.branchLatitude && delivery.branchLongitude
                ? { latitude: delivery.branchLatitude, longitude: delivery.branchLongitude }
                : derivedBranchCoords
            }
            anchor={{ x: 0, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.branchTag}>
              <View style={[
                styles.branchSquare,
                { backgroundColor: cfg.destination === 'branch' ? '#7C3AED' : '#1E3A5F' },
              ]} />
              <Text style={styles.branchTagText}>
                {delivery.branchAddress?.split(',')[0] || 'Branch'}
              </Text>
            </View>
          </Marker>
        ) : null}

        {/* Route polyline */}
        {(driverCoords || mapRegion) && targetCoords && (
          <MapViewDirections
            origin={driverCoords || { latitude: mapRegion.latitude, longitude: mapRegion.longitude }}
            destination={targetCoords}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={4}
            strokeColor={cfg.routeColor}
            mode="DRIVING"
            onReady={(result) => {
              setRouteWarning('');
              setEtaInfo({
                distance: result.distance.toFixed(1),
                duration: Math.round(result.duration),
              });
              const focusKey = `${delivery?.status || "unknown"}:${Math.round(targetCoords.latitude * 1000)}:${Math.round(targetCoords.longitude * 1000)}`;
              const shouldFit =
                lastCameraFitRef.current.key !== focusKey ||
                Date.now() - lastCameraFitRef.current.at > 20000;
              // Fit only when destination/status changes (or occasionally), to avoid camera flicker.
              if (shouldFit && mapRef.current && result.coordinates?.length > 1) {
                lastCameraFitRef.current = { key: focusKey, at: Date.now() };
                mapRef.current.fitToCoordinates(result.coordinates, {
                  edgePadding: {
                    top: 160,
                    right: 60,
                    bottom: Math.max(currentSheetHeight.current + 40, 220),
                    left: 60,
                  },
                  animated: true,
                });
              }
            }}
            onError={(errMessage) => {
              console.warn('[DeliveryDetail][Directions] Route unavailable:', errMessage);
              setRouteWarning('Live route is temporarily unavailable. You can still open Google Maps for navigation.');
            }}
          />
        )}
      </MapView>

      {/* ── HEADER OVERLAY ───────────────────────────────────────────────── */}
      <View
        style={[
          styles.headerOverlay,
          { paddingTop: Math.max(insets.top, 8) },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerCircle} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#0D1B2A" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Delivery Details</Text>

          <TouchableOpacity style={styles.headerCircle} onPress={openExternalNav}>
            <Ionicons name="navigate" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ETA Status strip */}
        <View style={styles.etaStrip}>
          <View style={styles.etaStatusDot} />
          <Text style={styles.etaText}>
            {'Status: '}
            <Text style={styles.etaBold}>{cfg.statusLabel}</Text>
            {etaInfo.duration
              ? `  |  ETA: ${etaInfo.duration} min  |  ${etaInfo.distance} km`
              : ''}
          </Text>
        </View>
      </View>

      {/* ── BOTTOM SHEET ─────────────────────────────────────────────────── */}
      <RNAnimated.View
        style={[
          styles.bottomSheet,
          isHandover && styles.bottomSheetHandover,
          {
            paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
            height: sheetHeightAnim,
          },
        ]}
      >
        <View style={styles.dragHandleTouch} {...sheetPanResponder.panHandlers}>
          <TouchableOpacity style={styles.dragHandleButton} onPress={toggleSheet} activeOpacity={0.8}>
            <View style={styles.dragHandle} />
            <Ionicons
              name={sheetExpanded ? 'chevron-down' : 'chevron-up'}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* No GPS warning */}
        {!targetCoords && !['handed_over', 'completed', 'pending'].includes(delivery.status) && (
          <View style={styles.noGpsBar}>
            <Ionicons name="warning-outline" size={13} color="#92400E" />
            <Text style={styles.noGpsText}>
              {['accepted', 'at_customer'].includes(delivery.status)
                ? 'Branch location unavailable.'
                : 'Customer location unavailable.'}
            </Text>
          </View>
        )}
        {locationWarning ? (
          <View style={styles.noGpsBar}>
            <Ionicons name="locate-outline" size={13} color="#92400E" />
            <Text style={styles.noGpsText}>{locationWarning}</Text>
          </View>
        ) : null}
        {routeWarning ? (
          <View style={styles.noGpsBar}>
            <Ionicons name="navigate-outline" size={13} color="#92400E" />
            <Text style={styles.noGpsText}>{routeWarning}</Text>
          </View>
        ) : null}
        {targetCoords ? (
          <TouchableOpacity style={styles.externalNavBtn} onPress={openExternalNav}>
            <Ionicons name="navigate-outline" size={14} color={colors.primary} />
            <Text style={styles.externalNavText}>Open in Google Maps</Text>
          </TouchableOpacity>
        ) : null}


        {/* State-specific content */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.sheetScroll}
          contentContainerStyle={[
            styles.sheetScrollContent,
            showCodBanner && styles.sheetScrollWithCodBanner,
            stickyAction && styles.sheetScrollWithStickyAction,
          ]}
        >
          <View style={styles.deliveryMetaCard}>
            <View style={styles.deliveryMetaRow}>
              <Text style={styles.deliveryMetaLabel}>Tracking</Text>
              <Text style={styles.deliveryMetaValue} numberOfLines={2}>
                {trackingValue}
              </Text>
            </View>
            <View style={styles.deliveryMetaRow}>
              <Text style={styles.deliveryMetaLabel}>Load Count</Text>
              <Text style={styles.deliveryMetaValue}>{loadCountValue}</Text>
            </View>
            <View style={styles.deliveryMetaBlock}>
              <Text style={styles.deliveryMetaLabel}>Branch Address</Text>
              <Text style={[styles.deliveryMetaValue, styles.deliveryMetaValueFull]}>
                {delivery.branchAddress || delivery.branchName || 'Not provided'}
              </Text>
            </View>
            <View style={styles.deliveryMetaBlock}>
              <Text style={styles.deliveryMetaLabel}>Delivery Address</Text>
              <Text style={[styles.deliveryMetaValue, styles.deliveryMetaValueFull]}>
                {delivery.deliveryAddress || 'N/A'}
              </Text>
            </View>
          </View>

          {renderSheetContent()}

          {showCodBanner && (
            <TouchableOpacity
              style={styles.codBanner}
              onPress={() => Alert.alert(
                'Collect Cash',
                'Have you received PHP ' + (delivery.amountToCollect?.toLocaleString() || '0') + ' from ' + delivery.customerName + '?',
                [
                  { text: 'Not yet', style: 'cancel' },
                  { text: 'Yes - Collected', onPress: () => handleAction('collectCodPayment') },
                ]
              )}
            >
              <Ionicons name="wallet-outline" size={16} color={colors.primary} />
              <View style={styles.codBannerTextWrap}>
                <Text style={styles.codBannerLabel}>COD / Total Payment</Text>
                <Text style={styles.codBannerText}>
                  ₱{delivery.amountToCollect?.toLocaleString() || '0'} • Tap to mark collected
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </ScrollView>
        {stickyAction && (
          <View style={[styles.stickyActionBar, isHandover && styles.stickyActionBarDark]}>
            <SwipeSlider
              label={stickyAction.label}
              color={stickyAction.color}
              disabled={stickyAction.disabled}
              onComplete={stickyAction.onComplete}
            />
          </View>
        )}
      </RNAnimated.View>

      {/* ── UPDATING OVERLAY ─────────────────────────────────────────────── */}
      {updating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.updatingText}>Updating status...</Text>
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1d2c4d',
  },

  // ── Loading / Error ──
  fullDark: {
    flex: 1,
    backgroundColor: '#1d2c4d',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  darkLoadText: {
    color: '#8ec3b9',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Map markers ──
  driverWrap: {
    alignItems: 'center',
  },
  driverPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 58, 95, 0.35)',
  },
  driverCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  driverTag: {
    marginTop: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  driverTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D1B2A',
  },

  pinWrap: {
    alignItems: 'center',
  },
  calloutBubble: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    maxWidth: 180,
  },
  calloutText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D1B2A',
  },
  calloutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFF',
    marginTop: -1,
  },
  redDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 2.5,
    borderColor: '#FFF',
    marginTop: 2,
    elevation: 4,
  },

  branchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    elevation: 3,
  },
  branchSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  branchTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D1B2A',
  },

  // ── Header overlay ──
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 2,
    gap: 10,
  },
  headerCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1B2A',
    letterSpacing: 0.2,
  },
  etaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d2c4d',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 7,
  },
  etaStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34D399',
  },
  etaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    flex: 1,
  },
  etaBold: {
    color: '#FFF',
    fontWeight: '800',
  },

  // ── Bottom sheet ──
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.8,
    minHeight: SCREEN_HEIGHT * 0.25,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  bottomSheetHandover: {
    backgroundColor: '#1E0B4A',
  },
  dragHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#DDE6F3',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  dragHandleTouch: {
    alignItems: 'center',
    paddingTop: 6,
  },
  dragHandleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 72,
    paddingVertical: 2,
  },
  sheetScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 20,
  },
  sheetScrollWithCodBanner: {
    paddingBottom: 28,
  },
  sheetScrollWithStickyAction: {
    paddingBottom: SHEET_ACTION_BAR_HEIGHT + 18,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetInner: {
    gap: 13,
  },

  deliveryMetaCard: {
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE6F3',
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  deliveryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  deliveryMetaBlock: {
    gap: 3,
  },
  deliveryMetaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  deliveryMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B2A',
    flexShrink: 1,
    maxWidth: '62%',
    lineHeight: 18,
    textAlign: 'right',
  },
  deliveryMetaValueFull: {
    textAlign: 'left',
  },
  stickyActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#E3EAF5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  stickyActionBarDark: {
    backgroundColor: '#1E0B4A',
    borderTopColor: 'rgba(255,255,255,0.18)',
  },

  // ── Sheet: Titles ──
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1B2A',
    lineHeight: 22,
  },

  // ── Profile card ──
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#DDE6F3',
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DDE6F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileSubLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1B2A',
    marginTop: 1,
  },
  profileAddress: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 16,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
  },
  callBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Destination row ──
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F8FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDE6F3',
  },
  destIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0D1B2A',
    lineHeight: 18,
  },

  // ── Cancel link ──
  cancelLink: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  cancelLinkText: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // ── Forms ──
  fieldGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bagCountInput: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0D1B2A',
    height: 50,
    borderBottomWidth: 2,
    borderBottomColor: '#DDE6F3',
    paddingHorizontal: 0,
  },

  // ── Photo card ──
  photoCard: {
    backgroundColor: '#F5F8FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDE6F3',
    gap: 10,
  },
  photoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B2A',
  },
  mandatoryHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Code card ──
  codeCard: {
    gap: 6,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: '#DDE6F3',
    paddingVertical: 4,
    paddingHorizontal: 0,
    letterSpacing: 6,
  },
  codeMissingCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDE6F3',
    backgroundColor: '#F8FAFF',
    padding: 10,
    gap: 8,
  },
  codeMissingText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  codeResendBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  codeResendBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Contact row (at_delivery) ──
  contactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  contactBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Inventory banner (picked_up) ──
  inventoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
  inventoryBannerText: { flex: 1 },
  inventoryBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.success,
  },
  inventoryBannerSub: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 2,
  },

  // ── Handover mode (at_branch dark) ──
  handoverSheetInner: {
    backgroundColor: '#1E0B4A',
  },
  handoverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  handoverTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
  },
  handoverSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 19,
  },

  // ── Ready banner (ready_for_dispatch) ──
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
  readyBannerText: { flex: 1 },
  readyBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.success,
  },
  readyBannerSub: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 2,
  },

  // ── Step tracker ──
  stepTracker: {
    backgroundColor: '#F5F8FF',
    borderRadius: 14,
    padding: 14,
    gap: 0,
    borderWidth: 1,
    borderColor: '#DDE6F3',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 36,
  },
  stepLeft: {
    alignItems: 'center',
    width: 22,
    marginRight: 12,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DDE6F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DDE6F3',
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotCoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#DDE6F3',
    marginVertical: 2,
    minHeight: 14,
  },
  stepConnectorDone: {
    backgroundColor: colors.success,
  },
  stepInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    gap: 8,
    paddingTop: 1,
  },
  stepLabelText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  stepLabelDone: {
    color: colors.success,
    fontWeight: '700',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  activePill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },

  // ── New Order (pending) panel ──
  newOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  newOrderBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F59E0B',
  },
  newOrderBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.8,
  },
  newOrderSubhead: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  newOrderCard: {
    backgroundColor: '#F5F8FF',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#DDE6F3',
  },
  newOrderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newOrderAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newOrderCardInfo: {
    flex: 1,
  },
  newOrderCustomerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1B2A',
  },
  newOrderAddress: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  newOrderChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  newOrderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#C7D7F5',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  newOrderChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  newOrderRouteCard: {
    backgroundColor: '#F5F8FF',
    borderRadius: 14,
    padding: 14,
    gap: 0,
    borderWidth: 1,
    borderColor: '#DDE6F3',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeLine: {
    width: 2,
    height: 18,
    backgroundColor: '#DDE6F3',
    marginLeft: 5,
  },
  routeInfo: {
    flex: 1,
    minWidth: 0,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  routeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D1B2A',
    marginTop: 1,
  },
  routeAddress: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 15,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 18,
    elevation: 4,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  acceptBtnDisabled: {
    opacity: 0.6,
  },
  acceptBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // ── Center panels (waiting / done) ──
  centerPanel: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  centerPanelCompact: {
    paddingVertical: 8,
    gap: 8,
  },
  waitTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D1B2A',
    textAlign: 'center',
  },
  waitSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  freeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.success,
    textAlign: 'center',
  },
  doneSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 6,
  },
  doneBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },

  // ── No GPS bar ──
  noGpsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FEF9C3',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
    padding: 10,
    borderRadius: 10,
  },
  noGpsText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 15,
  },
  externalNavBtn: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingVertical: 9,
  },
  externalNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // ── COD banner ──
  codBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 0,
    marginTop: 8,
    marginBottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  codBannerTextWrap: {
    flex: 1,
  },
  codBannerLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 1,
  },
  codBannerText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Updating overlay ──
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,27,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  updatingText: {
    color: '#FFF',
    marginTop: 12,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default DeliveryDetailScreen;


