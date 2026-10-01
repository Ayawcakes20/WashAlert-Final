import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_ADDRESSES_STORAGE_KEY = 'washalert_saved_addresses_v2';

const normalizeAddress = (item = {}) => ({
  id: String(item.id || Date.now()),
  label: String(item.label || '').trim(),
  address: String(item.address || '').trim(),
  // Optional detail fields
  unitFloor: String(item.unitFloor || '').trim(),
  addressLine1: String(item.addressLine1 || '').trim(),
  addressLine2: String(item.addressLine2 || '').trim(),
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

export const saveOrUpdateDefaultAddress = async (entry = {}) => {
  const addresses = await loadSavedAddresses();
  const addressText = String(entry.address || '').trim();
  if (!addressText) return addresses;

  const line1 = String(entry.addressLine1 || '').trim();
  const line2 = String(entry.addressLine2 || '').trim();
  const combinedUnitFloor = String(entry.unitFloor || [line1, line2].filter(Boolean).join(', ')).trim();

  const defaultIndex = addresses.findIndex((e) => e.isDefault);
  if (defaultIndex >= 0) {
    const updated = addresses.map((item, idx) =>
      idx === defaultIndex
        ? {
            ...item,
            address: addressText,
            addressLine1: line1,
            addressLine2: line2,
            unitFloor: combinedUnitFloor || item.unitFloor,
          }
        : item
    );
    return await saveSavedAddresses(updated);
  } else {
    const newDefault = {
      id: String(entry.id || Date.now()),
      label: String(entry.label || 'Home').trim(),
      address: addressText,
      addressLine1: line1,
      addressLine2: line2,
      unitFloor: combinedUnitFloor,
      isDefault: true,
    };
    return await saveSavedAddresses([newDefault, ...addresses]);
  }
};
