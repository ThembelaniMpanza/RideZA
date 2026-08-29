import * as SecureStore from "expo-secure-store";

type FirebaseAuthStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  keychainService: "com.thembelanim.rideza.firebase-auth",
};

function toSecureStoreKey(key: string) {
  const encoded = Array.from(key, character =>
    character.charCodeAt(0).toString(16).padStart(4, "0"),
  ).join("");

  return `firebase_auth_${encoded}`;
}

const secureStorage: FirebaseAuthStorage = {
  getItem(key) {
    return SecureStore.getItemAsync(toSecureStoreKey(key), secureStoreOptions);
  },
  setItem(key, value) {
    return SecureStore.setItemAsync(
      toSecureStoreKey(key),
      value,
      secureStoreOptions,
    );
  },
  removeItem(key) {
    return SecureStore.deleteItemAsync(toSecureStoreKey(key), secureStoreOptions);
  },
};

export const firebaseAuthStorage: FirebaseAuthStorage = secureStorage;
