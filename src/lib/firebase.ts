import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

/**
 * WIRD has one canonical Firebase project and uses its default Firestore database.
 * Keep this invariant explicit so stale AI Studio applet config cannot silently
 * redirect users to a different Firebase project or named database.
 */
export const WIRD_FIREBASE_PROJECT_ID = 'wird-quran-app';
export const WIRD_FIRESTORE_DATABASE_ID = '(default)';

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

export function isExpectedWirdFirebaseProject(configMap: Record<string, string>): boolean {
  const projectId = configMap.projectId || configMap.VITE_FIREBASE_PROJECT_ID || '';
  return projectId === WIRD_FIREBASE_PROJECT_ID;
}

/**
 * Resolve public Firebase web configuration. The Firestore database ID is
 * intentionally not configurable: WIRD always uses getFirestore(app), which
 * selects the (default) database in wird-quran-app.
 */
export function resolveFirebaseConfig(
  envMap: Record<string, string>,
  fileConfig: Record<string, string>
): Record<string, string> {
  const pick = (key: string, envKey: string) =>
    envMap[envKey] || envMap[key] || fileConfig[key] || '';

  return {
    apiKey: pick('apiKey', 'VITE_FIREBASE_API_KEY'),
    authDomain: pick('authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: pick('projectId', 'VITE_FIREBASE_PROJECT_ID'),
    storageBucket: pick('storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: pick('messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: pick('appId', 'VITE_FIREBASE_APP_ID'),
    firestoreDatabaseId: ''
  };
}

export function getResolvedFirebaseConfig(): Record<string, string> {
  const cfg = (appletConfig && typeof appletConfig === 'object')
    ? appletConfig as Record<string, string>
    : {};
  const envMap: Record<string, string> = {
    VITE_FIREBASE_API_KEY: getEnvVar('VITE_FIREBASE_API_KEY'),
    VITE_FIREBASE_AUTH_DOMAIN: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    VITE_FIREBASE_PROJECT_ID: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    VITE_FIREBASE_STORAGE_BUCKET: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    VITE_FIREBASE_MESSAGING_SENDER_ID: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    VITE_FIREBASE_APP_ID: getEnvVar('VITE_FIREBASE_APP_ID')
  };

  return resolveFirebaseConfig(envMap, cfg);
}

export function isFirebaseConfigured(): boolean {
  const resolved = getResolvedFirebaseConfig();
  return validateFirebaseConfigMap(resolved) && isExpectedWirdFirebaseProject(resolved);
}

// Truly optional Firebase initialization - null when unconfigured or pointed at a non-canonical project.
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
    if (app.options.projectId !== WIRD_FIREBASE_PROJECT_ID) {
      throw new Error('[WIRD Firebase] Existing Firebase app is connected to a non-canonical project.');
    }
  }

  auth = getAuth(app);
  // No database ID argument: this is deliberately the (default) Firestore database.
  db = getFirestore(app);

  googleAuthProvider = new GoogleAuthProvider();
  googleAuthProvider.setCustomParameters({
    prompt: 'select_account'
  });
} else {
  const resolved = getResolvedFirebaseConfig();
  if (validateFirebaseConfigMap(resolved) && !isExpectedWirdFirebaseProject(resolved)) {
    console.error('[WIRD Firebase] Initialization blocked: configure the canonical project wird-quran-app.');
  }
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
