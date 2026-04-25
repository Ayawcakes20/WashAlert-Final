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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import { MapView, Marker, PROVIDER_GOOGLE } from './SafeMap';
import { colors } from '../theme/colors';
import { GOOGLE_MAPS_API_KEY } from '../config/env';
import {
  loadSavedAddresses,
  saveSavedAddresses,
} from '../services/savedAddresses';

// ─── helpers ────────────────────────────────────────────────────────────────

const formatAddressFromGeo = (geo = {}, lat, lng) => {
  const parts = [geo.name, geo.street, geo.subregion, geo.city, geo.region].filter(Boolean);
  return parts.length ? parts.join(', ') : `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
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
const AddressPickerSheet = ({ visible, title = 'Set Address', onConfirm, onClose, initialValue }) => {
  // panel: 'list' | 'map' | 'confirm'
  const [panel, setPanel] = useState('list');

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);

  // Map state
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5517, longitude: 121.0244, // Makati default
    latitudeDelta: 0.01, longitudeDelta: 0.01,
  });
  const [pinnedCoords, setPinnedCoords] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolving, setResolving] = useState(false);

  // Confirm form state
  const [unitFloor, setUnitFloor] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [saveLabel, setSaveLabel] = useState('');
  const [saveThis, setSaveThis] = useState(false);

  const autocompleteRef = useRef(null);

  // ── Load saved addresses when modal opens ──────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setPanel('list');
    loadSavedAddresses().then(setSavedAddresses).catch(() => setSavedAddresses([]));

    // Pre-populate confirm fields if editing
    if (initialValue) {
      setUnitFloor(initialValue.unitFloor || '');
      setContactName(initialValue.contactName || '');
      setPhone(initialValue.phone || '');
      if (initialValue.latitude && initialValue.longitude) {
        const coords = { latitude: initialValue.latitude, longitude: initialValue.longitude };
        setPinnedCoords(coords);
        setMapRegion((prev) => ({ ...prev, ...coords }));
      }
      setResolvedAddress(initialValue.address || '');
    } else {
      setUnitFloor('');
      setContactName('');
      setPhone('');
      setPinnedCoords(null);
      setResolvedAddress('');
    }
  }, [visible]);

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
        Alert.alert('Permission Denied', 'Allow location access to use this feature.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setPinnedCoords({ latitude, longitude });
      setMapRegion((prev) => ({ ...prev, latitude, longitude }));
      await resolveFromCoords(latitude, longitude);
      setPanel('confirm');
    } catch {
      Alert.alert('Error', 'Unable to get current location.');
    }
  };

  // ── Autocomplete selection ────────────────────────────────────────────
  const handlePlaceSelect = (data, details) => {
    if (!details?.geometry?.location) return;
    const { lat, lng } = details.geometry.location;
    setPinnedCoords({ latitude: lat, longitude: lng });
    setMapRegion((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    setResolvedAddress(data.description);
    setPanel('map');
  };

  // ── Select a previously saved address ────────────────────────────────
  const handleSelectSaved = (item) => {
    setResolvedAddress(item.address);
    if (item.latitude && item.longitude) {
      setPinnedCoords({ latitude: item.latitude, longitude: item.longitude });
      setMapRegion((prev) => ({ ...prev, latitude: item.latitude, longitude: item.longitude }));
      setPanel('map');
    } else {
      // try geocoding
      Location.geocodeAsync(item.address)
        .then((res) => {
          const first = res?.[0];
          if (first?.latitude) {
            const coords = { latitude: first.latitude, longitude: first.longitude };
            setPinnedCoords(coords);
            setMapRegion((prev) => ({ ...prev, ...coords }));
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
    const coord = event?.nativeEvent?.coordinate;
    if (!coord) return;
    setPinnedCoords(coord);
    await resolveFromCoords(coord.latitude, coord.longitude);
  };

  const handleMarkerDrag = async (event) => {
    const coord = event?.nativeEvent?.coordinate;
    if (!coord) return;
    setPinnedCoords(coord);
    await resolveFromCoords(coord.latitude, coord.longitude);
  };

  // ── Confirm → fire callback ───────────────────────────────────────────
  const handleConfirm = async () => {
    if (!resolvedAddress || !pinnedCoords) {
      Alert.alert('No Address', 'Please pin a location first.');
      return;
    }

    // Optionally save to saved addresses
    if (saveThis && saveLabel.trim()) {
      const newEntry = {
        id: String(Date.now()),
        label: saveLabel.trim(),
        address: resolvedAddress,
        unitFloor: unitFloor.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        latitude: pinnedCoords.latitude,
        longitude: pinnedCoords.longitude,
        isDefault: savedAddresses.length === 0,
      };
      const updated = [...savedAddresses, newEntry];
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
              <Text style={styles.mapHeaderText}>Drag pin to exact location</Text>
            </View>

            <MapView
              style={styles.fullMap}
              provider={PROVIDER_GOOGLE}
              region={mapRegion}
              onRegionChangeComplete={setMapRegion}
              onPress={handleMapPress}
            >
              {pinnedCoords && (
                <Marker
                  coordinate={pinnedCoords}
                  draggable
                  onDragEnd={handleMarkerDrag}
                  title="Your location"
                />
              )}
            </MapView>

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
                  <Text style={styles.resolveAddressText} numberOfLines={2}>
                    {resolvedAddress || 'Tap or drag pin to set address'}
                  </Text>
                </View>
              )}
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
              />
            </View>

            <View style={styles.formGroup}>
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} style={styles.formIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="Contact name (optional)"
                placeholderTextColor={colors.textTertiary}
                value={contactName}
                onChangeText={setContactName}
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
                onChangeText={setPhone}
              />
            </View>

            {/* Save address toggle */}
            <TouchableOpacity style={styles.saveToggleRow} onPress={() => setSaveThis((v) => !v)}>
              <View style={[styles.saveCheckbox, saveThis && styles.saveCheckboxActive]}>
                {saveThis && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.saveToggleText}>Save this address for future bookings</Text>
            </TouchableOpacity>

            {saveThis && (
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
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, (!resolvedAddress || !pinnedCoords) && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!resolvedAddress || !pinnedCoords}
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
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mapBackBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  mapHeaderText: { fontSize: 14, fontWeight: '600', color: colors.text },
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
