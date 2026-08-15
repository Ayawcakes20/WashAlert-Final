import { Platform } from 'react-native';
import Constants from 'expo-constants';

const fallbackBaseUrl = 'https://backend-service-production-5d36.up.railway.app';

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

export const API_BASE_URL = normalizeBaseUrl(rawApiBaseUrl) || fallbackBaseUrl;

export const FIREBASE_API_KEY =
  (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAi-ScPD1pQZBH-2QbC_TvQXW1-xmHV1zw').trim();
export const FIREBASE_STORAGE_BUCKET =
  (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'washalert-b8ce8.firebasestorage.app').trim();
export const FIREBASE_AUTH_DOMAIN =
  (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'washalert-b8ce8.firebaseapp.com').trim();
export const FIREBASE_PROJECT_ID =
  (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'washalert-b8ce8').trim();
export const FIREBASE_MESSAGING_SENDER_ID =
  (process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '41267840316').trim();
export const FIREBASE_APP_ID =
  (process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:41267840316:web:3e31f48108020fc53fca39').trim();
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
