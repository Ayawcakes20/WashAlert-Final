import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_ADDRESSES_STORAGE_KEY = 'washalert_saved_addresses_v1';

const normalizeAddress = (item = {}) => ({
  id: String(item.id || Date.now()),
  label: String(item.label || '').trim(),
  address: String(item.address || '').trim(),
  isDefault: Boolean(item.isDefault),
});

const ensureSingleDefault = (items = []) => {
  const normalized = items.map(normalizeAddress).filter((entry) => entry.label && entry.address);
  if (!normalized.length) return [];

  const defaultIndex = normalized.findIndex((entry) => entry.isDefault);
  if (defaultIndex === -1) {
    return normalized.map((entry, index) => ({ ...entry, isDefault: index === 0 }));
  }
  return normalized.map((entry, index) => ({ ...entry, isDefault: index === defaultIndex }));
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
  return addresses.find((entry) => entry.isDefault) || null;
};
