import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';

function getEnvVar(key: string): string {
  if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return '';
}

export function isFirebaseConfigured(): boolean {
  const apiKey = getEnvVar('VITE_FIREBASE_API_KEY');
  return Boolean(
    apiKey && 
    apiKey !== 'your-firebase-api-key' && 
    apiKey !== 'AIzaSyPlaceholderApiKeyForTesting12345'
  );
}

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyPlaceholderApiKeyForTesting12345',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || 'wird-quran-app.firebaseapp.com',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'wird-quran-app',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || 'wird-quran-app.appspot.com',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '1234567890',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '1:1234567890:web:1234567890'
};

// Singleton Firebase initialization
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Configure Google provider options
googleAuthProvider.setCustomParameters({
  prompt: 'select_account'
});
