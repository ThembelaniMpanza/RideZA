import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

const requiredKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (requiredKeys.length > 0) {
  console.warn(
    `Firebase config missing: ${requiredKeys.join(", ")}. ` +
      "Set the EXPO_PUBLIC_FIREBASE_* environment variables before using auth.",
  );
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;

try {
  authInstance = initializeAuth(app);
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export function isFirebaseConfigured() {
  return requiredKeys.length === 0;
}
