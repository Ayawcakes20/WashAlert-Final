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
import { driverOrders } from '../../services/api';
import { GOOGLE_MAPS_API_KEY } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import SwipeSlider from '../../components/SwipeSlider';
import PhotoProofCapture from '../../components/PhotoProofCapture';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_RATIO = 0.24;
const SHEET_EXPANDED_RATIO = 0.74;
const SHEET_ACTION_BAR_HEIGHT = 92;
const TRACKABLE_STATUSES = [
  'ASSIGNED_FOR_PICKUP',
  'EN_ROUTE_TO_CUSTOMER',
  'LAUNDRY_COLLECTED',
  'EN_ROUTE_TO_BRANCH',
  'ASSIGNED_FOR_DELIVERY',
  'OUT_FOR_DELIVERY'
];
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
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
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
  ASSIGNED_FOR_PICKUP: { statusLabel: 'Pickup Assigned', destination: 'customer', phase: 'A', routeColor: '#60A5FA', actionLabel: 'Start Pickup', destIcon: 'home-variant' },
  EN_ROUTE_TO_CUSTOMER: { statusLabel: 'En Route to Pickup', destination: 'customer', phase: 'A', routeColor: '#FBBF24', actionLabel: 'I have Collected the Laundry', destIcon: 'home-variant' },
  LAUNDRY_COLLECTED: { statusLabel: 'Laundry Collected', destination: 'branch', phase: 'A', routeColor: '#34D399', actionLabel: 'I have Arrived at Branch', destIcon: 'storefront' },
  EN_ROUTE_TO_BRANCH: { statusLabel: 'Heading to Branch', destination: 'branch', phase: 'A', routeColor: '#FBBF24', actionLabel: 'I have Arrived at Branch', destIcon: 'storefront' },

  ASSIGNED_FOR_DELIVERY: { statusLabel: 'Ready for Delivery', destination: 'customer', phase: 'B', routeColor: '#60A5FA', actionLabel: 'Start Delivery', destIcon: 'home-variant' },
  OUT_FOR_DELIVERY: { statusLabel: 'Out for Delivery', destination: 'customer', phase: 'B', routeColor: '#34D399', actionLabel: 'Confirm Delivery', destIcon: 'home-variant' },

  ORDER_RECEIVED: { statusLabel: 'Arrived at Branch', destination: null, phase: 'A', routeColor: '#34D399' },
  DELIVERED: { statusLabel: 'Delivered', destination: null, phase: 'B', routeColor: '#34D399' },
  COLLECTION_FAILED: { statusLabel: 'Task Failed', destination: null, phase: 'A', routeColor: '#EF4444' },
};

// ─── Phase Step Definitions (Image 3 Style) ─────────────────────────────────
const PICKUP_STEPS = [
  { key: 'ASSIGNED_FOR_PICKUP', label: 'Assigned' },
  { key: 'EN_ROUTE_TO_CUSTOMER', label: 'En Route' },
  { key: 'LAUNDRY_COLLECTED', label: 'Collected' },
  { key: 'ORDER_RECEIVED', label: 'At Branch' },
];

const DELIVERY_PHASE_STEPS = [
  { key: 'ORDER_RECEIVED', label: 'At Branch' },
  { key: 'READY', label: 'Ready' },
  { key: 'OUT_FOR_DELIVERY', label: 'Delivering' },
  { key: 'DELIVERED', label: 'Completed' },
];

const isCashCodPaymentMethod = (method) => {
  const normalized = String(method || '').trim().toLowerCase();
  return normalized.includes('cash') || normalized.includes('cod');
};

// ─── Component ────────────────────────────────────────────────────────────────
const DeliveryDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth(); // Auth context
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

            // Firestore real-time sync (write by deliveryId and trackingNumber for compatibility)
            const trackingDocIds = [
              delivery?.id ? String(delivery.id) : '',
              delivery?.trackingNumber ? String(delivery.trackingNumber) : '',
            ].filter(Boolean);
            for (const trackingDocId of trackingDocIds) {
              await setDoc(
                doc(db, 'delivery_tracking', trackingDocId),
                {
                  lat: coords.latitude,
                  lng: coords.longitude,
                  status: delivery.status,
                  timestamp: serverTimestamp(),
                  driverId: String(user?.id || ''),
                  orderId: String(delivery.id || ''),
                  trackingNumber: String(delivery.trackingNumber || ''),
                  driverName: String(user?.fullName || ''),
                },
                { merge: true }
              );
            }

            const shouldSyncBackend =
              now - lastBackendSyncRef.current >= GPS_BACKEND_SYNC_INTERVAL_MS ||
              movedMeters >= GPS_BACKEND_MIN_MOVE_METERS;

            if (!mockDelivery && shouldSyncBackend) {
              lastBackendSyncRef.current = now;
              driverOrders.updateLocation(delivery.id, coords).catch(() => { });
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
      const data = await driverOrders.getById(deliveryId);
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

    try {
      setUpdating(true);
      const actionOrderId = delivery?.orderId ?? delivery?.dbId ?? delivery?.id;
      if (!actionOrderId) {
        throw new Error('Unable to continue: missing order reference. Please refresh this task.');
      }
      await driverOrders[method](actionOrderId, args);
      // Backend returns JobOrderResponse, map to mobile
      const mapped = await driverOrders.getById(actionOrderId);
      setDelivery(mapped);

      setEtaInfo({ distance: null, duration: null }); // reset ETA on transition
      if (method === 'confirmDelivery' && mapped.status === 'DELIVERED') {
        Alert.alert('Delivery Completed', 'Great work. Returning to your dashboard.', [
          { text: 'OK', onPress: () => navigation.navigate('DriverTabs', { screen: 'Dashboard' }) },
        ]);
      }
    } catch (e) {
      const message = String(e?.message || '').trim();
      const friendlyMessage =
        /internal server error/i.test(message)
          ? 'Unable to process this action right now. Please refresh the task and try again.'
          : message;
      console.warn('[DeliveryDetail][ActionFailed]', { method, deliveryId: delivery?.id, message });
      Alert.alert('Action Failed', friendlyMessage || 'Something went wrong. Try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Same radius the backend enforces (see JobOrderService.GEOFENCE_RADIUS_METERS) — checked
  // here first purely for instant UX feedback without a network round-trip; the backend check
  // is the real gate and cannot be bypassed by a modified client.
  const GEOFENCE_RADIUS_METERS = 150;

  // Wraps handleAction for the three "I have arrived" confirmations, which require the driver
  // to actually be near the target address/branch. Blocks the action locally if location is
  // unavailable or too far, otherwise attaches the driver's current coords to the request so
  // the backend can enforce the same check server-side.
  const confirmWithLocation = (method, targetLabel, extraArgs = {}) => {
    if (!driverCoords) {
      Alert.alert(
        'Location Required',
        locationWarning || 'Your location could not be determined yet. Please enable location services and try again.'
      );
      return;
    }
    const target = getTargetCoords();
    const distance = target ? distanceMeters(driverCoords, target) : null;
    if (distance != null && distance > GEOFENCE_RADIUS_METERS) {
      Alert.alert(
        'Too Far to Confirm',
        `You are ${Math.round(distance)}m away from ${targetLabel}. Move within ${GEOFENCE_RADIUS_METERS}m to confirm.`
      );
      return;
    }
    handleAction(method, { ...extraArgs, latitude: driverCoords.latitude, longitude: driverCoords.longitude });
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getTargetCoords = () => {
    if (!delivery) return null;

    // Phase A: Driver heading to branch to pick up laundry
    const headingToBranchStatuses = new Set([
      'LAUNDRY_COLLECTED',
      'EN_ROUTE_TO_BRANCH',
    ]);

    // Phase B: Driver heading to customer
    const headingToCustomerStatuses = new Set([
      'ASSIGNED_FOR_PICKUP',
      'EN_ROUTE_TO_CUSTOMER',
      'ASSIGNED_FOR_DELIVERY',
      'OUT_FOR_DELIVERY',
    ]);

    const branchCoords = (delivery.branchLatitude && delivery.branchLongitude)
      ? { latitude: delivery.branchLatitude, longitude: delivery.branchLongitude }
      : derivedBranchCoords;
    const customerCoords = (delivery.deliveryLatitude && delivery.deliveryLongitude)
      ? { latitude: delivery.deliveryLatitude, longitude: delivery.deliveryLongitude }
      : derivedCustomerCoords;

    if (headingToBranchStatuses.has(delivery.status) && branchCoords) {
      return branchCoords;
    }
    if (headingToCustomerStatuses.has(delivery.status) && customerCoords) {
      return customerCoords;
    }
    // Fallback: show branch first (most orders start there)
    if (branchCoords) return branchCoords;
    if (customerCoords) return customerCoords;
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

  const normalizePhone = (value) => {
    // Keep numbers and + sign, but remove other characters
    const raw = String(value || '').replace(/[^0-9+]/g, '');
    // Ensure it starts with + or 0, or has digits
    return raw && /^\d|^\+/.test(raw) ? raw : '';
  };

  const callCustomer = async () => {
    const rawPhone = delivery?.contactPhone || delivery?.customerPhone;
    if (!rawPhone) {
      Alert.alert('No Phone Number', 'Customer contact number is not provided.');
      return;
    }

    try {
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        Alert.alert('Invalid Number', 'The phone number format is not valid.');
        return;
      }

      // Format: convert leading 0 → +63 (Philippine numbers)
      let formattedPhone = phone;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+63' + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+63' + formattedPhone;
      }

      // NOTE: Skip Linking.canOpenURL for tel: — on Android it always returns false
      // unless CALL_PHONE permission is in the manifest. openURL always works on real devices.
      await Linking.openURL(`tel:${formattedPhone}`);
    } catch (error) {
      console.error('[callCustomer] Error:', error);
      // Last resort: show the number so they can dial manually
      const phone = normalizePhone(rawPhone);
      Alert.alert(
        'Open Dialer Manually',
        `Could not open dialer automatically.\nPlease call: ${phone}`,
        [{ text: 'OK' }]
      );
    }
  };

  const messageCustomer = async () => {
    const phone = normalizePhone(delivery?.contactPhone || delivery?.customerPhone);
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

  // ─── Step Tracker ────────────────────────────────────────────────
  const renderStepTracker = () => {
    const isPickupPhase = ['ASSIGNED_FOR_PICKUP', 'EN_ROUTE_TO_CUSTOMER', 'LAUNDRY_COLLECTED', 'EN_ROUTE_TO_BRANCH'].includes(delivery.status);
    const steps = isPickupPhase ? PICKUP_STEPS : DELIVERY_PHASE_STEPS;

    // Determine current index based on status
    let currentIdx = steps.findIndex(s => s.key === delivery.status);

    // Fallbacks for intermediate or external statuses
    if (currentIdx === -1) {
      if (delivery.status === 'EN_ROUTE_TO_BRANCH') currentIdx = 2; // "Collected" or "En Route"
      if (['WASHING', 'DRYING'].includes(delivery.status)) currentIdx = 0; // "At Branch"
      if (delivery.status === 'ASSIGNED_FOR_DELIVERY') currentIdx = 1; // "Ready"
    }

    const isCompleted = delivery.status === 'DELIVERED';

    return (
      <View style={styles.premiumStepTracker}>
        {steps.map((step, idx) => {
          const done = isCompleted ? true : idx < currentIdx;
          const active = !isCompleted && idx === currentIdx;
          return (
            <View key={step.key} style={styles.premiumStepItem}>
              <View style={styles.stepIndicatorCol}>
                <View style={[styles.stepDotPremium, done && styles.stepDotDonePremium, active && styles.stepDotActivePremium]}>
                  {done ? <Ionicons name="checkmark" size={10} color="#FFF" /> : null}
                </View>
                {idx < steps.length - 1 && (
                  <View style={[styles.stepConnectorPremium, done && styles.stepConnectorDonePremium]} />
                )}
              </View>
              <Text style={[styles.stepLabelPremium, done && styles.stepLabelDonePremium, active && styles.stepLabelActivePremium]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // ─── Bottom Sheet Content per State ───────────────────────────────────────
  const renderSheetContent = () => {
    if (!delivery) return null;
    const { status, customerName, contactName, customerPhone, deliveryAddress, branchAddress, branchName } = delivery;
    const cfg = STATE_CONFIG[status] || STATE_CONFIG['COLLECTION_FAILED'];

    // ── COMMON UI BLOCKS ───────────────────────────────────────────────────
    const CustomerCard = () => (
      <View style={styles.premiumProfileCard}>
        <View style={styles.profileAvatarLarge}>
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>
        <View style={styles.profileInfoMain}>
          <Text style={styles.profileSubLabel}>Person to Meet</Text>
          <Text style={styles.profileNameMain}>{contactName || customerName}</Text>
          <Text style={styles.profileAddressMain} numberOfLines={2}>{deliveryAddress}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.etaBadgeSmall}>
              <Ionicons name="navigate" size={12} color={colors.primary} />
              <Text style={styles.etaBadgeTextSmall}>{etaInfo.distance || 'Calculating...'}</Text>
            </View>
            <View style={styles.etaBadgeSmall}>
              <Ionicons name="time" size={12} color={colors.primary} />
              <Text style={styles.etaBadgeTextSmall}>{etaInfo.duration ? `${etaInfo.duration} min` : 'Getting ETA...'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.callBtnPill} onPress={callCustomer}>
          <Ionicons name="call" size={16} color="#FFF" />
          <Text style={styles.callBtnTextPill}>Call</Text>
        </TouchableOpacity>
      </View>
    );

    const isPhaseB = cfg.phase === 'B';

    const LogisticsLegs = () => (
      <View style={styles.logisticsCard}>
        {/* Origin Leg */}
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: isPhaseB ? '#7C3AED' : colors.primary }]} />
          <View style={styles.legContent}>
            <Text style={styles.legLabel}>PICKUP FROM</Text>
            <Text style={styles.legName}>{isPhaseB ? branchName : contactName}</Text>
            <Text style={styles.legAddress}>{isPhaseB ? branchAddress : deliveryAddress}</Text>
          </View>
        </View>

        <View style={styles.legConnector} />

        {/* Destination Leg */}
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: isPhaseB ? colors.primary : '#7C3AED' }]} />
          <View style={styles.legContent}>
            <Text style={styles.legLabel}>DROP-OFF AT</Text>
            <Text style={styles.legName}>{isPhaseB ? contactName : branchName}</Text>
            <Text style={styles.legAddress}>{isPhaseB ? deliveryAddress : branchAddress}</Text>
          </View>
        </View>
      </View>
    );

    if (status === 'DELIVERED') {
      return (
        <View style={styles.centerPanel}>
          <MaterialCommunityIcons name="check-decagram" size={60} color={colors.success} />
          <Text style={styles.doneTitle}>Delivery Complete!</Text>
          <Text style={styles.doneSub}>Laundry successfully delivered to {customerName}.</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Tasks</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'COLLECTION_FAILED') {
      return (
        <View style={styles.centerPanel}>
          <MaterialCommunityIcons name="alert-circle" size={60} color={colors.error} />
          <Text style={styles.doneTitle}>Delivery Failed</Text>
          <Text style={styles.doneSub}>This order has been marked as failed. Return laundry to branch.</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Tasks</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.sheetInner}>
        <View style={styles.sheetHeaderRow}>
          <Text style={styles.sheetTitle}>{cfg.statusLabel}</Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.phase === 'A' ? '#F0FDF4' : '#EFF6FF' }]}>
            <Text style={[styles.statusBadgeText, { color: cfg.phase === 'A' ? '#166534' : '#1E40AF' }]}>
              {cfg.phase === 'A' ? 'Leg 1: Pickup' : 'Leg 2: Delivery'}
            </Text>
          </View>
        </View>

        {renderStepTracker()}

        <CustomerCard />

        <View style={styles.sectionDivider} />

        <LogisticsLegs />

        {/* Order Info Section */}
        <View style={styles.orderInfoCard}>
          <Text style={styles.orderInfoTitle}>ORDER INFO</Text>
          <View style={styles.orderInfoRow}>
            <Text style={styles.orderInfoLabel}>Schedule</Text>
            <Text style={styles.orderInfoValue}>
              {delivery.scheduleDate || '—'}
              {delivery.scheduleTime ? `  ${delivery.scheduleTime}` : ''}
            </Text>
          </View>
          <View style={styles.orderInfoRow}>
            <Text style={styles.orderInfoLabel}>Payment</Text>
            <Text style={styles.orderInfoValue}>
              {delivery.paymentMethod || '—'}
              {delivery.paymentStatus ? `  ·  ${delivery.paymentStatus}` : ''}
            </Text>
          </View>
          {!!delivery.customerPhone && (
            <View style={styles.orderInfoRow}>
              <Text style={styles.orderInfoLabel}>Customer Phone</Text>
              <Text style={styles.orderInfoValue}>{delivery.customerPhone}</Text>
            </View>
          )}
        </View>

        {isCashCodPaymentMethod(delivery.paymentMethod) && !delivery.isPaid && (
          <View style={styles.codCard}>
            <Text style={styles.inputLabel}>CASH COLLECTION REQUIRED</Text>
            <Text style={styles.codAmountText}>PHP {(delivery.amountToCollect ?? delivery.finalPrice ?? delivery.amount)?.toLocaleString()}</Text>
          </View>
        )}
      </View>
    );
  };

  // ─── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.fullDark}>
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text style={styles.darkLoadText}>Loading task details...</Text>
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
  const cfg = STATE_CONFIG[delivery.status] || STATE_CONFIG['COLLECTION_FAILED'];
  const targetCoords = getTargetCoords();

  const stickyAction = (() => {
    switch (delivery.status) {
      case 'ASSIGNED_FOR_PICKUP':
        return {
          label: 'Start Pickup',
          color: colors.primary,
          disabled: updating,
          onComplete: () => handleAction('startPickupLeg'),
        };
      case 'EN_ROUTE_TO_CUSTOMER':
        return {
          label: 'I have Collected the Laundry',
          color: '#7C3AED',
          disabled: updating,
          onComplete: () => confirmWithLocation('confirmLaundryCollected', "the customer's address"),
        };
      case 'LAUNDRY_COLLECTED':
      case 'EN_ROUTE_TO_BRANCH':
        return {
          label: 'I have Arrived at Branch',
          color: colors.success,
          disabled: updating,
          onComplete: () => confirmWithLocation('confirmArrivedAtBranch', 'the branch'),
        };
      case 'ASSIGNED_FOR_DELIVERY':
        return {
          label: 'Start Delivery',
          color: colors.primary,
          disabled: updating,
          onComplete: () => handleAction('startDeliveryLeg'),
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'Confirm Delivery',
          color: colors.success,
          disabled: updating,
          onComplete: () => {
            const isCash = isCashCodPaymentMethod(delivery.paymentMethod) && !delivery.isPaid;
            if (isCash) {
              const collectAmt = delivery.amountToCollect ?? 0;
              Alert.alert(
                'Collect Payment',
                collectAmt > 0
                  ? `Did you collect PHP ${collectAmt.toLocaleString()} from ${delivery.customerName}?`
                  : `Confirm cash collection from ${delivery.customerName}? (Final amount unavailable — verify with branch.)`,
                [
                  { text: 'Not yet', style: 'cancel' },
                  { text: 'Yes, Collected', onPress: () => confirmWithLocation('confirmDelivery', "the customer's address", { codCollected: true }) }
                ]
              );
            } else {
              confirmWithLocation('confirmDelivery', "the customer's address", { codCollected: false });
            }
          },
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
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={false}
      >
        {/* Driver Marker */}
        {driverCoords && (
          <Marker
            coordinate={driverCoords}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={driverCoords.heading || 0}
          >
            <View style={styles.driverWrap}>
              <RNAnimated.View
                style={[
                  styles.driverPulse,
                  { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
                ]}
              />
              <View style={styles.driverCore}>
                <MaterialCommunityIcons name="car-back" size={20} color={colors.primary} />
              </View>
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {targetCoords && driverCoords && (
          <MapViewDirections
            origin={driverCoords}
            destination={targetCoords}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={4}
            strokeColor={cfg.routeColor || colors.primary}
            lineDashPattern={[0]}
            precision="high"
            mode="DRIVING"
            onReady={(result) => {
              setEtaInfo({
                distance: result.distance.toFixed(1),
                duration: Math.ceil(result.duration),
              });
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { right: 50, bottom: 100, left: 50, top: 250 },
              });
            }}
          />
        )}

        {/* Branch Marker (Always Visible) */}
        {delivery.branchLatitude && (
          <Marker
            coordinate={{ latitude: delivery.branchLatitude, longitude: delivery.branchLongitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pinWrap}>
              <View style={[styles.destPinOuter, { borderColor: '#7C3AED' }]}>
                <View style={[styles.destPinInner, { backgroundColor: '#7C3AED' }]}>
                  <MaterialCommunityIcons name="storefront" size={18} color="#FFF" />
                </View>
              </View>
              <View style={[styles.destPinArrow, { borderTopColor: '#7C3AED' }]} />
            </View>
          </Marker>
        )}

        {/* Customer Marker (Always Visible) */}
        {delivery.deliveryLatitude && (
          <Marker
            coordinate={{ latitude: delivery.deliveryLatitude, longitude: delivery.deliveryLongitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pinWrap}>
              <View style={[styles.destPinOuter, { borderColor: colors.primary }]}>
                <View style={[styles.destPinInner, { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name="home-variant" size={18} color="#FFF" />
                </View>
              </View>
              <View style={[styles.destPinArrow, { borderTopColor: colors.primary }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── HEADER OVERLAY ───────────────────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerOverlay}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerCircle} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color="#0D1B2A" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{delivery?.trackingNumber || 'Task Details'}</Text>

            <TouchableOpacity style={styles.headerCircle} onPress={openExternalNav}>
              <Ionicons name="navigate" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium Navigation Card */}
        {targetCoords && etaInfo.duration && (
          <View style={styles.navInstructionCard}>
            <View style={styles.navIconBox}>
              <MaterialCommunityIcons name="navigation-variant" size={24} color="#FFF" />
            </View>
            <View style={styles.navTextBox}>
              <Text style={styles.navSubText}>Heading to {cfg.destination === 'branch' ? 'Branch' : 'Customer'}</Text>
              <Text style={styles.navMainText}>
                {etaInfo.duration} min • {etaInfo.distance} km
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── BOTTOM SHEET ─────────────────────────────────────────────────── */}
      <RNAnimated.View
        style={[
          styles.bottomSheet,
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
        {!targetCoords && !['DELIVERED', 'COLLECTION_FAILED'].includes(delivery.status) && (
          <View style={styles.noGpsBar}>
            <Ionicons name="warning-outline" size={13} color="#92400E" />
            <Text style={styles.noGpsText}>
              Location data unavailable for navigation.
            </Text>
          </View>
        )}

        {/* Driver's own GPS/permission warning — previously tracked in state but never
            shown, so a denied permission or unresolved GPS fix looked identical to "app is
            broken" (no driver marker, no route, confirm-arrival silently unavailable). */}
        {!!locationWarning && !['DELIVERED', 'COLLECTION_FAILED'].includes(delivery.status) && (
          <View style={styles.noGpsBar}>
            <Ionicons name="warning-outline" size={13} color="#92400E" />
            <Text style={styles.noGpsText}>{locationWarning}</Text>
          </View>
        )}

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
            stickyAction && styles.sheetScrollWithStickyAction,
          ]}
        >
          {renderSheetContent()}
        </ScrollView>
        {stickyAction && (
          <View style={[styles.stickyActionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
          <Text style={styles.updatingText}>Syncing...</Text>
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
  destPinOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  destPinInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destPinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.9)',
    marginTop: -1,
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
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: 12,
  },
  headerOverlay: {
    backgroundColor: '#FFF',
    paddingTop: 45, // approx insets.top
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
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

  // Premium Navigation Card
  navInstructionCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  navIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextBox: {
    marginLeft: 14,
    flex: 1,
  },
  navSubText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  navMainText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D1B2A',
    marginTop: 2,
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
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  codAmountText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 4,
  },
  orderInfoCard: {
    backgroundColor: '#F5F8FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F5',
  },
  orderInfoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8B9CB8',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  orderInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B9CB8',
  },
  orderInfoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A2332',
    maxWidth: '60%',
    textAlign: 'right',
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
  premiumProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  profileSubLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1B2A',
    marginTop: 1,
  },
  profilePhone: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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

  profileAvatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfoMain: {
    flex: 1,
    marginLeft: 15,
  },
  profileNameMain: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  profileAddressMain: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  etaBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  etaBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  callBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
  },
  callBtnTextPill: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  logisticsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  legItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  legDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  legConnector: {
    width: 2,
    height: 25,
    backgroundColor: '#E2E8F0',
    marginLeft: 4,
    marginVertical: 4,
  },
  legContent: {
    marginLeft: 15,
    flex: 1,
  },
  legLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  legName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 1,
  },
  legAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginVertical: 16,
  },

  // Premium Step Tracker (Image 3 style)
  premiumStepTracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    marginBottom: 10,
  },
  premiumStepItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepIndicatorCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    width: '100%',
  },
  stepDotPremium: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  stepDotDonePremium: {
    backgroundColor: colors.success,
  },
  stepDotActivePremium: {
    backgroundColor: colors.primary,
    transform: [{ scale: 1.1 }],
  },
  stepConnectorPremium: {
    position: 'absolute',
    left: '50%',
    top: 11,
    width: '100%',
    height: 3,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },
  stepConnectorDonePremium: {
    backgroundColor: colors.success,
  },
  stepLabelPremium: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  stepLabelDonePremium: {
    color: colors.success,
  },
  stepLabelActivePremium: {
    color: colors.primary,
    fontWeight: '900',
  },
});

export default DeliveryDetailScreen;


