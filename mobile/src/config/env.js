import { Platform } from 'react-native';
import Constants from 'expo-constants';

const fallbackBaseUrl =
  Platform.OS === 'android' ? 'http://10.0.2.2:8081' : 'http://localhost:8081';

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

// Dev note:
// Prefer local LAN base URL for physical-device testing (e.g. http://192.168.x.x:8081).
// Use ngrok primarily for external webhook callbacks.
export const API_BASE_URL = normalizeBaseUrl(rawApiBaseUrl) || normalizeBaseUrl(fallbackBaseUrl);

export const FIREBASE_API_KEY = (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '').trim();
export const FIREBASE_STORAGE_BUCKET =
  (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'washalert-b8ce8.firebasestorage.app').trim();
export const FIREBASE_AUTH_DOMAIN = (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '').trim();
export const FIREBASE_PROJECT_ID = (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
export const FIREBASE_MESSAGING_SENDER_ID = (process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '').trim();
export const FIREBASE_APP_ID = (process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '').trim();
const mapsApiKeyFromExpoConfig =
  Constants?.expoConfig?.android?.config?.googleMaps?.apiKey ||
  Constants?.expoConfig?.ios?.config?.googleMapsApiKey ||
  '';
const envMapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
export const NATIVE_GOOGLE_MAPS_API_KEY = String(mapsApiKeyFromExpoConfig || '').trim();
export const GOOGLE_MAPS_API_KEY =
  (envMapsApiKey || NATIVE_GOOGLE_MAPS_API_KEY || '').trim();
export const GOOGLE_MAPS_API_KEY_SOURCE = envMapsApiKey
  ? 'env'
  : NATIVE_GOOGLE_MAPS_API_KEY
    ? 'native-config'
    : 'missing';

export const DEMO_MODE_ENABLED = String(process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE || 'false').toLowerCase() === 'true';
