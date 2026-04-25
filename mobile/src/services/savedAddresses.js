import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_ADDRESSES_STORAGE_KEY = 'washalert_saved_addresses_v2';

const normalizeAddress = (item = {}) => ({
  id: String(item.id || Date.now()),
  label: String(item.label || '').trim(),
  address: String(item.address || '').trim(),
  // Optional detail fields
  unitFloor: String(item.unitFloor || '').trim(),
  contactName: String(item.contactName || '').trim(),
  phone: String(item.phone || '').trim(),
  // Coords — stored for fast map navigation without geocoding
  latitude: item.latitude ? Number(item.latitude) : null,
  longitude: item.longitude ? Number(item.longitude) : null,
  isDefault: Boolean(item.isDefault),
});

const ensureSingleDefault = (items = []) => {
  const normalized = items.map(normalizeAddress).filter((e) => e.label && e.address);
  if (!normalized.length) return [];
  const defaultIndex = normalized.findIndex((e) => e.isDefault);
  if (defaultIndex === -1) {
    return normalized.map((e, i) => ({ ...e, isDefault: i === 0 }));
  }
  return normalized.map((e, i) => ({ ...e, isDefault: i === defaultIndex }));
};

export const loadSavedAddresses = async () => {
  try {
    const raw = await AsyncStorage.getItem(SAVED_ADDRESSES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return ensureSingleDefault(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
};

export const saveSavedAddresses = async (items) => {
  const normalized = ensureSingleDefault(items);
  await AsyncStorage.setItem(SAVED_ADDRESSES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const getDefaultSavedAddress = async () => {
  const addresses = await loadSavedAddresses();
  return addresses.find((e) => e.isDefault) || null;
};
