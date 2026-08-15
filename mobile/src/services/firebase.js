import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config is hardcoded to guarantee correct values in production builds.
// These are non-secret client-side identifiers (also present in google-services.json).
const firebaseConfig = {
  apiKey: 'AIzaSyAi-ScPD1pQZBH-2QbC_TvQXW1-xmHV1zw',
  authDomain: 'washalert-b8ce8.firebaseapp.com',
  projectId: 'washalert-b8ce8',
  storageBucket: 'washalert-b8ce8.firebasestorage.app',
  messagingSenderId: '41267840316',
  appId: '1:41267840316:web:3e31f48108020fc53fca39',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export default app;
