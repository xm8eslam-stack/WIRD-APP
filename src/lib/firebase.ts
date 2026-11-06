import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

function getEnvVar(key: string): string {
  if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return '';
}

export function validateFirebaseConfigMap(envMap: Record<string, string>): boolean {
  const keyPairs = [
    ['apiKey', 'VITE_FIREBASE_API_KEY'],
    ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
    ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
    ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'],
    ['messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'],
    ['appId', 'VITE_FIREBASE_APP_ID']
  ];

  for (const [k1, k2] of keyPairs) {
    const val = envMap[k1] || envMap[k2];
    if (!val || val.trim() === '') return false;
    const lower = val.toLowerCase();
    if (
      lower.includes('placeholder') ||
      lower.includes('your_') ||
      lower.includes('your-') ||
      val === '1234567890' ||
      val === '1:1234567890:web:1234567890'
    ) {
      return false;
    }
  }

  return true;
}

export function getResolvedFirebaseConfig(): Record<string, string> {
  const cfg = (appletConfig && typeof appletConfig === 'object') ? appletConfig as Record<string, string> : {};
  return {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || cfg.apiKey || '',
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || cfg.authDomain || '',
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || cfg.projectId || '',
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || cfg.storageBucket || '',
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || cfg.messagingSenderId || '',
    appId: getEnvVar('VITE_FIREBASE_APP_ID') || cfg.appId || '',
    firestoreDatabaseId: getEnvVar('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || cfg.firestoreDatabaseId || ''
  };
}

export function isFirebaseConfigured(): boolean {
  const resolved = getResolvedFirebaseConfig();
  return validateFirebaseConfigMap(resolved);
}

// Truly optional Firebase initialization - null when unconfigured
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleAuthProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured()) {
  const config = getResolvedFirebaseConfig();
  const firebaseConfig = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId
  };

  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  auth = getAuth(app);
  if (config.firestoreDatabaseId && config.firestoreDatabaseId.trim() !== '') {
    db = getFirestore(app, config.firestoreDatabaseId.trim());
  } else {
    db = getFirestore(app);
  }

  googleAuthProvider = new GoogleAuthProvider();
  googleAuthProvider.setCustomParameters({
    prompt: 'select_account'
  });
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    // Permission denied on test/connection is expected if rules deny it,
    // but indicates reachability to the Firestore servers.
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[WIRD Firebase] Offline or unreachable Firestore connection.');
      return false;
    }
    return true;
  }
}

export { app, auth, db, googleAuthProvider };

