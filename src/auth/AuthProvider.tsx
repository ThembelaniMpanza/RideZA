import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { auth } from "../services/firebase";
import {
  isSessionVerificationConfigured,
  SessionRejectedError,
  verifySessionWithServer,
  type VerifiedSession,
} from "../services/sessionVerification";
import {
  captureOperationalError,
  trackAnalyticsEvent,
} from "../telemetry/telemetry";

const ONBOARDING_KEY = "hasOnboarded";
const LEGACY_AUTH_KEYS = ["@user_token", "@user_email", "@firebase_uid"];
const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;

type VerificationStatus =
  | "anonymous"
  | "checking"
  | "verified"
  | "not-configured"
  | "unavailable";

type AuthContextValue = {
  user: User | null;
  isReady: boolean;
  hasOnboarded: boolean;
  verificationStatus: VerificationStatus;
  verifiedSession: VerifiedSession | null;
  completeOnboarding(): Promise<void>;
  resetOnboarding(): Promise<void>;
  refreshSession(forceRefresh?: boolean): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("anonymous");
  const [verifiedSession, setVerifiedSession] =
    useState<VerifiedSession | null>(null);
  const verificationRequest = useRef(0);

  const verifyUser = useCallback(async (currentUser: User, forceRefresh = false) => {
    const requestId = ++verificationRequest.current;

    if (!isSessionVerificationConfigured()) {
      setVerificationStatus("not-configured");
      setVerifiedSession(null);
      return;
    }

    setVerificationStatus("checking");

    try {
      const session = await verifySessionWithServer(currentUser, forceRefresh);
      if (requestId !== verificationRequest.current) return;
      setVerifiedSession(session);
      setVerificationStatus(session ? "verified" : "not-configured");
    } catch (error) {
      if (requestId !== verificationRequest.current) return;
      setVerifiedSession(null);

      if (error instanceof SessionRejectedError) {
        await firebaseSignOut(auth);
        return;
      }

      setVerificationStatus("unavailable");
    }
  }, []);

  const refreshSession = useCallback(
    async (forceRefresh = false) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const tokenResult = await currentUser.getIdTokenResult();
        const expiresSoon =
          new Date(tokenResult.expirationTime).getTime() - Date.now() <=
          TOKEN_REFRESH_WINDOW_MS;

        await verifyUser(currentUser, forceRefresh || expiresSoon);
      } catch {
        if (auth.currentUser?.uid === currentUser.uid) {
          setVerifiedSession(null);
          setVerificationStatus("unavailable");
        }
      }
    },
    [verifyUser],
  );

  useEffect(() => {
    let active = true;
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeToken: (() => void) | undefined;

    const initialize = async () => {
      let storedOnboarding: string | null = null;

      try {
        if (__DEV__ && process.env.EXPO_PUBLIC_RESET_ONBOARDING === "1") {
          await firebaseSignOut(auth);
          await AsyncStorage.multiRemove([
            ONBOARDING_KEY,
            "@has_onboarded",
            ...LEGACY_AUTH_KEYS,
          ]);
        } else {
          await AsyncStorage.multiRemove(LEGACY_AUTH_KEYS);
        }

        storedOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
      } catch (error) {
        captureOperationalError(error, {
          event_type: "auth_initialization_failed",
          source: "auth_provider",
        });
        if (__DEV__) console.error("[RideZA auth initialization]", error);
      }

      if (active) {
        setHasOnboarded(storedOnboarding === "true");
        setOnboardingReady(true);
      }

      unsubscribeAuth = onAuthStateChanged(
        auth,
        nextUser => {
          if (!active) return;
          verificationRequest.current += 1;
          setUser(nextUser);
          setAuthReady(true);

          if (nextUser) {
            void verifyUser(nextUser);
          } else {
            setVerifiedSession(null);
            setVerificationStatus("anonymous");
          }
        },
        () => {
          if (!active) return;
          setUser(null);
          setAuthReady(true);
          setVerifiedSession(null);
          setVerificationStatus("anonymous");
        },
      );

      let receivedInitialToken = false;
      unsubscribeToken = onIdTokenChanged(auth, tokenUser => {
        if (!active) return;
        if (!receivedInitialToken) {
          receivedInitialToken = true;
          return;
        }
        if (tokenUser) void verifyUser(tokenUser);
      });
    };

    void initialize();

    return () => {
      active = false;
      unsubscribeAuth?.();
      unsubscribeToken?.();
    };
  }, [verifyUser]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", nextState => {
      if (nextState === "active") void refreshSession();
    });

    return () => subscription.remove();
  }, [refreshSession]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setHasOnboarded(true);
    trackAnalyticsEvent("onboarding_completed", {
      outcome: "success",
      source: "rider_app",
    });
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await firebaseSignOut(auth);
    await AsyncStorage.multiRemove([ONBOARDING_KEY, "@has_onboarded"]);
    setHasOnboarded(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady: authReady && onboardingReady,
      hasOnboarded,
      verificationStatus,
      verifiedSession,
      completeOnboarding,
      resetOnboarding,
      refreshSession,
      signOut,
    }),
    [
      authReady,
      completeOnboarding,
      hasOnboarded,
      onboardingReady,
      refreshSession,
      resetOnboarding,
      signOut,
      user,
      verificationStatus,
      verifiedSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
