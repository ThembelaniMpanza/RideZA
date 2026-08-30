import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { initializeFirebaseAuth } from "./firebaseAuth";

const databaseURL = process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL?.trim() ?? "";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
  ...(databaseURL ? { databaseURL } : {}),
};

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
].filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (requiredKeys.length > 0) {
  console.warn(
    `Firebase config missing: ${requiredKeys.join(", ")}. ` +
      "Set the EXPO_PUBLIC_FIREBASE_* environment variables before using auth.",
  );
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeFirebaseAuth(app);
export const database = databaseURL
  ? getDatabase(app, databaseURL)
  : null;

export function isFirebaseConfigured() {
  return requiredKeys.length === 0;
}

export function isFirebaseDatabaseConfigured() {
  return database !== null;
}
