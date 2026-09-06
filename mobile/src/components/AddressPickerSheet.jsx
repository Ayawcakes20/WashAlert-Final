/**
 * AddressPickerSheet.jsx
 * Grab/FoodPanda-style address picker bottom sheet.
 * Three-panel flow:
 *   1. List panel  — search box + "Current Location" + saved addresses list
 *   2. Map panel   — full-screen map for pin placement
 *   3. Confirm panel — address details form (floor/unit, contact name, phone)
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import { MapView, Marker, PROVIDER_GOOGLE } from './SafeMap';
import { colors } from '../theme/colors';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_API_KEY_SOURCE,
  NATIVE_GOOGLE_MAPS_API_KEY,
} from '../config/env';
import {
  loadSavedAddresses,
  saveSavedAddresses,
} from '../services/savedAddresses';

// ─── helpers ────────────────────────────────────────────────────────────────

// Same name allowlist as RegisterScreen/EditProfileScreen — letters, spaces, and name
// punctuation only, stripped as the user types rather than only rejected at submit.
const NAME_DISALLOWED_RE = /[^a-zA-Z\s'.-]/g;
const MAX_LEN = { unitFloor: 40, contactName: 60, phone: 11 };

const formatAddressFromGeo = (geo = {}, lat, lng) => {
  const parts = [geo.name, geo.street, geo.subregion, geo.city, geo.region].filter(Boolean);
  return parts.length ? parts.join(', ') : `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
};
const DEFAULT_REGION = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};
const DEFAULT_COORDINATE = {
  latitude: DEFAULT_REGION.latitude,
  longitude: DEFAULT_REGION.longitude,
};
const METRO_MANILA_TEST_PIN = {
  latitude: 14.5995,
  longitude: 120.9842,
};
const PH_BOUNDS = {
  minLatitude: 4,
  maxLatitude: 22,
  minLongitude: 116,
  maxLongitude: 127,
};
const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const isWithinPhilippinesBounds = ({ latitude, longitude }) =>
  latitude >= PH_BOUNDS.minLatitude &&
  latitude <= PH_BOUNDS.maxLatitude &&
  longitude >= PH_BOUNDS.minLongitude &&
  longitude <= PH_BOUNDS.maxLongitude;
const sanitizeCoordinate = (coord, fallbackCoordinate = null) => {
  const latitude = toFiniteNumber(coord?.latitude);
  const longitude = toFiniteNumber(coord?.longitude);
  const fallback = fallbackCoordinate
    ? {
        latitude: toFiniteNumber(fallbackCoordinate.latitude) ?? DEFAULT_COORDINATE.latitude,
        longitude: toFiniteNumber(fallbackCoordinate.longitude) ?? DEFAULT_COORDINATE.longitude,
      }
    : null;
  if (latitude == null || longitude == null) return fallback;

  const nextCoordinate = { latitude, longitude };
  if (!isWithinPhilippinesBounds(nextCoordinate)) return fallback;
  return nextCoordinate;
};
const sanitizeDelta = (value, fallback) => {
  const parsed = toFiniteNumber(value);
  return parsed && parsed > 0 ? parsed : fallback;
};
const sanitizeRegion = (region, fallbackCoordinate = DEFAULT_COORDINATE) => {
  const fallback = sanitizeCoordinate(fallbackCoordinate, DEFAULT_COORDINATE) || DEFAULT_COORDINATE;
  const coord = sanitizeCoordinate(region, fallback) || fallback;
  return {
    latitude: coord.latitude,
    longitude: coord.longitude,
    latitudeDelta: sanitizeDelta(region?.latitudeDelta, DEFAULT_REGION.latitudeDelta),
    longitudeDelta: sanitizeDelta(region?.longitudeDelta, DEFAULT_REGION.longitudeDelta),
  };
};
const logMapLocationDebug = (source, region, coordinate) => {
  if (!__DEV__) return;
  console.info('[AddressPicker] LOCATION SOURCE:', source);
  console.info('[AddressPicker] MAP REGION:', region);
  console.info('[AddressPicker] MARKER COORDINATE:', coordinate);
};

const LABEL_ICONS = {
  Home:   { name: 'home-outline', color: '#2EC4B6' },
  Office: { name: 'briefcase-outline', color: '#3B82F6' },
  Other:  { name: 'location-outline', color: '#F4A72A' },
};

const getLabelIcon = (label = '') => {
  if (!label) return LABEL_ICONS.Other;
  const key = Object.keys(LABEL_ICONS).find((k) =>
    label.toLowerCase().includes(k.toLowerCase())
  );
  return LABEL_ICONS[key] || LABEL_ICONS.Other;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Props:
 *   visible       boolean
 *   title         string — e.g. "Set Pickup Address"
 *   onConfirm     (addressObj) => void
 *                   addressObj: { address, unitFloor, contactName, phone,
 *                                 latitude, longitude, label, saveThis }
 *   onClose       () => void
 *   initialValue  addressObj | null
 */
const AddressPickerSheet = ({
  visible,
  title = 'Set Address',
  onConfirm,
  onClose,
  initialValue,
  fallbackCoordinate = null,
}) => {
  const insets = useSafeAreaInsets();
  // panel: 'list' | 'map' | 'confirm'
  const [panel, setPanel] = useState('list');

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);

  // Map state
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const [pinnedCoords, setPinnedCoords] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const [mapLoadError, setMapLoadError] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  // Confirm form state
  const [unitFloor, setUnitFloor] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [saveLabel, setSaveLabel] = useState('');
  const [saveThis, setSaveThis] = useState(false);

  const autocompleteRef = useRef(null);
  const mapLoadTimerRef = useRef(null);
  const fallbackLatitude = toFiniteNumber(fallbackCoordinate?.latitude);
  const fallbackLongitude = toFiniteNumber(fallbackCoordinate?.longitude);
  const safeFallbackCoordinate = React.useMemo(
    () =>
      sanitizeCoordinate(
        { latitude: fallbackLatitude, longitude: fallbackLongitude },
        DEFAULT_COORDINATE
      ) || DEFAULT_COORDINATE,
    [fallbackLatitude, fallbackLongitude]
  );
  const fallbackRegion = React.useMemo(
    () => sanitizeRegion(safeFallbackCoordinate, safeFallbackCoordinate),
    [safeFallbackCoordinate]
  );

  // ── Load saved addresses when modal opens ──────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setPanel('list');
    setMapLoadError('');
    loadSavedAddresses().then(setSavedAddresses).catch(() => setSavedAddresses([]));

    // Pre-populate confirm fields if editing
    if (initialValue) {
      setUnitFloor(initialValue.unitFloor || '');
      setContactName(initialValue.contactName || '');
      setPhone(initialValue.phone || '');
      const coords = sanitizeCoordinate(initialValue, null);
      if (coords) {
        const nextRegion = sanitizeRegion({ ...fallbackRegion, ...coords }, safeFallbackCoordinate);
        setPinnedCoords(coords);
        setMapRegion(nextRegion);
        logMapLocationDebug('INITIAL_VALUE', nextRegion, coords);
      } else {
        setPinnedCoords(safeFallbackCoordinate);
        setMapRegion(fallbackRegion);
        logMapLocationDebug('FALLBACK_REGION_ON_INIT', fallbackRegion, safeFallbackCoordinate);
      }
      setResolvedAddress(initialValue.address || '');
    } else {
      setUnitFloor('');
      setContactName('');
      setPhone('');
      setPinnedCoords(safeFallbackCoordinate);
      setResolvedAddress('');
      setMapRegion(fallbackRegion);
      logMapLocationDebug(
        fallbackCoordinate ? 'BRANCH_FALLBACK' : 'METRO_MANILA_DEFAULT',
        fallbackRegion,
        safeFallbackCoordinate
      );
    }
  }, [visible, initialValue, fallbackCoordinate, fallbackRegion, safeFallbackCoordinate]);

  useEffect(() => {
    if (!visible || panel !== 'map') return;
    if (__DEV__) {
      console.info(`GOOGLE MAPS KEY LOADED: ${GOOGLE_MAPS_API_KEY ? 'YES' : 'NO'}`);
      if (
        GOOGLE_MAPS_API_KEY &&
        NATIVE_GOOGLE_MAPS_API_KEY &&
        GOOGLE_MAPS_API_KEY !== NATIVE_GOOGLE_MAPS_API_KEY
      ) {
        console.warn(
          `[AddressPicker] JS/native maps key source mismatch (source: ${GOOGLE_MAPS_API_KEY_SOURCE}). ` +
            'Ensure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY and native googleMaps key are aligned for this build.'
        );
      }
    }
    setIsMapReady(false);
    setIsMapLoaded(false);
    setMapLoadFailed(false);

    if (!GOOGLE_MAPS_API_KEY) {
      setMapLoadError('Map failed to load. Please check Google Maps API key or internet connection.');
      setMapLoadFailed(true);
      return;
    }

    if (mapLoadTimerRef.current) {
      clearTimeout(mapLoadTimerRef.current);
      mapLoadTimerRef.current = null;
    }

    setMapLoadError('');

    return () => {
      if (mapLoadTimerRef.current) {
        clearTimeout(mapLoadTimerRef.current);
        mapLoadTimerRef.current = null;
      }
    };
  }, [visible, panel, mapKey]);

  useEffect(() => {
    if (!visible || panel !== 'map' || !GOOGLE_MAPS_API_KEY) return;
    const safeRegion = sanitizeRegion(mapRegion, safeFallbackCoordinate);
    const safeMarker = sanitizeCoordinate(pinnedCoords, safeFallbackCoordinate) || safeFallbackCoordinate;
    if (
      safeRegion.latitude !== mapRegion.latitude ||
      safeRegion.longitude !== mapRegion.longitude
    ) {
      setMapRegion(safeRegion);
    }
    if (
      !pinnedCoords ||
      safeMarker.latitude !== pinnedCoords.latitude ||
      safeMarker.longitude !== pinnedCoords.longitude
    ) {
      setPinnedCoords(safeMarker);
    }
    logMapLocationDebug(pinnedCoords ? 'EXISTING_PIN' : 'MAP_PANEL_OPEN_FALLBACK', safeRegion, safeMarker);
  }, [visible, panel, mapRegion, pinnedCoords, safeFallbackCoordinate]);

  useEffect(() => {
    if (panel !== 'map' || pinnedCoords) return;
    const fallbackCoord = sanitizeCoordinate(mapRegion, safeFallbackCoordinate);
    if (fallbackCoord) {
      setPinnedCoords(fallbackCoord);
      logMapLocationDebug('MAP_PANEL_FALLBACK_PIN', sanitizeRegion(mapRegion, safeFallbackCoordinate), fallbackCoord);
    }
  }, [panel, pinnedCoords, mapRegion, safeFallbackCoordinate]);

  // ── Sync address string from coords ──────────────────────────────────────
  const resolveFromCoords = async (lat, lng) => {
    try {
      setResolving(true);
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const first = result?.[0] || {};
      setResolvedAddress(formatAddressFromGeo(first, lat, lng));
    } catch {
      setResolvedAddress(`Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    } finally {
      setResolving(false);
    }
  };

  // ── Use current GPS location ──────────────────────────────────────────
  const handleCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location access in your phone settings to use your current location.');
        return;
      }

      // Check if location services (GPS) are enabled on device
      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesEnabled) {
        Alert.alert(
          'GPS / Location Disabled',
          'Please turn on Location / GPS in your phone settings and try again.'
        );
        return;
      }

      // Try last known location first for speed
      let loc = await Location.getLastKnownPositionAsync({ maxAge: 120000 }).catch(() => null);

      if (!loc || !loc.coords) {
        // Fallback to getCurrentPositionAsync with 8s timeout
        loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Location request timed out')), 8000)),
        ]).catch(async () => {
          // Retry with Lowest accuracy for fast cell tower / wifi fix
          return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        });
      }

      if (!loc || !loc.coords) {
        Alert.alert('Location Unavailable', 'Unable to retrieve your location. Please ensure GPS is enabled or use "Pin on map".');
        return;
      }

      const { latitude, longitude } = loc.coords;
      const coords = sanitizeCoordinate({ latitude, longitude }, safeFallbackCoordinate);
      if (!coords) {
        Alert.alert('Error', 'Unable to parse current location coordinates.');
        return;
      }

      const nextRegion = sanitizeRegion({ ...mapRegion, ...coords }, safeFallbackCoordinate);
      setPinnedCoords(coords);
      setMapRegion(nextRegion);
      logMapLocationDebug('CURRENT_LOCATION', nextRegion, coords);
      await resolveFromCoords(coords.latitude, coords.longitude);
      setPanel('confirm');
    } catch (err) {
      console.warn('[AddressPicker] handleCurrentLocation error:', err);
      Alert.alert(
        'Location Unavailable',
        'Could not get your current GPS position. Please make sure Location/GPS is turned ON in your phone settings, or use "Pin on map".'
      );
    }
  };

  // ── Autocomplete selection ────────────────────────────────────────────
  const handlePlaceSelect = (data, details) => {
    if (!details?.geometry?.location) return;
    const { lat, lng } = details.geometry.location;
    const coords = sanitizeCoordinate({ latitude: lat, longitude: lng }, safeFallbackCoordinate);
    if (!coords) return;
    const nextRegion = sanitizeRegion({ ...mapRegion, ...coords }, safeFallbackCoordinate);
    setPinnedCoords(coords);
    setMapRegion(nextRegion);
    setResolvedAddress(data.description);
    logMapLocationDebug('AUTOCOMPLETE_SELECTION', nextRegion, coords);
    setPanel('map');
  };

  // ── Select a previously saved address ────────────────────────────────
  const handleSelectSaved = (item) => {
    setResolvedAddress(item.address);
    if (item.latitude != null && item.longitude != null) {
      const coords = sanitizeCoordinate(item, null);
      if (coords) {
        const nextRegion = sanitizeRegion({ ...mapRegion, ...coords }, safeFallbackCoordinate);
        setPinnedCoords(coords);
        setMapRegion(nextRegion);
        logMapLocationDebug('SAVED_ADDRESS_COORDS', nextRegion, coords);

        // A saved address already carries everything onConfirm needs (address, coords,
        // unit/floor, contact name, phone), so use it directly instead of pushing the
        // customer back through the map panel and then the "Address Details" form to
        // re-enter details they already saved. saveThis is false here because this entry
        // is already in the saved list — re-saving is what was appending a duplicate
        // "Home" row on every booking.
        onConfirm({
          address: item.address,
          unitFloor: (item.unitFloor || '').trim(),
          contactName: (item.contactName || '').trim(),
          phone: (item.phone || '').trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: (item.label || 'Saved').trim(),
          saveThis: false,
        });
        return;
      }
      logMapLocationDebug('SAVED_ADDRESS_INVALID_COORDS', fallbackRegion, safeFallbackCoordinate);
      setPanel('map');
    } else {
      // try geocoding
      Location.geocodeAsync(item.address)
        .then((res) => {
          const first = res?.[0];
          if (first?.latitude) {
            const coords = sanitizeCoordinate(
              { latitude: first.latitude, longitude: first.longitude },
              safeFallbackCoordinate
            );
            if (!coords) return;
            const nextRegion = sanitizeRegion({ ...mapRegion, ...coords }, safeFallbackCoordinate);
            setPinnedCoords(coords);
            setMapRegion(nextRegion);
            logMapLocationDebug('SAVED_ADDRESS_GEOCODE', nextRegion, coords);
          }
        })
        .catch(() => {})
        .finally(() => setPanel('map'));
    }
    setUnitFloor(item.unitFloor || '');
    setContactName(item.contactName || '');
    setPhone(item.phone || '');
  };

  // ── Map press / drag end ──────────────────────────────────────────────
  const handleMapPress = async (event) => {
    const coord = sanitizeCoordinate(event?.nativeEvent?.coordinate, safeFallbackCoordinate);
    if (!coord) return;
    const nextRegion = sanitizeRegion({ ...mapRegion, ...coord }, safeFallbackCoordinate);
    setPinnedCoords(coord);
    setMapRegion(nextRegion);
    logMapLocationDebug('MAP_PRESS', nextRegion, coord);
    await resolveFromCoords(coord.latitude, coord.longitude);
  };

  const handleMarkerDrag = async (event) => {
    const coord = sanitizeCoordinate(event?.nativeEvent?.coordinate, safeFallbackCoordinate);
    if (!coord) return;
    const nextRegion = sanitizeRegion({ ...mapRegion, ...coord }, safeFallbackCoordinate);
    setPinnedCoords(coord);
    setMapRegion(nextRegion);
    logMapLocationDebug('MARKER_DRAG', nextRegion, coord);
    await resolveFromCoords(coord.latitude, coord.longitude);
  };

  const handleMapReady = () => {
    setIsMapReady(true);
    if (__DEV__) console.info('[AddressPicker] onMapReady fired');
    setMapLoadError('');
    setMapLoadFailed(false);
    if (mapLoadTimerRef.current) {
      clearTimeout(mapLoadTimerRef.current);
      mapLoadTimerRef.current = null;
    }
    mapLoadTimerRef.current = setTimeout(() => {
      setMapLoadFailed(true);
      setMapLoadError(
        'Google Map tiles failed to load. Check Maps SDK for Android, billing, or API key restrictions.'
      );
    }, 8000);
    logMapLocationDebug(
      'MAP_READY',
      sanitizeRegion(mapRegion, safeFallbackCoordinate),
      sanitizeCoordinate(pinnedCoords, safeFallbackCoordinate)
    );
  };

  const handleMapLoaded = () => {
    setIsMapLoaded(true);
    if (__DEV__) console.info('[AddressPicker] onMapLoaded fired');
    setMapLoadError('');
    setMapLoadFailed(false);
    if (mapLoadTimerRef.current) {
      clearTimeout(mapLoadTimerRef.current);
      mapLoadTimerRef.current = null;
    }
    logMapLocationDebug(
      'MAP_LOADED',
      sanitizeRegion(mapRegion, safeFallbackCoordinate),
      sanitizeCoordinate(pinnedCoords, safeFallbackCoordinate)
    );
  };

  const handleMapError = (event) => {
    const message =
      event?.nativeEvent?.message ||
      event?.nativeEvent?.error ||
      event?.message ||
      'Unknown map error';
    if (__DEV__) console.error('[AddressPicker] onError fired:', message);
    setMapLoadFailed(true);
    setMapLoadError(
      'Google Map tiles failed to load. Check Maps SDK for Android, billing, or API key restrictions.'
    );
  };

  const handleRetryMapLoad = () => {
    if (mapLoadTimerRef.current) {
      clearTimeout(mapLoadTimerRef.current);
      mapLoadTimerRef.current = null;
    }
    setMapLoadError('');
    setMapLoadFailed(false);
    setIsMapReady(false);
    setIsMapLoaded(false);
    setMapKey((prev) => prev + 1);
  };

  // ── Confirm → fire callback ───────────────────────────────────────────
  const handleConfirm = async () => {
    if (!resolvedAddress || !pinnedCoords) {
      Alert.alert('No Address', 'Please pin a location first.');
      return;
    }
    if (!saveLabel || !saveLabel.trim()) {
      Alert.alert('Address Type Required', 'Please select whether this is your Home, Office, or Other address.');
      return;
    }

    // Optionally save to saved addresses
    if (saveThis && saveLabel.trim()) {
      const normalize = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
      // Update the matching entry instead of always appending. Previously this pushed a new
      // row every time, so re-booking to the same place produced repeated identical "Home"
      // entries in the saved list (visible in the picker as duplicate rows).
      const existingIndex = savedAddresses.findIndex(
        (a) => normalize(a.address) === normalize(resolvedAddress)
          && normalize(a.label) === normalize(saveLabel)
      );
      const existing = existingIndex >= 0 ? savedAddresses[existingIndex] : null;
      const entry = {
        id: existing?.id ?? String(Date.now()),
        label: saveLabel.trim(),
        address: resolvedAddress,
        unitFloor: unitFloor.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        latitude: pinnedCoords.latitude,
        longitude: pinnedCoords.longitude,
        isDefault: existing?.isDefault ?? savedAddresses.length === 0,
      };
      const updated = existingIndex >= 0
        ? savedAddresses.map((a, i) => (i === existingIndex ? entry : a))
        : [...savedAddresses, entry];
      await saveSavedAddresses(updated).catch(() => {});
    }

    onConfirm({
      address: resolvedAddress,
      unitFloor: unitFloor.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      latitude: pinnedCoords.latitude,
      longitude: pinnedCoords.longitude,
      label: saveLabel.trim() || 'Pinned',
      saveThis,
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── LIST PANEL ───────────────────────────────────────────── */}
        {panel === 'list' && (
          <View style={styles.flex}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>{title}</Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Search */}
            <View style={styles.searchWrapper}>
              <GooglePlacesAutocomplete
                ref={autocompleteRef}
                placeholder="Search street, neighborhood, landmark…"
                textInputProps={{ placeholderTextColor: colors.textTertiary }}
                onPress={handlePlaceSelect}
                query={{
                  key: GOOGLE_MAPS_API_KEY,
                  language: 'en',
                  components: 'country:ph',
                  types: 'geocode',
                }}
                minLength={2}
                debounce={300}
                fetchDetails={true}
                nearbyPlacesAPI="GooglePlacesSearch"
                enablePoweredByContainer={false}
                onFail={(err) => console.warn('[AddressPicker] autocomplete fail:', err)}
                styles={{
                  container: { flex: 0, zIndex: 99 },
                  textInputContainer: styles.autocompleteInputContainer,
                  textInput: styles.autocompleteInput,
                  listView: styles.autocompleteListView,
                  row: styles.autocompleteRow,
                  description: { fontSize: 13, color: colors.text },
                  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
                  poweredContainer: { display: 'none' },
                }}
                renderLeftButton={() => (
                  <Ionicons
                    name="search"
                    size={18}
                    color={colors.textSecondary}
                    style={{ alignSelf: 'center', marginHorizontal: 10 }}
                  />
                )}
              />
            </View>

            <ScrollView style={styles.listScroll} keyboardShouldPersistTaps="handled">
              {/* Current Location shortcut */}
              <TouchableOpacity style={styles.quickRow} onPress={handleCurrentLocation}>
                <View style={[styles.quickIcon, { backgroundColor: '#E0F7F5' }]}>
                  <Ionicons name="locate" size={18} color={colors.accent} />
                </View>
                <View style={styles.quickInfo}>
                  <Text style={styles.quickTitle}>Use current location</Text>
                  <Text style={styles.quickSub}>GPS — instant pin</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              <View style={styles.listDivider} />

              {/* Pin on Map manual */}
              <TouchableOpacity
                style={styles.quickRow}
                onPress={() => setPanel('map')}
              >
                <View style={[styles.quickIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="map-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.quickInfo}>
                  <Text style={styles.quickTitle}>Pin on map</Text>
                  <Text style={styles.quickSub}>Manually place a pin</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              {/* Saved Addresses */}
              {savedAddresses.length > 0 && (
                <>
                  <View style={styles.listDivider} />
                  <Text style={styles.savedSectionLabel}>Saved Addresses</Text>
                  {savedAddresses.map((item) => {
                    const iconCfg = getLabelIcon(item.label);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.savedRow}
                        onPress={() => handleSelectSaved(item)}
                      >
                        <View style={[styles.quickIcon, { backgroundColor: colors.surfaceVariant }]}>
                          <Ionicons name={iconCfg.name} size={18} color={iconCfg.color} />
                        </View>
                        <View style={styles.quickInfo}>
                          <View style={styles.savedLabelRow}>
                            <Text style={styles.savedLabel}>{item.label}</Text>
                            {item.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>}
                          </View>
                          <Text style={styles.savedAddr} numberOfLines={1}>{item.address}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        )}

        {/* ── MAP PANEL ────────────────────────────────────────────── */}
        {panel === 'map' && (
          <View style={styles.flex}>
            {/* Floating header */}
            <View style={styles.mapFloatingHeader}>
              <TouchableOpacity onPress={() => setPanel('list')} style={styles.mapBackBtn}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.mapHeaderText} numberOfLines={2}>
                Drag the pin or tap the map to adjust your exact location.
              </Text>
            </View>

            <MapView
              key={`address-map-${mapKey}`}
              style={styles.fullMap}
              provider={PROVIDER_GOOGLE}
              initialRegion={sanitizeRegion(mapRegion, safeFallbackCoordinate)}
              onMapReady={handleMapReady}
              onMapLoaded={handleMapLoaded}
              onError={handleMapError}
              onRegionChangeComplete={(nextRegion) => {
                const sanitizedRegion = sanitizeRegion(nextRegion, safeFallbackCoordinate);
                setMapRegion(sanitizedRegion);
                logMapLocationDebug(
                  'REGION_CHANGE_COMPLETE',
                  sanitizedRegion,
                  sanitizeCoordinate(pinnedCoords, safeFallbackCoordinate)
                );
              }}
              onPress={handleMapPress}
            >
              {isMapReady && pinnedCoords && (
                <Marker
                  coordinate={pinnedCoords}
                  draggable
                  onDragEnd={handleMarkerDrag}
                  title="Your location"
                />
              )}
              {__DEV__ && (
                <Marker
                  coordinate={METRO_MANILA_TEST_PIN}
                  title="Metro Manila test pin"
                  description="Temporary map render check"
                  pinColor="#2563EB"
                />
              )}
            </MapView>
            {mapLoadError ? (
              <View style={styles.mapErrorBanner}>
                <Ionicons name="warning-outline" size={16} color={colors.warning} />
                <Text style={styles.mapErrorText}>{mapLoadError}</Text>
                <TouchableOpacity style={styles.mapRetryBtn} onPress={handleRetryMapLoad}>
                  <Text style={styles.mapRetryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {__DEV__ && isMapReady && !isMapLoaded ? (
              <View style={styles.mapInfoBanner}>
                <Text style={styles.mapInfoText}>Map ready. Waiting for tiles to fully load...</Text>
              </View>
            ) : null}

            {/* Bottom confirm strip */}
            <View style={styles.mapBottomStrip}>
              {resolving ? (
                <View style={styles.resolveRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.resolveText}>Getting address…</Text>
                </View>
              ) : (
                <View style={styles.resolveRow}>
                  <Ionicons name="location" size={18} color={colors.primary} />
                  <Text style={styles.resolveAddressText} numberOfLines={4}>
                    {resolvedAddress || 'Tap or drag pin to set address. If unresolved, please add landmark details.'}
                  </Text>
                </View>
              )}
              {mapLoadFailed && pinnedCoords ? (
                <View style={styles.mapFallbackCard}>
                  <Text style={styles.mapFallbackTitle}>Map tiles unavailable</Text>
                  <Text style={styles.mapFallbackText} numberOfLines={2}>
                    {resolvedAddress || 'Pinned coordinate'}
                  </Text>
                  <Text style={styles.mapFallbackCoord}>
                    Lat {pinnedCoords.latitude.toFixed(5)} • Lng {pinnedCoords.longitude.toFixed(5)}
                  </Text>
                  <TouchableOpacity style={styles.mapFallbackBtn} onPress={() => setPanel('confirm')}>
                    <Text style={styles.mapFallbackBtnText}>Use These Coordinates</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.confirmStripBtn, (!pinnedCoords || resolving) && styles.confirmStripBtnDisabled]}
                onPress={() => pinnedCoords && !resolving && setPanel('confirm')}
              >
                <Text style={styles.confirmStripBtnText}>Confirm Location</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── CONFIRM PANEL ─────────────────────────────────────────── */}
        {panel === 'confirm' && (
          <ScrollView style={styles.flex} contentContainerStyle={styles.confirmContent} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setPanel('map')} style={styles.closeBtn}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Address Details</Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Address preview card */}
            <View style={styles.addressPreviewCard}>
              <View style={styles.addressPreviewIconCol}>
                <Ionicons name="location" size={22} color={colors.primary} />
              </View>
              <View style={styles.addressPreviewText}>
                <Text style={styles.addressPreviewMain} numberOfLines={2}>
                  {resolvedAddress || 'No address resolved'}
                </Text>
                {resolving && <Text style={styles.addressResolvingText}>Resolving…</Text>}
                <TouchableOpacity onPress={() => setPanel('map')} style={styles.changeOnMap}>
                  <Text style={styles.changeOnMapText}>Change on map</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Detail form */}
            <Text style={styles.formSectionLabel}>Additional Details</Text>

            <View style={styles.formGroup}>
              <Ionicons name="business-outline" size={16} color={colors.textSecondary} style={styles.formIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="Floor / Unit / Room (optional)"
                placeholderTextColor={colors.textTertiary}
                value={unitFloor}
                onChangeText={setUnitFloor}
                maxLength={MAX_LEN.unitFloor}
              />
            </View>

            <View style={styles.formGroup}>
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} style={styles.formIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="Contact name (optional)"
                placeholderTextColor={colors.textTertiary}
                value={contactName}
                onChangeText={(val) => setContactName(val.replace(NAME_DISALLOWED_RE, ''))}
                maxLength={MAX_LEN.contactName}
              />
            </View>

            <View style={styles.formGroup}>
              <Ionicons name="call-outline" size={16} color={colors.textSecondary} style={styles.formIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="+63 Phone number (optional)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(val) => setPhone(val.replace(/\D/g, ''))}
                maxLength={MAX_LEN.phone}
              />
            </View>

            {/* Save address toggle */}
            <TouchableOpacity style={styles.saveToggleRow} onPress={() => setSaveThis((v) => !v)}>
              <View style={[styles.saveCheckbox, saveThis && styles.saveCheckboxActive]}>
                {saveThis && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.saveToggleText}>Save this address for future bookings</Text>
            </TouchableOpacity>

            {/* Address type selection: Home, Office, Other (Required) */}
            <View style={styles.saveLabelRow}>
              {['Home', 'Office', 'Other'].map((lbl) => (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.labelChip, saveLabel === lbl && styles.labelChipActive]}
                  onPress={() => setSaveLabel(lbl)}
                >
                  <Ionicons
                    name={getLabelIcon(lbl).name}
                    size={14}
                    color={saveLabel === lbl ? '#FFF' : getLabelIcon(lbl).color}
                  />
                  <Text style={[styles.labelChipText, saveLabel === lbl && styles.labelChipTextActive]}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, (!resolvedAddress || !pinnedCoords || !saveLabel) && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!resolvedAddress || !pinnedCoords || !saveLabel}
            >
              <Text style={styles.confirmBtnText}>Use This Address</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  // Sheet header
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

  // Search
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    zIndex: 99,
    elevation: 99,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  autocompleteInputContainer: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  autocompleteInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    backgroundColor: 'transparent',
    paddingRight: 12,
    height: 48,
  },
  autocompleteListView: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 999,
    elevation: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  autocompleteRow: { paddingVertical: 12, paddingHorizontal: 14 },

  // List
  listScroll: { flex: 1 },
  listDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 },

  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    gap: 12,
  },
  quickIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  quickInfo: { flex: 1 },
  quickTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  quickSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  savedSectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  savedRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: colors.surface, gap: 12,
  },
  savedLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  savedLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  savedAddr: { fontSize: 12, color: colors.textSecondary },
  defaultBadge: {
    backgroundColor: colors.successLight, borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 9, fontWeight: '700', color: colors.success },

  // Map
  fullMap: { flex: 1 },
  mapFloatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mapBackBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  mapHeaderText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 18 },
  mapErrorBanner: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapErrorText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  mapRetryBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapRetryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  mapInfoBanner: {
    position: 'absolute',
    top: 104,
    left: 12,
    right: 12,
    zIndex: 11,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  mapFallbackCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  mapFallbackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  mapFallbackText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  mapFallbackCoord: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  mapFallbackBtn: {
    marginTop: 4,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  mapBottomStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  resolveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resolveText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  resolveAddressText: { fontSize: 14, color: colors.text, fontWeight: '600', flex: 1, lineHeight: 20 },
  confirmStripBtn: {
    height: 52, borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  confirmStripBtnDisabled: { backgroundColor: colors.disabled },
  confirmStripBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Confirm
  confirmContent: { paddingBottom: 40 },
  addressPreviewCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.surface, margin: 16,
    borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: colors.primary + '40',
  },
  addressPreviewIconCol: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  addressPreviewText: { flex: 1 },
  addressPreviewMain: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  addressResolvingText: { fontSize: 12, color: colors.primary, marginTop: 4 },
  changeOnMap: { marginTop: 6 },
  changeOnMapText: { fontSize: 12, fontWeight: '700', color: colors.accent },

  formSectionLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: 16, marginTop: 8, marginBottom: 10,
  },
  formGroup: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    height: 52, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formIcon: { paddingHorizontal: 12 },
  formInput: { flex: 1, fontSize: 14, color: colors.text, paddingRight: 12 },

  saveToggleRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12, gap: 10,
  },
  saveCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  saveCheckboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  saveToggleText: { fontSize: 13, fontWeight: '500', color: colors.text, flex: 1 },

  saveLabelRow: {
    flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16,
  },
  labelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 100, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  labelChipTextActive: { color: '#FFF' },

  confirmBtn: {
    height: 56, marginHorizontal: 16, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  confirmBtnDisabled: { backgroundColor: colors.disabled },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

export default AddressPickerSheet;
