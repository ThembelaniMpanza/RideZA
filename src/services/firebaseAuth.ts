import type { FirebaseApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { firebaseAuthStorage } from "./authStorage";

export function initializeFirebaseAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(firebaseAuthStorage),
    });
  } catch {
    return getAuth(app);
  }
}
