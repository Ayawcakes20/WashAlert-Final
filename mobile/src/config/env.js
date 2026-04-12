import { Platform } from 'react-native';

const fallbackBaseUrl =
  Platform.OS === 'android' ? 'http://10.0.2.2:8081' : 'http://localhost:8081';

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = rawApiBaseUrl && rawApiBaseUrl.trim() ? rawApiBaseUrl.trim() : fallbackBaseUrl;

export const FIREBASE_API_KEY = (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '').trim();
export const FIREBASE_STORAGE_BUCKET =
  (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'washalert-b8ce8.firebasestorage.app').trim();

export const DEMO_MODE_ENABLED = String(process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE || 'false').toLowerCase() === 'true';
