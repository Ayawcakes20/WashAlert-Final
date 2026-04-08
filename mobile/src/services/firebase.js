import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "washalert-b8ce8.firebaseapp.com",
  projectId: "washalert-b8ce8",
  storageBucket: "washalert-b8ce8.firebasestorage.app",
  messagingSenderId: "1234567890", // Placeholder
  appId: "1:1234567890:web:abcdef" // Placeholder
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export default app;
