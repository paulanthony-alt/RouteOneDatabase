import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore,
} from 'firebase/firestore';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** Firebase is used when the project is configured; otherwise the app runs on this browser's storage. */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId);
const emulators = env.VITE_FIREBASE_EMULATORS === 'true';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;

export function fb() {
  if (!firebaseEnabled) throw new Error('Firebase is not configured');
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    firestore = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      // Keeps a copy on the device so the ledger loads fast and stays readable on bad show Wi-Fi.
      localCache: emulators ? undefined : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (emulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    }
  }
  return { app: app!, auth: auth!, db: firestore! };
}
